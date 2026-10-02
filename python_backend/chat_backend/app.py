from flask import Flask, request
from flask_socketio import SocketIO, disconnect, emit


def failure(code, message):
    return {'ok': False, 'error': {'code': code, 'message': message}}


class UnavailableAuth:
    def authenticate(self, _credentials):
        return None

    def validate(self, _context):
        return False


def create_application(auth=None):
    auth = auth if auth is not None else UnavailableAuth()
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

    # Every future business handler must use the same validate-before-dispatch rule.
    @socketio.on('system:ping')
    def ping(payload):
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
        nonce = payload.get('nonce') if isinstance(payload, dict) else None
        if not isinstance(nonce, str) or not 1 <= len(nonce) <= 64:
            return failure('VALIDATION_ERROR', 'nonce must contain 1 to 64 characters')
        return {'ok': True, 'data': {'nonce': nonce}}

    return app, socketio
