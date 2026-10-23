from flask import Flask, request
from flask_socketio import SocketIO, disconnect, emit, join_room, leave_room
from functools import wraps
from contextlib import contextmanager
from threading import RLock
from .rooms import RoomError, RoomStore, CATALOGUE_CHANNEL, room_channel
from .login_limit import LoginLimiter


def failure(code, message):
    return {'ok': False, 'error': {'code': code, 'message': message}}


class UnavailableAuth:
    def authenticate(self, _credentials):
        return None

    def validate(self, _context):
        return False


def create_application(auth=None, rooms=None, login_limiter=None, login_handler=None):
    auth = auth if auth is not None else UnavailableAuth()
    rooms = rooms if rooms is not None else RoomStore()
    login_limiter = login_limiter if login_limiter is not None else LoginLimiter()
    app = Flask(__name__)
    socketio = SocketIO(app, async_mode='threading')
    identities = {}
    room_events = RLock()

    def catalogue():
        socketio.emit('room:list-updated', {'rooms': rooms.list()}, to=CATALOGUE_CHANNEL)

    def membership(notice):
        socketio.emit('room:membership', notice, to=room_channel(notice['roomId']))

    @app.post('/api/auth/login')
    def login():
        # The peer address is authoritative; forwarded headers cannot reset a limit.
        limit = login_limiter.consume(request.remote_addr)
        if not limit['allowed']:
            return failure('RATE_LIMITED', 'Too many login attempts'), 429, {'Retry-After': str(limit['retryAfter'])}
        if login_handler is None:
            return failure('NOT_FOUND', 'Endpoint not found'), 404
        try:
            return login_handler()
        except Exception:
            return failure('INTERNAL_ERROR', 'An internal error occurred'), 500

    @app.after_request
    def no_cache(response):
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/api/health')
    def health():
        response = app.json.response({'ok': True, 'data': {
            'status': 'ok', 'service': 'flask', 'stage': 'development-foundation'}})
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.errorhandler(404)
    def not_found(_error):
        return failure('NOT_FOUND', 'Endpoint not found'), 404

    @socketio.on('connect')
    def connect(credentials):
        credentials = credentials if isinstance(credentials, dict) else {}
        try:
            identity = auth.authenticate({'token': credentials.get('token')})
            if not isinstance(identity, dict) or not all(
                isinstance(identity.get(key), str) and identity[key]
                for key in ('userId', 'sessionId')
            ):
                return False
            identities[request.sid] = {'token': credentials.get('token'), 'identity': {
                'userId': identity['userId'], 'sessionId': identity['sessionId']}, 'lock': RLock()}
            join_room(CATALOGUE_CHANNEL)
            emit('room:list-updated', {'rooms': rooms.list()})
        except Exception:
            return False

    @socketio.on('disconnect')
    def disconnected(_reason=None):
        context = identities.pop(request.sid, None)
        if context is not None:
            with context['lock'], room_events:
                notices = rooms.disconnect(request.sid)
                for notice in notices:
                    membership(notice)
                if notices:
                    catalogue()

    def session_is_live(context):
        try:
            valid = auth.validate({'token': context['token'], 'identity': dict(context['identity'])}) is True
        except Exception:
            valid = False
        return valid and identities.get(request.sid) is context

    def reject_session():
        result = failure('UNAUTHORIZED', 'Session is no longer valid')
        emit('system:error', result)
        disconnect()
        return result

    @contextmanager
    def live_room_events():
        # The caller holds its own context lock. A potentially slow session
        # lookup must never hold the shared room lock. If acquisition waits,
        # revalidate outside it, then retry without waiting on stale validation.
        context = identities[request.sid]
        while not room_events.acquire(blocking=False):
            with room_events:
                pass
            if not session_is_live(context):
                reject_session()
                raise RoomError('UNAUTHORIZED', 'Session is no longer valid')
        try:
            yield
        finally:
            room_events.release()

    # Every future business handler must retain this guard and use
    # live_room_events for shared room mutations/dispatch.
    def require_session(handler):
        @wraps(handler)
        def guarded(*args, **kwargs):
            context = identities.get(request.sid)
            if context is None:
                result = failure('UNAUTHORIZED', 'Session is no longer valid')
                emit('system:error', result)
                disconnect()
                return result
            with context['lock']:
                if not session_is_live(context):
                    return reject_session()
                return handler(*args, **kwargs)
        return guarded

    @socketio.on('system:ping')
    @require_session
    def ping(payload=None):
        nonce = payload.get('nonce') if isinstance(payload, dict) else None
        if not isinstance(nonce, str) or not 1 <= len(nonce) <= 64:
            return failure('VALIDATION_ERROR', 'nonce must contain 1 to 64 characters')
        return {'ok': True, 'data': {'nonce': nonce}}

    @socketio.on('room:create')
    @require_session
    def create_room(payload=None):
        try:
            with live_room_events():
                room = rooms.create(identities[request.sid]['identity'], payload)
                catalogue()
            return {'ok': True, 'data': room}
        except RoomError as error:
            return failure(error.code, str(error))
        except Exception:
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('room:join')
    @require_session
    def join_chat_room(payload=None):
        try:
            with live_room_events():
                room = rooms.get(payload)
                join_room(room_channel(room['roomId']))
                identity = identities[request.sid]['identity']
                result = rooms.join(identity, request.sid, payload)
                if result['changed']:
                    membership({'roomId': room['roomId'], 'userId': identity['userId'],
                                'action': 'join', 'memberCount': result['room']['memberCount']})
                    catalogue()
                return {'ok': True, 'data': result['room']}
        except RoomError as error:
            return failure(error.code, str(error))
        except Exception:
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('room:leave')
    @require_session
    def leave_chat_room(payload=None):
        try:
            with live_room_events():
                room = rooms.get(payload)
                leave_room(room_channel(room['roomId']))
                identity = identities[request.sid]['identity']
                result = rooms.leave(identity, request.sid, payload)
                if result['changed']:
                    membership({'roomId': room['roomId'], 'userId': identity['userId'],
                                'action': 'leave', 'memberCount': result['room']['memberCount']})
                    catalogue()
                return {'ok': True, 'data': {'roomId': room['roomId']}}
        except RoomError as error:
            return failure(error.code, str(error))
        except Exception:
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('room:list')
    @require_session
    def list_rooms(payload=None):
        if not isinstance(payload, dict):
            return failure('VALIDATION_ERROR', 'payload must be an object')
        try:
            return {'ok': True, 'data': {'rooms': rooms.list()}}
        except Exception:
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('*')
    @require_session
    def unsupported_event(_event, *_args):
        return failure('NOT_FOUND', 'Event not found')

    return app, socketio
