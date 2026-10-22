from time import time
from unicodedata import category
import jwt

ISSUER = 'team15-chat'
AUDIENCE = 'chat-application'
MAX_SAFE_INTEGER = 9007199254740991


def valid_number(value):
    return type(value) is int and abs(value) <= MAX_SAFE_INTEGER


class AuthError(Exception):
    code = 'UNAUTHORIZED'


class JwtAuth:
    def __init__(self, *, secret, find_session):
        if not isinstance(secret, str) or len(secret.encode('utf-8')) < 32 or not callable(find_session):
            raise ValueError('JWT configuration requires a secret of at least 32 bytes and a session lookup')
        self._secret = secret
        self._find_session = find_session

    def authenticate(self, credentials):
        try:
            token = credentials.get('token') if isinstance(credentials, dict) else None
            if not isinstance(token, str) or len(token) > 8192:
                raise ValueError()
            claims = jwt.decode(token, self._secret, algorithms=['HS256'], issuer=ISSUER, audience=AUDIENCE,
                                options={'require': ['sub', 'jti', 'iat', 'exp', 'iss', 'aud']})
            if not all(isinstance(claims[k], str) and 1 <= len(claims[k]) <= 128 and
                       not any(category(c) == 'Cs' for c in claims[k]) for k in ('sub', 'jti')) or not all(
                valid_number(claims[k]) for k in ('iat', 'exp')
            ) or claims['exp'] <= claims['iat'] or ('nbf' in claims and not valid_number(claims['nbf'])):
                raise ValueError()
            session = self._find_session(claims['jti'])
            if not isinstance(session, dict) or session.get('sessionId') != claims['jti'] or session.get('userId') != claims['sub'] or (
                'revokedAt' not in session or session['revokedAt'] is not None or
                not valid_number(session.get('expiresAt')) or session['expiresAt'] <= int(time())
            ):
                raise ValueError()
            if claims['exp'] <= int(time()):
                raise ValueError()
            return {'userId': claims['sub'], 'sessionId': claims['jti']}
        except Exception:
            raise AuthError('Session is not valid') from None

    def validate(self, context):
        try:
            verified = self.authenticate(context)
            return isinstance(context, dict) and context.get('identity') == verified
        except AuthError:
            return False
