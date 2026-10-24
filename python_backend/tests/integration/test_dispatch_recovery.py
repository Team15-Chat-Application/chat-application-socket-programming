"""Dispatch isolation and acknowledgement-failure recovery; no real login claim."""
from threading import Event, Thread
from threading import RLock
import pytest
from socketio import packet
from chat_backend.app import create_application
from chat_backend.rooms import RoomStore
from chat_backend import app as app_module


class FixtureAuth:
    def authenticate(self, credentials):
        user = credentials['token']
        return {'userId': user, 'sessionId': user}

    def validate(self, _context):
        return True


def test_slow_session_lookup_does_not_hold_other_users_room_or_ping_dispatch():
    entered, release, finished = Event(), Event(), Event()

    class SlowAuth(FixtureAuth):
        def validate(self, context):
            if context['identity']['userId'] == 'slow':
                entered.set()
                if not release.wait(5):
                    raise RuntimeError('Test coordinator did not release lookup')
            return True

    rooms = RoomStore()
    app, socketio = create_application(SlowAuth(), rooms)
    slow = socketio.test_client(app, auth={'token': 'slow'})
    fast = socketio.test_client(app, auth={'token': 'fast'})
    results, errors = {}, []

    def slow_request():
        try:
            results['slow'] = slow.emit('room:create', {'name': 'Slow'}, callback=True)
        except Exception as error:
            errors.append(error)

    def fast_requests():
        try:
            results['ping'] = fast.emit('system:ping', {'nonce': 'independent'}, callback=True)
            results['create'] = fast.emit('room:create', {'name': 'Independent'}, callback=True)
        except Exception as error:
            errors.append(error)
        finally:
            finished.set()

    threads = [Thread(target=slow_request, daemon=True), Thread(target=fast_requests, daemon=True)]
    try:
        threads[0].start()
        assert entered.wait(3)
        threads[1].start()
        assert finished.wait(2), 'A slow lookup must not globally block other sockets'
        assert not errors
        assert results['ping']['ok'] is True
        assert results['create']['ok'] is True
    finally:
        release.set()
        for thread in threads:
            if thread.ident is not None:
                thread.join(5)
        for client in (slow, fast):
            if client.is_connected():
                client.disconnect()
    assert not errors


def test_dispatch_recovers_after_ack_transport_failure(monkeypatch):
    rooms = RoomStore()
    app, socketio = create_application(FixtureAuth(), rooms)
    client = socketio.test_client(app, auth={'token': 'alice'})
    original = socketio.server._send_packet
    fail_once = [True]

    def send_packet(eio_sid, outgoing):
        if outgoing.packet_type == packet.ACK and fail_once[0]:
            fail_once[0] = False
            raise RuntimeError('ack transport failed')
        return original(eio_sid, outgoing)

    monkeypatch.setattr(socketio.server, '_send_packet', send_packet)
    try:
        # Flask-SocketIO sends the ACK after the handler returns. Even if that
        # transport step fails, the per-socket/room locks must already be released.
        with pytest.raises(RuntimeError, match='ack transport failed'):
            client.emit('room:create', {'name': 'First'}, callback=True)
        result = client.emit('room:list', {}, callback=True)
        assert result['ok'] is True
        assert [room['name'] for room in result['data']['rooms']] == ['First']
        assert client.emit('room:create', {'name': 'Second'}, callback=True)['ok'] is True
    finally:
        if client.is_connected():
            client.disconnect()


def test_room_contention_has_a_bounded_budget_and_recovers(monkeypatch):
    class BusyLock:
        def __init__(self):
            self.calls = []
            self.available = False

        def acquire(self, blocking=True, timeout=-1):
            self.calls.append((blocking, timeout))
            return self.available

        def release(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

    busy = BusyLock()
    first = [True]

    def lock_factory():
        if first[0]:
            first[0] = False
            return busy
        return RLock()

    monkeypatch.setattr(app_module, 'RLock', lock_factory)
    rooms = RoomStore()
    app, socketio = create_application(FixtureAuth(), rooms)
    client = socketio.test_client(app, auth={'token': 'alice'})
    try:
        result = client.emit('room:create', {'name': 'Busy'}, callback=True)
        assert result['error']['code'] == 'RATE_LIMITED'
        assert busy.calls == [(False, -1), (True, 0.05), (True, 0.05), (True, 0.05)]
        assert rooms.list() == []
        busy.available = True
        assert client.emit('room:create', {'name': 'Recovered'}, callback=True)['ok']
    finally:
        if client.is_connected():
            client.disconnect()
