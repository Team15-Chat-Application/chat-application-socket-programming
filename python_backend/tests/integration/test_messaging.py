# CHAT-14 / CHAT-15 for the Flask backend over the Socket.IO test-client transport.
#
# Fixture-backed verification, not production authentication: these tests sign HS256 tokens
# with a test-only secret and resolve them through Soham's JwtAuth against an in-test session
# dict. Hrisheek's registration/login session issuance is still open, so a green run proves the
# messaging handlers and the auth *consumer* contract, not an end-to-end login flow.
#
# The Flask test client is an in-process transport: it delivers events synchronously and does
# not exercise real packet ordering. Cross-client ordering over an actual Socket.IO connection
# is covered by tests/integration/messaging.test.js on the Node side.
from time import time

import jwt
import pytest
from chat_backend.app import create_application
from chat_backend.jwt_auth import JwtAuth, ISSUER, AUDIENCE
from chat_backend.messages import MessageService
from chat_backend.rooms import RoomStore

SECRET = 'test-only-signing-key-with-at-least-32-bytes'


def events(client, name):
    return [e['args'][0] for e in client.get_received() if e['name'] == name]


def build(messages_new_id=None):
    sessions, rooms = {}, RoomStore()
    auth = JwtAuth(secret=SECRET, find_session=sessions.get)
    kwargs = {'new_id': messages_new_id} if messages_new_id is not None else {}
    app, socketio = create_application(auth, rooms, messages=MessageService(rooms, **kwargs))
    clients = []

    def client(user_id, suffix='one'):
        session_id = user_id + '-' + suffix
        sessions[session_id] = {'userId': user_id, 'sessionId': session_id,
                                'expiresAt': int(time()) + 600, 'revokedAt': None}
        token = jwt.encode({'sub': user_id, 'jti': session_id, 'iss': ISSUER, 'aud': AUDIENCE,
                            'iat': int(time()), 'exp': int(time()) + 600}, SECRET, algorithm='HS256')
        c = socketio.test_client(app, auth={'token': token})
        clients.append(c)
        assert c.is_connected()
        c.get_received()
        return c

    return app, socketio, rooms, sessions, client, clients


@pytest.fixture
def setup():
    app, socketio, rooms, sessions, client, clients = build()

    def join_room_like_a_member(*members):
        # Room joining belongs to CHAT-19 (Soham); these tests use his handlers as written.
        room = members[0].emit('room:create', {'name': 'General'}, callback=True)['data']
        for member in members:
            member.emit('room:join', {'roomId': room['roomId']}, callback=True)
        return room

    yield socketio, rooms, sessions, client, join_room_like_a_member
    for c in clients:
        if c.is_connected():
            c.disconnect()


def test_chat_14_15_broadcast_reaches_members_and_ack_follows_dispatch(setup):
    _, rooms, _, client, join = setup
    alice, bob, tab = client('alice'), client('bob', 'first'), client('bob', 'second')
    outsider = client('outsider')
    room = join(alice, bob, tab)
    result = alice.emit('message:send', {'roomId': room['roomId'], 'content': 'hello <b>world</b>'}, callback=True)
    delivered = {'messageId': result['data']['messageId'], 'roomId': room['roomId'], 'senderId': 'alice',
                 'content': 'hello world', 'createdAt': result['data']['createdAt']}
    # The acknowledgement is only returned once the broadcast is already queued for recipients.
    assert events(bob, 'message:received') == [delivered]
    assert events(tab, 'message:received') == [delivered]
    assert events(alice, 'message:received') == [delivered]
    assert events(outsider, 'message:received') == []
    assert result == {'ok': True, 'data': delivered}
    assert result['data']['createdAt'].endswith('Z')


def test_chat_14_payload_identity_cannot_override_the_verified_token(setup):
    _, _, _, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    result = alice.emit('message:send', {'roomId': room['roomId'], 'content': 'hi', 'senderId': 'mallory',
                                        'userId': 'mallory', 'messageId': 'forged',
                                        'createdAt': '1970-01-01T00:00:00.000Z'}, callback=True)
    assert result['data']['senderId'] == 'alice'
    assert result['data']['messageId'] != 'forged'
    assert result['data']['createdAt'] != '1970-01-01T00:00:00.000Z'
    assert events(bob, 'message:received') == [result['data']]


def test_chat_14_a_second_room_never_receives_another_room_messages(setup):
    _, _, _, client, join = setup
    alice, carol = client('alice'), client('carol')
    first = join(alice)
    second = carol.emit('room:create', {'name': 'Private'}, callback=True)['data']
    carol.emit('room:join', {'roomId': second['roomId']}, callback=True)
    assert alice.emit('message:send', {'roomId': first['roomId'], 'content': 'room scoped'}, callback=True)['ok'] is True
    assert events(carol, 'message:received') == []


def test_chat_14_non_members_are_refused_and_nothing_is_broadcast(setup):
    _, _, _, client, join = setup
    alice = client('alice')
    room = join(alice)
    outsider = client('outsider')
    assert outsider.emit('message:send', {'roomId': room['roomId'], 'content': 'let me in'}, callback=True) == {
        'ok': False, 'error': {'code': 'FORBIDDEN', 'message': 'Join the room before sending messages'}}
    assert events(alice, 'message:received') == []
    assert events(outsider, 'message:received') == []


@pytest.mark.parametrize('payload', [None, [], 'room', {}, {'roomId': 42}, {'roomId': 'x' * 129},
    {'roomId': 'missing', 'content': 'hi'}, {'content': 'no room'}])
