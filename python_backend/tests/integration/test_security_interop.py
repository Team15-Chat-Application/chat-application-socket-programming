import json
from pathlib import Path
import subprocess
from time import time
import jwt
import pytest
from chat_backend.jwt_auth import JwtAuth, ISSUER, AUDIENCE
from chat_backend.input import sanitize_username, sanitize_message, InputError

ROOT = Path(__file__).resolve().parents[3]
SECRET = 'test-only-security-edge-key-do-not-use-in-production-64-bytes-long'


def node_operation(**payload):
    result = subprocess.run(['node', str(ROOT/'tests/fixtures/security_bridge.js')],
                            input=json.dumps(payload), capture_output=True, text=True,
                            encoding='utf-8', cwd=ROOT, timeout=10, check=True)
    assert result.stderr == ''
    return json.loads(result.stdout)


@pytest.mark.parametrize('user_id', ['alice', 'Unicode-😀', '😀'*128])
def test_tc_sec_03_actual_jwt_tokens_are_verified_by_both_backends(user_id):
    now = int(time())
    claims = {'sub':user_id,'jti':'interop-session','iss':ISSUER,'aud':AUDIENCE,'iat':now,'exp':now+600}
    session = {'userId':user_id,'sessionId':'interop-session','expiresAt':now+600,'revokedAt':None}
    identity = {'userId':user_id,'sessionId':'interop-session'}
    node_token = node_operation(operation='sign', claims=claims, secret=SECRET)
    auth = JwtAuth(secret=SECRET, find_session=lambda _:session)
    assert auth.authenticate({'token':node_token}) == identity
    python_token = jwt.encode(claims,SECRET,algorithm='HS256')
    assert node_operation(operation='verify',token=python_token,secret=SECRET,session=session,identity=identity) is True
    session['revokedAt'] = now
    assert auth.validate({'token':node_token,'identity':identity}) is False
    assert node_operation(operation='verify',token=python_token,secret=SECRET,session=session,identity=identity) is False


@pytest.mark.parametrize('kind,values', [
    ('username',['a','a'*32,'a'*33,'alice\n','alice\r\n',{},None,'$ne',"x' OR 1=1 --",'😀']),
    ('message',['hello','x'*1999+'😀','😀'*2000,'😀'*2001,'\ufeff','\u00a0','\u2028','\u0085',
                '<SCRIPT SRC="//example.invalid/x.js"></SCRIPT>ok',
                '<img src=x onerror="alert(1)">safe','<b>bold<!--comment--></b>',
                '<svg><script>bad</script></svg>safe','&#x3c;script&#x3e;x&#x3c;/script&#x3e;',
                'a < 3 & b > 2','<iframe srcdoc="<script>x</script>">bad</iframe>ok',
                '<textarea>bad</textarea>ok','<script>x</script>','bad\x00',None,{'$ne':None}])
])
def test_tc_sec_05_cross_runtime_adversarial_corpus(kind, values):
    fn = sanitize_username if kind == 'username' else sanitize_message
    expected = []
    for value in values:
        try:
            expected.append({'ok':True,'value':fn(value)})
        except InputError:
            expected.append({'ok':False,'code':'VALIDATION_ERROR'})
    assert node_operation(operation='sanitize',kind=kind,values=values) == expected
