import pytest
from chat_backend.runtime import create_runtime

@pytest.fixture
def runtime(tmp_path):
    result=create_runtime({'JWT_SECRET':'test-real-account-issuer-only-not-for-production-123456'},str(tmp_path/'chat.sqlite'))
    yield result
    result[-1]()

def account(http,name):
    assert http.post('/api/auth/register',json={'username':name,'password':'test-password'}).status_code==201
    return http.post('/api/auth/login',json={'username':name,'password':'test-password'}).json['data']

def test_real_login_messages_history_and_logout(runtime):
    app,sio,accounts,history,close=runtime;http=app.test_client()
    a,b=account(http,'Alice'),account(http,'Bob')
    sa=sio.test_client(app,auth={'token':a['token']});sb=sio.test_client(app,auth={'token':b['token']})
    try:
        room=sa.emit('room:create',{'name':'Team'},callback=True)['data'];payload={'roomId':room['roomId']}
        sa.emit('room:join',payload,callback=True);sb.emit('room:join',payload,callback=True)
        sent=sa.emit('message:send',dict(payload,content='Hello <b>team</b>'),callback=True)
        assert sent['data']['status']=='Delivered'
        assert sb.emit('message:read',{'messageId':sent['data']['messageId']},callback=True)['data']['status']=='Read'
        assert sb.emit('room:history',payload,callback=True)['data']['messages'][0]['content']=='Hello team'
        assert sa.emit('presence:list',payload,callback=True)['data']['users'][0]['status']=='online'
        assert http.post('/api/auth/logout',headers={'Authorization':'Bearer '+b['token']}).status_code==204
        assert not sb.is_connected()
        assert not sio.test_client(app,auth={'token':b['token']}).is_connected()
    finally:
        for s in (sa,sb):
            if s.is_connected():s.disconnect()

def test_actual_auth_limits_and_duplicate_name(runtime):
    http=runtime[0].test_client();account(http,'Alice')
    assert http.post('/api/auth/register',json={'username':'ALICE','password':'other'}).status_code==409
    for _ in range(4):assert http.post('/api/auth/login',json={}).status_code==401
    assert http.post('/api/auth/login',json={}).status_code==429

def test_typing_state_clears_when_typing_tab_disconnects_but_another_tab_remains(runtime):
    app,sio,accounts,history,_close=runtime;http=app.test_client()
    alice,bob=account(http,'TypingTabsAlice'),account(http,'TypingTabsBob')
    typing_tab=sio.test_client(app,auth={'token':alice['token']})
    idle_tab=sio.test_client(app,auth={'token':alice['token']})
    observer=sio.test_client(app,auth={'token':bob['token']})
    try:
        room=typing_tab.emit('room:create',{'name':'TypingTabs'},callback=True)['data']
        payload={'roomId':room['roomId']}
        for client in (typing_tab,idle_tab,observer):
            assert client.emit('room:join',payload,callback=True)['ok']
        observer.get_received()

        assert typing_tab.emit('typing:set',dict(payload,typing=True),callback=True)['ok']
        assert [event['args'][0]['typing'] for event in observer.get_received()
                if event['name']=='presence:typing']==[True]

        typing_tab.disconnect()
        events=observer.get_received()
        assert [event['args'][0]['typing'] for event in events
                if event['name']=='presence:typing']==[False]
        users=idle_tab.emit('presence:list',payload,callback=True)['data']['users']
        assert any(user['userId']==alice['user']['userId'] and user['status']=='online' for user in users)
    finally:
        for client in (typing_tab,idle_tab,observer):
            if client.is_connected():client.disconnect()

def test_typing_state_is_aggregated_across_active_tabs(runtime):
    app,sio,accounts,history,_close=runtime;http=app.test_client()
    alice,bob=account(http,'ConcurrentTypingAlice'),account(http,'ConcurrentTypingBob')
    first=sio.test_client(app,auth={'token':alice['token']})
    second=sio.test_client(app,auth={'token':alice['token']})
    observer=sio.test_client(app,auth={'token':bob['token']})
    try:
        room=first.emit('room:create',{'name':'ConcurrentTyping'},callback=True)['data']
        payload={'roomId':room['roomId']}
        for client in (first,second,observer):
            assert client.emit('room:join',payload,callback=True)['ok']
        observer.get_received()

        assert first.emit('typing:set',dict(payload,typing=True),callback=True)['ok']
        assert [event['args'][0]['typing'] for event in observer.get_received()
                if event['name']=='presence:typing']==[True]
        assert second.emit('typing:set',dict(payload,typing=True),callback=True)['ok']
        assert not [event for event in observer.get_received() if event['name']=='presence:typing']

        first.disconnect()
        assert not [event for event in observer.get_received() if event['name']=='presence:typing']
        second.disconnect()
        assert [event['args'][0]['typing'] for event in observer.get_received()
                if event['name']=='presence:typing']==[False]
    finally:
        for client in (first,second,observer):
            if client.is_connected():client.disconnect()
