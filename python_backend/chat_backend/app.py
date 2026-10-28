from flask import Flask, request
from flask_socketio import SocketIO, disconnect, emit, join_room, leave_room
from functools import wraps
from contextlib import contextmanager
import json
from threading import RLock
from .rooms import RoomError, RoomStore, CATALOGUE_CHANNEL, room_channel
from .input import InputError
from .messages import MessageError, MessageService
from .login_limit import LoginLimiter


def failure(code, message):
    return {'ok': False, 'error': {'code': code, 'message': message}}


class UnavailableAuth:
    def authenticate(self, _credentials):
        return None

    def validate(self, _context):
        return False


def create_application(auth=None, rooms=None, login_limiter=None, login_handler=None, messages=None):
    auth = auth if auth is not None else UnavailableAuth()
    rooms = rooms if rooms is not None else RoomStore()
    login_limiter = login_limiter if login_limiter is not None else LoginLimiter()
    # Messaging gates on the same membership record the room handlers write.
    messages = messages if messages is not None else MessageService(rooms)
    app = Flask(__name__)
    socketio = SocketIO(app, async_mode='threading')
    identities = {}
    room_events = RLock()

    def audit(event, code):
        # Never log exception strings, tokens, credentials, payloads or message text.
        try:
            app.logger.warning(json.dumps({'event': event, 'code': code}))
        except Exception:
            pass  # A broken log sink must not break the event queue.

    def catalogue():
        socketio.emit('room:list-updated', {'rooms': rooms.list()}, to=CATALOGUE_CHANNEL)

    def membership(notice):
        socketio.emit('room:membership', notice, to=room_channel(notice['roomId']))

    @app.post('/api/auth/login')
    def login():
        # The peer address is authoritative; forwarded headers cannot reset a limit.
        limit = login_limiter.consume(request.remote_addr)
        if not limit['allowed']:
            audit('login', 'RATE_LIMITED')
            return failure('RATE_LIMITED', 'Too many login attempts'), 429, {'Retry-After': str(limit['retryAfter'])}
        if login_handler is None:
            return failure('NOT_FOUND', 'Endpoint not found'), 404
        try:
            return login_handler()
        except Exception:
            audit('login', 'INTERNAL_ERROR')
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
            audit('socket-connect', 'UNAUTHORIZED')
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
            audit('socket-validation', 'INTERNAL_ERROR')
            valid = False
        return valid and identities.get(request.sid) is context

    def reject_session():
        audit('socket-event', 'UNAUTHORIZED')
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
        acquired = room_events.acquire(blocking=False)
        # Three bounded waits, not an unbounded validation/lock retry loop.
        for _attempt in range(3):
            if acquired:
                break
            if not room_events.acquire(timeout=0.05):
                continue
            room_events.release()
            if not session_is_live(context):
                reject_session()
                raise RoomError('UNAUTHORIZED', 'Session is no longer valid')
            acquired = room_events.acquire(blocking=False)
        if not acquired:
            audit('room-dispatch', 'RATE_LIMITED')
            raise RoomError('RATE_LIMITED', 'Room dispatch is busy; retry later')
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
            audit('room-create', 'INTERNAL_ERROR')
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('room:join')
    @require_session
    def join_chat_room(payload=None):
        try:
            with live_room_events():
                room = rooms.get(payload)
                history = rooms.repository.history(room['roomId']) if rooms.repository is not None else None
                identity = identities[request.sid]['identity']
                channel = room_channel(room['roomId'])
                already_joined = rooms.has_socket(room['roomId'], request.sid)
                result = rooms.join(identity, request.sid, payload)
                try:
                    join_room(channel)
                except Exception:
                    try:
                        if not already_joined:
                            rooms.leave(identity, request.sid, payload)
                        (join_room if already_joined else leave_room)(channel)
                    except Exception:
                        disconnect()
                    raise
                if result['changed']:
                    membership({'roomId': room['roomId'], 'userId': identity['userId'],
                                'action': 'join', 'memberCount': result['room']['memberCount']})
                    catalogue()
                return {'ok': True, 'data': dict(result['room'], history=history) if history is not None else result['room']}
        except RoomError as error:
            return failure(error.code, str(error))
        except Exception:
            audit('room-join', 'INTERNAL_ERROR')
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('room:leave')
    @require_session
    def leave_chat_room(payload=None):
        try:
            with live_room_events():
                room = rooms.get(payload)
                identity = identities[request.sid]['identity']
                channel = room_channel(room['roomId'])
                already_joined = rooms.has_socket(room['roomId'], request.sid)
                result = rooms.leave(identity, request.sid, payload)
                try:
                    leave_room(channel)
                except Exception:
                    try:
                        if already_joined:
                            rooms.join(identity, request.sid, payload)
                        (join_room if already_joined else leave_room)(channel)
                    except Exception:
                        disconnect()
                    raise
                if result['changed']:
                    membership({'roomId': room['roomId'], 'userId': identity['userId'],
                                'action': 'leave', 'memberCount': result['room']['memberCount']})
                    catalogue()
                return {'ok': True, 'data': {'roomId': room['roomId']}}
        except RoomError as error:
            return failure(error.code, str(error))
        except Exception:
            audit('room-leave', 'INTERNAL_ERROR')
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('room:list')
    @require_session
    def list_rooms(payload=None):
        if not isinstance(payload, dict):
            return failure('VALIDATION_ERROR', 'payload must be an object')
        try:
            return {'ok': True, 'data': {'rooms': rooms.list()}}
        except Exception:
            audit('room-list', 'INTERNAL_ERROR')
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('message:send')
    @require_session
    def send_message(payload=None):
        try:
            with live_room_events():
                message = messages.send(identities[request.sid]['identity'], request.sid, payload)
                socketio.emit('message:received', message, to=room_channel(message['roomId']))
                if messages.history is not None:
                    message = messages.history.delivered(message['messageId'])
                    socketio.emit('message:status', message, to=room_channel(message['roomId']))
            # The sender's acknowledgement is returned only after the broadcast is
            # dispatched (CHAT-F-006). Per-recipient delivery confirmation is CHAT-24/25.
            return {'ok': True, 'data': message}
        except (RoomError, InputError, MessageError) as error:
            audit('message-send', error.code)
            return failure(error.code, str(error))
        except Exception:
            audit('message-send', 'INTERNAL_ERROR')
            return failure('INTERNAL_ERROR', 'An internal error occurred')

    @socketio.on('room:history')
    @require_session
    def room_history(payload=None):
        return history_event(payload, False)

    @socketio.on('message:read')
    @require_session
    def read_message(payload=None):
        return history_event(payload, True)

    def history_event(payload, mark_read):
        try:
            with live_room_events():
                if messages.history is None:
                    raise RoomError('NOT_FOUND','History storage is unavailable')
                if not isinstance(payload, dict):
                    raise RoomError('VALIDATION_ERROR','payload must be an object')
                room_id = payload.get('roomId')
                if mark_read:
                    mid = payload.get('messageId')
                    if not isinstance(mid,str) or not 1 <= len(mid) <= 128:
                        raise RoomError('VALIDATION_ERROR','Invalid messageId')
                    room_id = messages.history.get(mid)['roomId']
                rooms.get({'roomId':room_id})
                if not rooms.has_socket(room_id,request.sid):
                    raise RoomError('FORBIDDEN','Join the room first')
                if not mark_read:
                    return {'ok':True,'data':{'roomId':room_id,'messages':messages.history.history(room_id)}}
                message = messages.history.read(mid,identities[request.sid]['identity']['userId'])
                socketio.emit('message:status',message,to=room_channel(room_id))
                return {'ok':True,'data':message}
        except RoomError as error:
            return failure(error.code,str(error))
        except Exception:
            audit('message-history','INTERNAL_ERROR')
            return failure('INTERNAL_ERROR','An internal error occurred')

    @socketio.on('*')
    @require_session
    def unsupported_event(_event, *_args):
        return failure('NOT_FOUND', 'Event not found')

    return app, socketio
