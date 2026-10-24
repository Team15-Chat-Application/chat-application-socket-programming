from flask import Flask, request
from flask_socketio import SocketIO, disconnect, emit
from functools import wraps
from .rooms import RoomError, RoomStore


def failure(code, message):
    return {'ok': False, 'error': {'code': code, 'message': message}}


class UnavailableAuth:
    def authenticate(self, _credentials):
        return None

    def validate(self, _context):
        return False


def create_application(auth=None, rooms=None):
    auth = auth if auth is not None else UnavailableAuth()
    rooms = rooms if rooms is not None else RoomStore()
    app = Flask(__name__)
    socketio = SocketIO(app, async_mode='threading')
    identities = {}

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
                'userId': identity['userId'], 'sessionId': identity['sessionId']}}
        except Exception:
            return False

    @socketio.on('disconnect')
    def disconnected(_reason=None):
        identities.pop(request.sid, None)

    # Every future business handler must retain this guard.
    def require_session(handler):
        @wraps(handler)
        def guarded(*args, **kwargs):
            context = identities.get(request.sid)
            try:
                valid = context is not None and auth.validate(context) is True
            except Exception:
                valid = False
            if not valid:
                result = failure('UNAUTHORIZED', 'Session is no longer valid')
                emit('system:error', result)
                disconnect()
                return result
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
            room = rooms.create(identities[request.sid]['identity'], payload)
            return {'ok': True, 'data': room}
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

    return app, socketio
