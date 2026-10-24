import pytest
from chat_backend import app as app_module
from chat_backend.rooms import RoomStore, room_channel


class FixtureAuth:
    def authenticate(self, credentials):
        return {'userId': credentials['token'], 'sessionId': 'session'}

    def validate(self, _context):
        return True


@pytest.mark.parametrize('operation', ['join', 'leave'])
@pytest.mark.parametrize('point', ['store', 'transport'])
def test_failed_room_operation_preserves_store_and_transport_membership(monkeypatch, operation, point):
    rooms = RoomStore()
    app, socketio = app_module.create_application(FixtureAuth(), rooms)
    client = socketio.test_client(app, auth={'token': 'alice'})
    payload = {'roomId': client.emit('room:create', {'name': 'Room'}, callback=True)['data']['roomId']}
    if operation == 'leave':
        assert client.emit('room:join', payload, callback=True)['ok']
    sid = socketio.server.manager.sid_from_eio_sid(client.eio_sid, '/')
    target = rooms if point == 'store' else app_module
    name = operation if point == 'store' else ('join_room' if operation == 'join' else 'leave_room')
    original = getattr(target, name)
    first = [True]

    def broken(*args, **kwargs):
        if first[0]:
            first[0] = False
            if point == 'transport':
                original(*args, **kwargs)  # Simulate a failure after the adapter side effect.
            raise RuntimeError('private failure detail')
        return original(*args, **kwargs)

    monkeypatch.setattr(target, name, broken)
    try:
        result = client.emit('room:' + operation, payload, callback=True)
        assert result == {'ok': False, 'error': {'code': 'INTERNAL_ERROR', 'message': 'An internal error occurred'}}
        expected = operation == 'leave'
        assert rooms.has_socket(payload['roomId'], sid) is expected
        assert (room_channel(payload['roomId']) in socketio.server.manager.get_rooms(sid, '/')) is expected
    finally:
        if client.is_connected():
            client.disconnect()


def test_auth_adapter_exception_has_redacted_audit_evidence(caplog):
    class BrokenAuth(FixtureAuth):
        def authenticate(self, credentials):
            raise RuntimeError('secret-token-and-password:' + credentials['token'])

    app, socketio = app_module.create_application(BrokenAuth())
    client = socketio.test_client(app, auth={'token': 'private-token'})
    assert not client.is_connected()
    assert 'socket-connect' in caplog.text and 'UNAUTHORIZED' in caplog.text
    assert 'private-token' not in caplog.text
    assert 'secret-token-and-password' not in caplog.text
