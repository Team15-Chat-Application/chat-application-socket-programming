from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import jwt
import pytest
from chat_backend.jwt_auth import JwtAuth, AuthError, ISSUER, AUDIENCE
from chat_backend.login_limit import LoginLimiter
from chat_backend.input import sanitize_username, sanitize_message, InputError

SECRET = 'test-only-security-edge-key-do-not-use-in-production-64-bytes-long'
BASE = 1800000000


def signed(overrides=None, removed=()):
    claims = {'sub':'user','jti':'session','iat':BASE-10,'exp':BASE+120,'iss':ISSUER,'aud':AUDIENCE}
    claims.update(overrides or {})
    for field in removed:
        claims.pop(field)
    return jwt.encode(claims, SECRET, algorithm='HS256')


@pytest.fixture
def setup(monkeypatch):
    clock = [BASE]

    class ClockDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime.fromtimestamp(clock[0], timezone.utc).astimezone(tz)

    monkeypatch.setattr('jwt.api_jwt.datetime', ClockDateTime)
    monkeypatch.setattr('chat_backend.jwt_auth.time', lambda: clock[0])
    session = {'userId':'user','sessionId':'session','expiresAt':BASE+120,'revokedAt':None}
    return clock, session, JwtAuth(secret=SECRET, find_session=lambda _: session)


@pytest.mark.parametrize('field', ['sub','jti','iat','exp','iss','aud'])
def test_tc_sec_03_required_claims(setup, field):
    _, _, auth = setup
    with pytest.raises(AuthError):
        auth.authenticate({'token':signed(removed=[field])})


@pytest.mark.parametrize('claims', [
    {'sub':''}, {'sub':42}, {'jti':[]}, {'jti':''}, {'iat':'1800000000'}, {'iat':True}, {'iat':BASE+.5},
    {'exp':str(BASE+120)}, {'exp':True}, {'exp':BASE+.5}, {'exp':BASE-10}, {'iat':BASE+1},
    {'nbf':BASE+1}, {'nbf':'0'}, {'nbf':-9007199254740992},
    {'iss':'untrusted'}, {'aud':'other-app'}, {'sub':'\ud800'}, {'jti':'x'*129}
])
def test_tc_sec_03_invalid_claims(setup, claims):
    _, _, auth = setup
    with pytest.raises(AuthError, match='Session is not valid'):
        auth.authenticate({'token':signed(claims)})


@pytest.mark.parametrize('override', [None, {}, {'sessionId':'other'}, {'userId':'other'}, {'revokedAt':0},
    {'removeRevocation':True}, {'expiresAt':BASE}, {'expiresAt':str(BASE+120)}, {'expiresAt':9007199254740992}])
def test_tc_sec_03_invalid_session_records(setup, override):
    _, session, _ = setup
    if override is not None:
        session.update(override)
        if not override:
            session.clear()
        elif override.get('removeRevocation'):
            session.pop('revokedAt')
    auth = JwtAuth(secret=SECRET, find_session=lambda _: session if override is not None else None)
    with pytest.raises(AuthError):
        auth.authenticate({'token':signed()})


def test_lookup_error_is_redacted(setup):
    def lookup(_):
        raise RuntimeError('private database connection string')
    auth = JwtAuth(secret=SECRET, find_session=lookup)
    with pytest.raises(AuthError, match='Session is not valid'):
        auth.authenticate({'token':signed()})


def test_session_expiry_during_lookup_fails_closed(setup):
    clock, session, _ = setup
    session['expiresAt'] = BASE+1

    def lookup(_):
        clock[0] = BASE+2
        return session

    with pytest.raises(AuthError):
        JwtAuth(secret=SECRET, find_session=lookup).authenticate({'token':signed()})


def test_opaque_unicode_identity_code_point_boundary(setup):
    _, session, auth = setup
    session['userId'] = '😀'*128
    assert auth.authenticate({'token':signed({'sub':session['userId']})}) == {'userId':session['userId'],'sessionId':'session'}


@pytest.mark.parametrize('field',['sub','jti'])
def test_malformed_unicode_in_matched_identity_is_rejected(setup,field):
    _,session,auth=setup
    session['userId' if field=='sub' else 'sessionId']='\ud800'
    with pytest.raises(AuthError):
        auth.authenticate({'token':signed({field:'\ud800'})})


def test_tc_sec_04_rolling_window_and_independent_ips():
    clock = [0]
    limiter = LoginLimiter(clock=lambda: clock[0])
    for t in [0,15000,30000,45000,59000]:
        clock[0] = t
        assert limiter.consume('peer')['allowed']
    clock[0] = 59999
    assert limiter.consume('peer') == {'allowed':False,'retryAfter':1}
    clock[0] = 60000
    assert limiter.consume('peer')['allowed']
    clock[0] = 60001
    assert limiter.consume('peer') == {'allowed':False,'retryAfter':15}
    clock[0] = 75000
    assert limiter.consume('peer')['allowed']
    assert limiter.consume('independent-peer')['allowed']


def test_tc_sec_04_threaded_same_peer_has_exactly_five_allowed_attempts():
    limiter = LoginLimiter(clock=lambda: 0)
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(lambda _: limiter.consume('peer'), range(50)))
    assert sum(result['allowed'] for result in results) == 5


@pytest.mark.parametrize('value', ['alice\n','alice\r','alice\r\n','a\u2028','a\u2029','a\x00','a\t',[],None,{},'x'*33])
def test_tc_sec_05_username_boundaries(value):
    with pytest.raises(InputError):
        sanitize_username(value)


def test_tc_sec_05_raw_length_checked_before_stripping_markup():
    with pytest.raises(InputError):
        sanitize_message('<b>'+'x'*2000+'</b>')
    assert sanitize_message('x'*1999+'😀') == 'x'*1999+'😀'
    assert sanitize_username('a') == 'a'
    assert sanitize_username('a'*32) == 'a'*32
