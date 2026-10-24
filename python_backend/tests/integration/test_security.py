from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import jwt
import pytest
from chat_backend.app import create_application
from chat_backend.jwt_auth import JwtAuth, ISSUER, AUDIENCE
from chat_backend.rooms import RoomStore
from chat_backend.login_limit import LoginLimiter

SECRET='test-only-security-edge-key-do-not-use-in-production-64-bytes-long'
BASE=1800000000


@pytest.fixture
def setup(monkeypatch):
    clock=[BASE]

    class ClockDateTime(datetime):
        @classmethod
        def now(cls,tz=None):
            return datetime.fromtimestamp(clock[0],timezone.utc).astimezone(tz)

    monkeypatch.setattr('jwt.api_jwt.datetime',ClockDateTime)
    monkeypatch.setattr('chat_backend.jwt_auth.time',lambda:clock[0])
    session={'userId':'user','sessionId':'session','expiresAt':BASE+600,'revokedAt':None}
    rooms=RoomStore()
    room_id=rooms.create({'userId':'user','sessionId':'session'},{'name':'Existing'})['roomId']
    app,socketio=create_application(JwtAuth(secret=SECRET,find_session=lambda _:session),rooms)
    token=jwt.encode({'sub':'user','jti':'session','iat':BASE-1,'exp':BASE+1,'iss':ISSUER,'aud':AUDIENCE},SECRET,algorithm='HS256')
    client=socketio.test_client(app,auth={'token':token})
    assert client.is_connected()
    yield clock,rooms,room_id,client
    if client.is_connected():
        client.disconnect()


@pytest.mark.parametrize('event',['system:ping','room:create','room:list','room:join','room:leave','unknown:event'])
def test_tc_sec_03_expired_signed_jwt_rejects_each_event_after_connection(setup,event):
    clock,rooms,room_id,client=setup
    client.emit('room:join',{'roomId':room_id},callback=True)
    assert rooms.has_member(room_id,'user')
    clock[0]=BASE+2
    client.emit(event,{'roomId':room_id,'name':'Must not create','nonce':'expired'})
    assert not client.is_connected()
    assert not rooms.has_member(room_id,'user')
    assert len(rooms.list())==1


def test_tc_sec_04_concurrent_http_requests_and_independent_peer_address():
    clock=[0]

    def fixture_login():
        return {'ok':False,'error':{'code':'UNAUTHORIZED','message':'Fixture login'}},401

    app,_=create_application(login_limiter=LoginLimiter(clock=lambda:clock[0]),login_handler=fixture_login)

    def attempt(index):
        with app.test_client() as client:
            response=client.post('/api/auth/login',headers={'X-Forwarded-For':f'192.0.2.{index}'},
                                 environ_overrides={'REMOTE_ADDR':'198.51.100.1'})
            return response.status_code,response.headers.get('Retry-After'),response.headers.get('Cache-Control')

    with ThreadPoolExecutor(max_workers=10) as executor:
        results=list(executor.map(attempt,range(20)))
    assert sum(status==401 for status,_,_ in results)==5
    assert sum(status==429 for status,_,_ in results)==15
    assert all(cache=='no-store' for _,_,cache in results)
    assert all(retry=='60' for status,retry,_ in results if status==429)
    with app.test_client() as client:
        assert client.post('/api/auth/login',environ_overrides={'REMOTE_ADDR':'198.51.100.2'}).status_code==401
        clock[0]=59999
        assert client.post('/api/auth/login',environ_overrides={'REMOTE_ADDR':'198.51.100.1'}).status_code==429
        clock[0]=60000
        assert client.post('/api/auth/login',environ_overrides={'REMOTE_ADDR':'198.51.100.1'}).status_code==401
