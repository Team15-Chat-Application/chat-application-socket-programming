import pytest
from chat_backend.rooms import RoomError, RoomStore, validate_room_name

IDENTITY = {'userId': 'verified-user', 'sessionId': 'verified-session'}


@pytest.mark.parametrize('payload', [None, [], {}, {'name': None}, {'name': 42}, {'name': ''},
    {'name': ' \t\n '}, {'name': 'a' * 65}, {'name': '😀' * 65},
    {'name': 'bad\x00name'}, {'name': 'bad\nname'}, {'name': '\ud800'}])
def test_invalid_name_does_not_mutate_catalogue(payload):
    rooms = RoomStore()
    with pytest.raises(RoomError) as caught:
        rooms.create(IDENTITY, payload)
    assert caught.value.code == 'VALIDATION_ERROR'
    assert rooms.list() == []


def test_boundaries_unicode_and_edge_whitespace():
    for name in ('a', 'a' * 64, '😀' * 64):
        assert validate_room_name({'name': name}) == name
    assert validate_room_name({'name': ' \t General \r\n'}) == 'General'


@pytest.mark.parametrize('identity', [None, {'userId': 'forged'}, {'userId': '', 'sessionId': 's'}])
def test_requires_verified_identity(identity):
    rooms = RoomStore()
    with pytest.raises(RoomError) as caught:
        rooms.create(identity, {'name': 'General'})
    assert caught.value.code == 'UNAUTHORIZED'
    assert rooms.list() == []


def test_duplicate_names_unique_ids_and_isolated_snapshots():
    rooms = RoomStore()
    first = rooms.create(IDENTITY, {'name': 'General', 'roomId': 'forged', 'userId': 'forged'})
    second = rooms.create(IDENTITY, {'name': 'General'})
    assert first['roomId'] != second['roomId']
    assert first['roomId'] != 'forged'
    first['name'] = 'changed'
    listed = rooms.list()
    listed[0]['memberCount'] = 123
    listed.pop()
    assert rooms.list() == [dict(first, name='General'), second]


def test_id_collision_does_not_overwrite_room():
    rooms = RoomStore(new_id=lambda: 'same-id')
    first = rooms.create(IDENTITY, {'name': 'First'})
    with pytest.raises(RuntimeError):
        rooms.create(IDENTITY, {'name': 'Second'})
    assert rooms.list() == [first]


def test_catalogue_is_isolated_between_servers():
    first = RoomStore()
    first.create(IDENTITY, {'name': 'First'})
    assert RoomStore().list() == []


def test_threaded_creation_retains_unique_records():
    from concurrent.futures import ThreadPoolExecutor
    rooms = RoomStore()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda i: rooms.create(IDENTITY, {'name': f'Room {i}'}), range(20)))
    assert len({room['roomId'] for room in results}) == 20
    assert len(rooms.list()) == 20
