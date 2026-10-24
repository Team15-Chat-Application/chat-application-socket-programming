import pytest
from chat_backend.app import create_application
from chat_backend.rooms import RoomStore


class FixtureAuth:
    """Explicit transport fixture; does not implement JWT authentication."""
    valid = True

    def authenticate(self, credentials):
        if credentials.get('token') != 'fixture-only':
            return None
        return {'userId': 'fixture-user', 'sessionId': 'fixture-session'}

    def validate(self, _context):
        return self.valid


@pytest.fixture
def setup():
    auth, rooms = FixtureAuth(), RoomStore()
    app, socketio = create_application(auth, rooms)
    clients = []

    def client():
        socket = socketio.test_client(app, auth={'token': 'fixture-only'})
        clients.append(socket)
        assert socket.is_connected()
        return socket

    yield auth, rooms, client
    for socket in clients:
        if socket.is_connected():
            socket.disconnect()


def test_tc_room_01_created_room_visible_to_another_client(setup):
    _auth, _rooms, client = setup
    creator, observer = client(), client()
    assert observer.emit('room:list', {}, callback=True) == {'ok': True, 'data': {'rooms': []}}
    result = creator.emit('room:create', {'name': ' General ', 'roomId': 'forged', 'userId': 'forged'}, callback=True)
    assert result['ok'] is True
    assert result['data']['name'] == 'General'
    assert result['data']['memberCount'] == 0
    assert result['data']['roomId'] != 'forged'
    assert observer.emit('room:list', {}, callback=True) == {'ok': True, 'data': {'rooms': [result['data']]}}
    duplicate = creator.emit('room:create', {'name': 'General'}, callback=True)
    assert duplicate['data']['roomId'] != result['data']['roomId']


def test_validation_failures_leave_catalogue_empty_and_unicode_boundary_passes(setup):
    _auth, rooms, client = setup
    socket = client()
    for payload in (None, [], {}, {'name': ' '}, {'name': 'a' * 65}, {'name': 'bad\x00'}):
        result = socket.emit('room:create', payload, callback=True)
        assert result['error']['code'] == 'VALIDATION_ERROR'
    assert rooms.list() == []
    assert socket.emit('room:list', [], callback=True)['error']['code'] == 'VALIDATION_ERROR'
    assert socket.emit('room:create', {'name': '😀' * 64}, callback=True)['ok'] is True


@pytest.mark.parametrize('event', ['room:create', 'room:list'])
def test_invalidated_session_cannot_dispatch_room_event(setup, event):
    auth, rooms, client = setup
    socket = client()
    auth.valid = False
    socket.emit(event, {'name': 'Blocked'})
    assert not socket.is_connected()
    assert rooms.list() == []


def test_default_authentication_denies_room_access():
    rooms = RoomStore()
    app, socketio = create_application(rooms=rooms)
    socket = socketio.test_client(app, auth={'token': 'fixture-only'})
    assert not socket.is_connected()
    assert rooms.list() == []


def test_internal_failure_is_safe_and_does_not_change_catalogue():
    def fail():
        raise RuntimeError('secret database credentials')
    rooms = RoomStore(new_id=fail)
    app, socketio = create_application(FixtureAuth(), rooms)
    socket = socketio.test_client(app, auth={'token': 'fixture-only'})
    try:
        assert socket.emit('room:create', {'name': 'General'}, callback=True) == {
            'ok': False, 'error': {'code': 'INTERNAL_ERROR', 'message': 'An internal error occurred'}}
        assert rooms.list() == []
    finally:
        socket.disconnect()
