from chat_backend.app import create_application


class FixtureAuth:
    """Injected transport-test adapter, not a JWT implementation."""
    def __init__(self):
        self.valid = True

    def authenticate(self, _credentials):
        return {'userId': 'fixture-user', 'sessionId': 'fixture-session'}

    def validate(self, _context):
        return self.valid


def test_http_health_and_missing_route():
    app, _socketio = create_application()
    client = app.test_client()
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json['data']['service'] == 'flask'
    assert client.post('/api/auth/login').status_code == 404


def test_default_socket_access_is_denied():
    app, socketio = create_application()
    client = socketio.test_client(app, auth={'token': 'fixture-only'})
    assert not client.is_connected()


def test_injected_auth_allows_diagnostic_acknowledgement():
    app, socketio = create_application(FixtureAuth())
    client = socketio.test_client(app, auth={'token': 'fixture-only'})
    try:
        assert client.is_connected()
        assert client.emit('system:ping', {'nonce': 'setup-check'}, callback=True) == {
            'ok': True, 'data': {'nonce': 'setup-check'}}
        assert client.emit('system:ping', {}, callback=True)['error']['code'] == 'VALIDATION_ERROR'
    finally:
        if client.is_connected():
            client.disconnect()


def test_invalidated_session_is_disconnected_before_next_event():
    auth = FixtureAuth()
    app, socketio = create_application(auth)
    client = socketio.test_client(app, auth={'token': 'fixture-only'})
    auth.valid = False
    client.emit('system:ping', {'nonce': 'blocked'})
    assert not client.is_connected()
