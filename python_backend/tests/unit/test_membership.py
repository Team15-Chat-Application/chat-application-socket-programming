import pytest
from chat_backend.rooms import RoomStore, RoomError

ALICE = {'userId': 'alice', 'sessionId': 'alice-s'}
BOB = {'userId': 'bob', 'sessionId': 'bob-s'}


@pytest.fixture
def setup():
    rooms = RoomStore()
    return rooms, {'roomId': rooms.create(ALICE, {'name': 'General'})['roomId']}


def test_tc_room_02_04_unique_users_and_isolated_snapshots(setup):
    rooms, payload = setup
    assert rooms.join(ALICE, 'a1', payload)['changed'] is True
    assert rooms.join(ALICE, 'a1', payload)['changed'] is False
    assert rooms.join(ALICE, 'a2', payload)['changed'] is False
    assert rooms.join(BOB, 'b1', payload)['room']['memberCount'] == 2
    snapshot = rooms.get(payload)
    snapshot['memberCount'] = 500
    assert rooms.list()[0]['memberCount'] == 2
    assert rooms.has_member(payload['roomId'], 'alice')
    assert rooms.has_socket(payload['roomId'], 'a2')
    assert not rooms.has_socket(payload['roomId'], 'other')


def test_tc_room_03_last_socket_departure_only(setup):
    rooms, payload = setup
    rooms.join(ALICE, 'a1', payload)
    rooms.join(ALICE, 'a2', payload)
    rooms.join(BOB, 'b1', payload)
    assert rooms.leave(ALICE, 'a1', payload)['changed'] is False
    assert rooms.leave(ALICE, 'a1', payload)['changed'] is False
    assert rooms.disconnect('a2') == [{**payload, 'userId': 'alice', 'action': 'leave', 'memberCount': 1}]
    assert rooms.disconnect('a2') == []
    assert not rooms.has_member(payload['roomId'], 'alice')
    assert not rooms.has_socket(payload['roomId'], 'a2')


def test_disconnect_cleans_every_room_and_retains_empty_rooms(setup):
    rooms, payload = setup
    second = {'roomId': rooms.create(ALICE, {'name': 'Second'})['roomId']}
    rooms.join(ALICE, 'a1', payload)
    rooms.join(ALICE, 'a1', second)
    assert len(rooms.disconnect('a1')) == 2
    assert [r['memberCount'] for r in rooms.list()] == [0, 0]


@pytest.mark.parametrize('payload', [None, [], {}, {'roomId': ''}, {'roomId': 3}, {'roomId': 'x' * 129}])
def test_invalid_ids_leave_membership_unchanged(setup, payload):
    rooms, _ = setup
    with pytest.raises(RoomError) as caught:
        rooms.join(ALICE, 'a1', payload)
    assert caught.value.code == 'VALIDATION_ERROR'
    assert rooms.list()[0]['memberCount'] == 0


def test_unknown_room_and_forged_identity_do_not_mutate_membership(setup):
    rooms, payload = setup
    with pytest.raises(RoomError) as caught:
        rooms.join(ALICE, 'a1', {'roomId': 'missing'})
    assert caught.value.code == 'NOT_FOUND'
    rooms.join(ALICE, 'a1', payload)
    for method in (rooms.join, rooms.leave):
        with pytest.raises(RoomError) as caught:
            method(BOB, 'a1', payload)
        assert caught.value.code == 'FORBIDDEN'
    assert rooms.list()[0]['memberCount'] == 1
