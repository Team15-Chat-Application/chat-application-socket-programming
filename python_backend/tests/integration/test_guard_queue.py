"""TC-Sec-03: a shared-room-lock wait must not reuse earlier JWT validation."""
from datetime import datetime, timezone
from threading import Event, RLock, Thread, current_thread
import jwt
from chat_backend import app as app_module
from chat_backend.jwt_auth import JwtAuth, ISSUER, AUDIENCE
from chat_backend.rooms import RoomStore

BASE = 1800000000
SECRET = 'test-only-queued-guard-signing-key-at-least-thirty-two-bytes'


def test_signed_jwt_expiring_while_waiting_for_shared_room_lock_cannot_mutate(monkeypatch):
    clock = [BASE]
    held, waiting, release = Event(), Event(), Event()

    class ClockDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime.fromtimestamp(clock[0], timezone.utc).astimezone(tz)

    class ObservedRoomLock:
        def __init__(self):
            self.inner = RLock()

        def __enter__(self):
            if current_thread().name == 'guard-waiter':
                waiting.set()
            self.inner.acquire()
            return self

        def __exit__(self, *_args):
            self.inner.release()

    class PausingRooms(RoomStore):
        def create(self, identity, payload):
            if payload.get('name') == 'Holding':
                held.set()
                if not release.wait(5):
                    raise RuntimeError('Test coordinator did not release room operation')
            return super().create(identity, payload)

    first_lock = [True]

    def lock_factory():
        if first_lock[0]:
            first_lock[0] = False
            return ObservedRoomLock()
        return RLock()

    monkeypatch.setattr('jwt.api_jwt.datetime', ClockDateTime)
    monkeypatch.setattr('chat_backend.jwt_auth.time', lambda: clock[0])
    monkeypatch.setattr(app_module, 'RLock', lock_factory)
    sessions = {}
    rooms = PausingRooms()
    app, socketio = app_module.create_application(JwtAuth(secret=SECRET, find_session=sessions.get), rooms)

    def client(user, expiry):
        sessions[user] = {'userId': user, 'sessionId': user, 'expiresAt': expiry, 'revokedAt': None}
        token = jwt.encode({'sub': user, 'jti': user, 'iat': BASE - 1, 'exp': expiry,
                            'iss': ISSUER, 'aud': AUDIENCE}, SECRET, algorithm='HS256')
        result = socketio.test_client(app, auth={'token': token})
        assert result.is_connected()
        return result

    holder, waiter = client('holder', BASE + 600), client('waiter', BASE + 1)
    results, errors = {}, []

    def create(key, connection, name):
        try:
            results[key] = connection.emit('room:create', {'name': name}, callback=True)
        except Exception as error:
            errors.append(error)

    threads = [Thread(target=create, name='guard-holder', args=('holder', holder, 'Holding'), daemon=True),
               Thread(target=create, name='guard-waiter', args=('waiter', waiter, 'Expired'), daemon=True)]
    try:
        threads[0].start()
        assert held.wait(3), 'Holder must own the shared room lock'
        threads[1].start()
        assert waiting.wait(3), 'Second event must reach the contended shared room lock'
        clock[0] = BASE + 2
        release.set()
        for thread in threads:
            thread.join(5)
        assert all(not thread.is_alive() for thread in threads)
        assert not errors
        assert results['holder']['ok'] is True
        assert not waiter.is_connected(), 'Expired waiting session must be rejected before dispatch'
        assert [room['name'] for room in rooms.list()] == ['Holding']
    finally:
        release.set()
        for thread in threads:
            if thread.ident is not None:
                thread.join(5)
        for connection in (holder, waiter):
            if connection.is_connected():
                connection.disconnect()
