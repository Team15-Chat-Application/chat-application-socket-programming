from time import time
import jwt
import pytest
from chat_backend.app import create_application
from chat_backend.jwt_auth import JwtAuth, ISSUER, AUDIENCE
from chat_backend.rooms import RoomStore, room_channel
from chat_backend.login_limit import LoginLimiter

SECRET = 'test-only-signing-key-with-at-least-32-bytes'


def events(client, name):
    return [e['args'][0] for e in client.get_received() if e['name'] == name]


@pytest.fixture
def setup():
    sessions, rooms, clients = {}, RoomStore(), []
    auth = JwtAuth(secret=SECRET, find_session=sessions.get)
    app, socketio = create_application(auth, rooms)

    def client(user_id, suffix='one'):
        session_id = user_id+'-'+suffix
        sessions[session_id] = {'userId': user_id, 'sessionId': session_id, 'expiresAt': int(time())+600, 'revokedAt': None}
        token = jwt.encode({'sub': user_id, 'jti': session_id, 'iss': ISSUER, 'aud': AUDIENCE,
                            'iat': int(time()), 'exp': int(time())+600}, SECRET, algorithm='HS256')
        c = socketio.test_client(app, auth={'token': token})
        clients.append(c)
        assert c.is_connected()
        c.get_received()
        return c

    yield socketio, rooms, sessions, client
    for c in clients:
        if c.is_connected():
            c.disconnect()


def test_tc_room_02_03_04_join_room_only_delivery_leave_live_catalogue(setup):
    socketio, rooms, _, client = setup
    alice, bob, outsider = client('alice'), client('bob'), client('outsider')
    room = alice.emit('room:create', {'name': 'General'}, callback=True)['data']
    assert events(outsider, 'room:list-updated') == [{'rooms': [room]}]
    payload = {'roomId': room['roomId']}
    assert alice.emit('room:join', payload, callback=True)['data']['memberCount'] == 1
    assert events(alice, 'room:membership') == [{**payload, 'userId': 'alice', 'action': 'join', 'memberCount': 1}]
    assert bob.emit('room:join', dict(payload, userId='forged'), callback=True)['data']['memberCount'] == 2
    assert events(alice, 'room:membership') == [{**payload, 'userId': 'bob', 'action': 'join', 'memberCount': 2}]
    bob.get_received()
    socketio.emit('test:room-probe', {'text': 'transport fixture, not business messaging'}, to=room_channel(room['roomId']))
    assert events(bob, 'test:room-probe') == [{'text': 'transport fixture, not business messaging'}]
    assert events(outsider, 'test:room-probe') == []
    assert bob.emit('room:leave', payload, callback=True) == {'ok': True, 'data': payload}
    assert events(alice, 'room:membership') == [{**payload, 'userId': 'bob', 'action': 'leave', 'memberCount': 1}]
    socketio.emit('test:room-probe', {'text': 'after leave'}, to=room_channel(room['roomId']))
    assert events(bob, 'test:room-probe') == []
    assert outsider.emit('room:list', {}, callback=True)['data']['rooms'] == [dict(room, memberCount=1)]
    assert rooms.has_member(room['roomId'], 'alice')


def test_tc_room_03_04_second_tab_does_not_inflate_count_or_leave_early(setup):
    _, rooms, _, client = setup
    alice, bob, tab = client('alice'), client('bob', 'first'), client('bob', 'second')
    payload = {'roomId': alice.emit('room:create', {'name': 'General'}, callback=True)['data']['roomId']}
    alice.emit('room:join', payload, callback=True)
    bob.emit('room:join', payload, callback=True)
    alice.get_received()
    assert tab.emit('room:join', payload, callback=True)['data']['memberCount'] == 2
    bob.emit('room:leave', payload, callback=True)
    assert events(alice, 'room:membership') == []
    assert rooms.list()[0]['memberCount'] == 2
    tab.disconnect()
    assert events(alice, 'room:membership') == [{**payload, 'userId': 'bob', 'action': 'leave', 'memberCount': 1}]


def test_duplicate_joins_and_internal_socket_channels_are_not_public_rooms(setup):
    _, rooms, _, client = setup
    alice = client('alice')
    payload = {'roomId': alice.emit('room:create', {'name': 'General'}, callback=True)['data']['roomId']}
    assert alice.emit('room:join', payload, callback=True)['data']['memberCount'] == 1
    assert alice.emit('room:join', payload, callback=True)['data']['memberCount'] == 1
    assert len(events(alice, 'room:membership')) == 1
    assert alice.emit('room:join', {'roomId': 'chat:catalogue'}, callback=True)['error']['code'] == 'NOT_FOUND'
    assert len(rooms.list()) == 1


@pytest.mark.parametrize('event', ['room:join', 'room:leave'])
def test_invalid_room_payloads_do_not_change_membership(setup, event):
    _, rooms, _, client = setup
    alice = client('alice')
    alice.emit('room:create', {'name': 'General'}, callback=True)
    for payload in (None, [], {}, {'roomId': ''}, {'roomId': 42}, {'roomId': 'x'*129}):
        assert alice.emit(event, payload, callback=True)['error']['code'] == 'VALIDATION_ERROR'
    assert alice.emit(event, {'roomId': 'missing'}, callback=True)['error']['code'] == 'NOT_FOUND'
    assert rooms.list()[0]['memberCount'] == 0


def test_tc_sec_03_revocation_blocks_dispatch_and_cleans_membership(setup):
    _, rooms, sessions, client = setup
    alice, bob = client('alice'), client('bob')
    payload = {'roomId': alice.emit('room:create', {'name': 'General'}, callback=True)['data']['roomId']}
    alice.emit('room:join', payload, callback=True)
    bob.emit('room:join', payload, callback=True)
    alice.get_received()
    sessions['bob-one']['revokedAt'] = int(time())
    bob.emit('room:create', {'name': 'Blocked'})
    assert not bob.is_connected()
    assert events(alice, 'room:membership') == [{**payload, 'userId': 'bob', 'action': 'leave', 'memberCount': 1}]
    assert len(rooms.list()) == 1


def test_tc_sec_03_unknown_event_is_also_guarded(setup):
    _, _, sessions, client = setup
    alice = client('alice')
    assert alice.emit('unknown:event', {}, callback=True)['error']['code'] == 'NOT_FOUND'
    sessions['alice-one']['revokedAt'] = int(time())
    alice.emit('unknown:event', {})
    assert not alice.is_connected()


def test_tc_sec_04_http_rate_limit_precedes_login_and_ignores_spoofed_forwarded_headers():
    now, calls = [0], []

    def fixture_login():
        calls.append(1)
        return {'ok': False, 'error': {'code': 'UNAUTHORIZED', 'message': 'Fixture login rejection'}}, 401

    app, _ = create_application(login_limiter=LoginLimiter(clock=lambda: now[0]), login_handler=fixture_login)
    client = app.test_client()
    for i in range(5):
        assert client.post('/api/auth/login', headers={'X-Forwarded-For': f'192.0.2.{i}'}).status_code == 401
    response = client.post('/api/auth/login', headers={'X-Forwarded-For': '198.51.100.1'})
    assert response.status_code == 429
    assert response.headers['Retry-After'] == '60'
    assert response.json == {'ok': False, 'error': {'code': 'RATE_LIMITED', 'message': 'Too many login attempts'}}
    assert len(calls) == 5
    now[0] = 60000
    assert client.post('/api/auth/login').status_code == 401
    assert len(calls) == 6
