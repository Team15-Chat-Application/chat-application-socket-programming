from datetime import datetime, timezone

import pytest
from chat_backend.messages import MessageService, utc_timestamp
from chat_backend.rooms import RoomStore

ALICE = {'userId': 'alice', 'sessionId': 'alice-1'}
BOB = {'userId': 'bob', 'sessionId': 'bob-1'}
FIXED_TIME = '2026-10-20T09:00:00.000Z'


def code_of(action):
    try:
        action()
    except Exception as error:
        return getattr(error, 'code', type(error).__name__)
    return 'NO_ERROR'


class Env:
    """One shared store for the room handlers and the messaging service, as production wires it."""

    def __init__(self, member=True):
        counters = {'room': 0, 'message': 0}

        def next_id(prefix):
            counters[prefix] += 1
            return f'{prefix}-{counters[prefix]}'

        self.rooms = RoomStore(new_id=lambda: next_id('room'))
        self.service = MessageService(self.rooms, new_id=lambda: next_id('message'), clock=lambda: FIXED_TIME)
        self.room = self.rooms.create(ALICE, {'name': 'General'})
        if member:
            self.rooms.join(ALICE, 'sock-alice', {'roomId': self.room['roomId']})
        self.payload = {'roomId': self.room['roomId'], 'content': 'hello'}


def test_chat_14_server_issues_identity_id_and_timestamp():
    env = Env()
    forged = dict(env.payload, senderId='mallory', userId='mallory', messageId='forged',
                  createdAt='1970-01-01T00:00:00.000Z')
    assert env.service.send(ALICE, 'sock-alice', forged) == {
        'messageId': 'message-1', 'roomId': env.room['roomId'], 'senderId': 'alice',
        'content': 'hello', 'createdAt': FIXED_TIME
    }


def test_chat_14_repeated_messages_receive_distinct_ids():
    env = Env()
    assert env.service.send(ALICE, 'sock-alice', env.payload)['messageId'] == 'message-1'
    assert env.service.send(ALICE, 'sock-alice', env.payload)['messageId'] == 'message-2'


def test_chat_14_service_cannot_run_without_a_shared_room_store():
    with pytest.raises(ValueError):
        MessageService(None)


@pytest.mark.parametrize('identity', [None, 'alice', [], {'userId': 'alice'},
    {'userId': '', 'sessionId': 's'}, {'userId': 'alice', 'sessionId': 42}])
def test_chat_14_unverified_identity_is_rejected(identity):
    env = Env()
    assert code_of(lambda: env.service.send(identity, 'sock-alice', env.payload)) == 'UNAUTHORIZED'


@pytest.mark.parametrize('payload', [None, [], 'room', {}, {'roomId': ''}, {'roomId': 42}, {'roomId': 'x' * 129}])
def test_chat_14_malformed_room_payloads_are_validation_errors(payload):
    env = Env()
    assert code_of(lambda: env.service.send(ALICE, 'sock-alice', payload)) == 'VALIDATION_ERROR'


@pytest.mark.parametrize('payload', [{'roomId': 'missing-room', 'content': 'hi'},
    {'roomId': 'sock-alice', 'content': 'hi'}, {'roomId': 'chat:room:room-1', 'content': 'hi'}])
def test_chat_14_unknown_rooms_and_internal_channels_are_not_addressable(payload):
    env = Env()
    assert code_of(lambda: env.service.send(ALICE, 'sock-alice', payload)) == 'NOT_FOUND'


def test_chat_14_membership_gates_sending_and_leaving_withdraws_it():
    env = Env()
    assert code_of(lambda: env.service.send(BOB, 'sock-bob', env.payload)) == 'FORBIDDEN'
    assert code_of(lambda: env.service.send(ALICE, 'sock-alice-other', env.payload)) == 'FORBIDDEN'
    env.rooms.leave(ALICE, 'sock-alice', {'roomId': env.room['roomId']})
    assert code_of(lambda: env.service.send(ALICE, 'sock-alice', env.payload)) == 'FORBIDDEN'


def test_chat_14_second_socket_for_the_same_member_may_send():
    env = Env()
    env.rooms.join(ALICE, 'sock-alice-tab', {'roomId': env.room['roomId']})
    assert env.service.send(ALICE, 'sock-alice-tab', env.payload)['roomId'] == env.room['roomId']


def test_chat_14_missing_or_empty_content_is_a_validation_error():
    env = Env()
    for content in (None, '', '   ', '<script></script>', 42):
        payload = {'roomId': env.room['roomId'], 'content': content}
        assert code_of(lambda: env.service.send(ALICE, 'sock-alice', payload)) == 'VALIDATION_ERROR'


# CHAT-16/CHAT-17 semantics below are asserted against the shared helper's behaviour, which
# this messaging increment deliberately does not re-implement or renegotiate. They remain
# pending team confirmation and must not be read as a signed-off contract.
def test_chat_16_pending_team_confirmation_length_policy_is_delegated():
    env = Env()
    send = lambda content: env.service.send(ALICE, 'sock-alice', {'roomId': env.room['roomId'], 'content': content})
    assert send('a' * 2000)['content'] == 'a' * 2000
    assert code_of(lambda: send('a' * 2001)) == 'VALIDATION_ERROR'
    # len() in Python and the spread count in JavaScript both count code points.
    assert send('😀' * 2000)['content'] == '😀' * 2000
    assert code_of(lambda: send('😀' * 2001)) == 'VALIDATION_ERROR'


def test_chat_17_pending_team_confirmation_markup_policy_is_delegated():
    env = Env()
    send = lambda content: env.service.send(ALICE, 'sock-alice',
                                            {'roomId': env.room['roomId'], 'content': content})['content']
    assert send('<b>hello</b>') == 'hello'
    assert send('<script>alert(1)</script>hi') == 'hi'
    assert send('Tom & Jerry') == 'Tom &amp; Jerry'


def test_chat_14_failed_id_allocation_is_a_defect_not_a_partial_message():
    env = Env()
    env.service = MessageService(env.rooms, new_id=lambda: None)
    # app.py maps an unexpected exception to INTERNAL_ERROR; the envelope itself is asserted
    # through the transport in tests/integration/test_messaging.py.
    with pytest.raises(RuntimeError, match='Message ID allocation failed'):
        env.service.send(ALICE, 'sock-alice', env.payload)


def test_chat_14_timestamps_render_in_utc_iso_8601():
    stamped = utc_timestamp()
    assert stamped.endswith('Z')
    parsed = datetime.fromisoformat(stamped.replace('Z', '+00:00'))
    assert parsed.tzinfo is timezone.utc
    assert abs((datetime.now(timezone.utc) - parsed).total_seconds()) < 5


def test_chat_14_service_holds_no_message_state_between_calls():
    env = Env()
    first = env.service.send(ALICE, 'sock-alice', env.payload)
    second = env.service.send(ALICE, 'sock-alice', env.payload)
    assert first['roomId'] == second['roomId'] and first['senderId'] == second['senderId']
    assert first['createdAt'] == second['createdAt'] == FIXED_TIME
    assert first['messageId'] != second['messageId']
