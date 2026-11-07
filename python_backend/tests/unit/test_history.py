import pytest
from chat_backend.history import HistoryStore
from chat_backend.rooms import RoomStore, RoomError
from chat_backend.messages import MessageService

IDENTITY = {'userId':'sender','sessionId':'session'}

@pytest.fixture
def setup(tmp_path):
    store = HistoryStore(str(tmp_path/'chat.sqlite'))
    rooms = RoomStore(repository=store)
    room = rooms.create(IDENTITY,{'name':'General'})
    rooms.join(IDENTITY,'socket',{'roomId':room['roomId']})
    yield store,rooms,room,MessageService(rooms,history=store)
    store.close()

def send(setup, content='Hello'):
    store,rooms,room,service=setup
    return service.send(IDENTITY,'socket',{'roomId':room['roomId'],'content':content})

def test_history_and_rooms_survive_restart(setup,tmp_path):
    store,rooms,room,service=setup
    message=send(setup);store.delivered(message['messageId'])
    second=HistoryStore(str(tmp_path/'chat.sqlite'))
    try:
        assert second.get(message['messageId'])['status']=='Delivered'
        assert RoomStore(repository=second).list()==[dict(room,memberCount=0)]
    finally:
        second.close()

def test_returns_only_last_50_in_creation_order(setup):
    for i in range(55):send(setup,f'Message {i}')
    assert [m['content'] for m in setup[0].history(setup[2]['roomId'])]==[f'Message {i}' for i in range(5,55)]

def test_per_recipient_read_is_idempotent_and_not_a_sender_ack(setup):
    store=setup[0];message=send(setup);mid=message['messageId']
    assert store.get(mid)['status']=='Sent'
    with pytest.raises(RoomError):store.read(mid,'reader')
    store.delivered(mid)
    with pytest.raises(RoomError):store.read(mid,'sender')
    store.read(mid,'reader');store.read(mid,'reader')
    assert store.read(mid,'other')['status']=='Read'
    assert len(store.get(mid)['readBy'])==2
    assert store.delivered(mid)['status']=='Read'

def test_isolated_room_and_quoted_content(setup):
    message=send(setup,"hello '); DROP TABLE users; --")
    assert setup[0].get(message['messageId'])['content']==message['content']
    room=setup[1].create(IDENTITY,{'name':'Other'})
    assert setup[0].history(room['roomId'])==[]