def test_chat_14_invalid_payloads_return_a_failure_envelope_without_broadcast(setup, payload):
    _, _, _, client, join = setup
    alice = client('alice')
    room = join(alice)
    alice.get_received()
    result = alice.emit('message:send', payload, callback=True)
    assert result['ok'] is False
    assert result['error']['code'] in ('VALIDATION_ERROR', 'NOT_FOUND')
    assert isinstance(result['error']['message'], str) and result['error']['message']
    assert events(alice, 'message:received') == []


def test_chat_16_accepts_2000_code_points_and_rejects_2001_without_broadcast(setup):
    _, _, _, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    exact = '😀' * 2000

    accepted = alice.emit('message:send', {'roomId': room['roomId'], 'content': exact}, callback=True)
    assert accepted['ok'] is True
    assert accepted['data']['content'] == exact
    delivered = events(bob, 'message:received')
    assert delivered == [accepted['data']]

    rejected = alice.emit('message:send', {'roomId': room['roomId'], 'content': '😀' * 2001}, callback=True)
    assert rejected['ok'] is False
    assert rejected['error']['code'] == 'VALIDATION_ERROR'
    assert isinstance(rejected['error']['message'], str) and rejected['error']['message']
    assert events(bob, 'message:received') == []


@pytest.mark.parametrize('content', ['', '   ', '<script>alert(1)</script>'])
def test_chat_16_empty_or_invalid_content_fails_without_broadcast(setup, content):
    _, _, _, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    result = alice.emit('message:send', {'roomId': room['roomId'], 'content': content}, callback=True)
    assert result['ok'] is False
    assert result['error']['code'] == 'VALIDATION_ERROR'
    assert result['error']['message']
    assert events(bob, 'message:received') == []


def test_chat_17_recipients_and_acknowledgement_receive_sanitized_content_only(setup):
    _, _, _, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    result = alice.emit('message:send', {
        'roomId': room['roomId'], 'content': '<b>Hello</b><script>alert(1)</script> & <i>world</i>'
    }, callback=True)
    expected = 'Hello &amp; world'
    assert result['ok'] is True
    assert result['data']['content'] == expected
    assert events(bob, 'message:received') == [result['data']]


def test_chat_17_content_empty_after_sanitization_fails_without_broadcast(setup):
    _, _, _, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    result = alice.emit('message:send', {
        'roomId': room['roomId'], 'content': '<script>alert(1)</script>'
    }, callback=True)
    assert result['ok'] is False
    assert result['error']['code'] == 'VALIDATION_ERROR'
    assert result['error']['message']
    assert events(bob, 'message:received') == []


def test_chat_14_second_tab_of_a_member_sends_and_both_receive(setup):
    _, _, _, client, join = setup
    alice, tab = client('alice'), client('alice', 'second')
    room = join(alice, tab)
    result = tab.emit('message:send', {'roomId': room['roomId'], 'content': 'from the second tab'}, callback=True)
    assert result['data']['senderId'] == 'alice'
    assert events(alice, 'message:received') == [result['data']]
    assert events(tab, 'message:received') == [result['data']]


def test_chat_14_messages_are_delivered_in_send_order_without_loss(setup):
    _, _, _, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    bob.get_received()
    for i in range(1, 21):
        assert alice.emit('message:send', {'roomId': room['roomId'], 'content': f'message {i}'},
                          callback=True)['data']['content'] == f'message {i}'
    received = events(bob, 'message:received')
    assert [m['content'] for m in received] == [f'message {i}' for i in range(1, 21)]
    assert len({m['messageId'] for m in received}) == 20


def test_chat_15_an_internal_failure_returns_the_failure_envelope_and_broadcasts_nothing():
    # The shared store still authorises the socket; only message ID allocation is broken, which
    # mirrors the Node assertion and proves the ack reports the defect instead of a fake success.
    app, socketio, rooms, sessions, client, clients = build(messages_new_id=lambda: None)
    try:
        alice, bob = client('alice'), client('bob')
        room = alice.emit('room:create', {'name': 'General'}, callback=True)['data']
        alice.emit('room:join', {'roomId': room['roomId']}, callback=True)
        bob.emit('room:join', {'roomId': room['roomId']}, callback=True)
        alice.get_received(); bob.get_received()
        assert alice.emit('message:send', {'roomId': room['roomId'], 'content': 'boom'}, callback=True) == {
            'ok': False, 'error': {'code': 'INTERNAL_ERROR', 'message': 'An internal error occurred'}}
        assert events(alice, 'message:received') == []
        assert events(bob, 'message:received') == []
    finally:
        for c in clients:
            if c.is_connected():
                c.disconnect()


def test_chat_14_revoked_fixture_session_is_rejected_before_the_handler(setup):
    _, _, sessions, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    alice.get_received()
    sessions['bob-one']['revokedAt'] = int(time())
    assert bob.emit('message:send', {'roomId': room['roomId'], 'content': 'after revocation'}, callback=True) == {
        'ok': False, 'error': {'code': 'UNAUTHORIZED', 'message': 'Session is no longer valid'}}
    assert not bob.is_connected()
    assert events(alice, 'message:received') == []


def test_chat_14_leaving_a_room_stops_later_messages_from_that_sender(setup):
    _, _, _, client, join = setup
    alice, bob = client('alice'), client('bob')
    room = join(alice, bob)
    alice.emit('room:leave', {'roomId': room['roomId']}, callback=True)
    bob.get_received()
    assert alice.emit('message:send', {'roomId': room['roomId'], 'content': 'ghost post'}, callback=True)['error']['code'] == 'FORBIDDEN'
    assert events(bob, 'message:received') == []
