import json
from pathlib import Path
from time import time
import pytest
import jwt
from chat_backend.jwt_auth import JwtAuth, AuthError, ISSUER, AUDIENCE
from chat_backend.login_limit import LoginLimiter
from chat_backend.input import sanitize_plain_text, sanitize_username, sanitize_message, InputError

SECRET = 'test-only-signing-key-with-at-least-32-bytes-never-use-in-production'


def make_token(overrides=None, key=SECRET, algorithm='HS256'):
    claims = {'sub': 'alice', 'jti': 'session', 'iss': ISSUER, 'aud': AUDIENCE, 'iat': int(time()), 'exp': int(time())+600}
    claims.update(overrides or {})
    if claims.get('exp') is None:
        claims.pop('exp')
    return jwt.encode(claims, key, algorithm=algorithm)


def test_tc_sec_03_signed_identity_and_live_revocation():
    session = {'userId': 'alice', 'sessionId': 'session', 'expiresAt': int(time())+600, 'revokedAt': None}
    auth = JwtAuth(secret=SECRET, find_session=lambda _: session)
    context = {'token': make_token(), 'identity': {'userId': 'alice', 'sessionId': 'session'}}
    assert auth.authenticate(context) == context['identity']
    assert auth.validate(context) is True
    assert auth.validate(dict(context, identity={'userId': 'mallory', 'sessionId': 'session'})) is False
    session['revokedAt'] = 1
    assert auth.validate(context) is False


@pytest.mark.parametrize('kind', ['expired', 'wrong-key', 'wrong-algorithm', 'missing-expiry', 'wrong-audience', 'future-iat'])
def test_tc_sec_03_invalid_tokens(kind):
    session = {'userId': 'alice', 'sessionId': 'session', 'expiresAt': int(time())+600, 'revokedAt': None}
    auth = JwtAuth(secret=SECRET, find_session=lambda _: session)
    invalid = {
        'expired': lambda: make_token({'exp': int(time())-1}),
        'wrong-key': lambda: make_token(key='different-test-only-key-with-32-bytes'),
        'wrong-algorithm': lambda: make_token(algorithm='HS384'),
        'missing-expiry': lambda: make_token({'exp': None}),
        'wrong-audience': lambda: make_token({'aud': 'other-app'}),
        'future-iat': lambda: make_token({'iat': int(time())+60})
    }[kind]()
    with pytest.raises(AuthError, match='Session is not valid'):
        auth.authenticate({'token': invalid})


def test_weak_configuration_and_missing_session_fail_closed():
    with pytest.raises(ValueError):
        JwtAuth(secret='short', find_session=lambda _: None)
    with pytest.raises(AuthError):
        JwtAuth(secret=SECRET, find_session=lambda _: None).authenticate({'token': make_token()})


def test_tc_sec_04_five_per_ip_sliding_window_boundary():
    now = [0]
    limiter = LoginLimiter(clock=lambda: now[0])
    for _ in range(5):
        assert limiter.consume('192.0.2.1')['allowed']
    assert limiter.consume('192.0.2.1') == {'allowed': False, 'retryAfter': 60}
    assert limiter.consume('192.0.2.2')['allowed']
    now[0] = 59999
    assert limiter.consume('192.0.2.1') == {'allowed': False, 'retryAfter': 1}
    now[0] = 60000
    assert limiter.consume('192.0.2.1')['allowed']


def test_bounded_capacity_reuses_expired_keys():
    now = [0]
    limiter = LoginLimiter(clock=lambda: now[0], max_keys=1)
    assert limiter.consume('a')['allowed']
    assert not limiter.consume('b')['allowed']
    now[0] = 60000
    assert limiter.consume('b')['allowed']


VECTORS = json.loads((Path(__file__).resolve().parents[3]/'contracts/input-vectors.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('vector', VECTORS)
def test_tc_sec_05_shared_vectors(vector):
    assert sanitize_plain_text(vector['input']) == vector['output']


@pytest.mark.parametrize('value', [None, {}, '', '<script>x</script>', 'x'*2001, '\ud800', 'bad\x00'])
def test_unsafe_or_empty_messages_fail(value):
    with pytest.raises(InputError):
        sanitize_message(value)


def test_unicode_boundary_and_username_validation():
    assert sanitize_message('😀'*2000) == '😀'*2000
    with pytest.raises(InputError):
        sanitize_message('😀'*2001)
    assert sanitize_username('alice_01.test') == 'alice_01.test'
    for value in ("x' OR 1=1 --", '<b>alice</b>', '$ne', 'alice bob', 'x'*33):
        with pytest.raises(InputError):
            sanitize_username(value)
