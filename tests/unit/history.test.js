const { HistoryStore } = require('../../src/history');
const { RoomStore } = require('../../src/rooms');
const { MessageService, registerMessageHandlers } = require('../../src/messages');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const identity = { userId:'sender',sessionId:'session' };
let store, rooms, room, service, folder;
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(),'team15-history-'));
  store = new HistoryStore(join(folder,'chat.sqlite'));
  rooms = new RoomStore({repository:store}); room = rooms.create(identity,{name:'General'});
  rooms.join(identity,'socket',{roomId:room.roomId});
  service = new MessageService({rooms,history:store});
});
afterEach(() => { store.close(); rmSync(folder,{recursive:true}); });
function send(content='Hello') { return service.send(identity,'socket',{roomId:room.roomId,content}); }
test('TC-Hist-01: rooms and messages survive closing and reopening SQLite', () => {
  const message = send(); store.delivered(message.messageId); store.close();
  store = new HistoryStore(join(folder,'chat.sqlite'));
  expect(store.get(message.messageId)).toMatchObject({...message,status:'Delivered'});
  expect(new RoomStore({repository:store}).list()).toEqual([{...room,memberCount:0}]);
});
test('TC-Hist-02: exact last 50 messages in stable creation order', () => {
  for(let i=0;i<55;i++)send('Message '+i);
  expect(store.history(room.roomId).map(m=>m.content)).toEqual(Array.from({length:50},(_,i)=>'Message '+(i+5)));
});
test('TC-Hist-03/04: Delivered follows broadcast; Read is per-recipient and idempotent', () => {
  const message=send(); expect(store.get(message.messageId).status).toBe('Sent');
  expect(()=>store.read(message.messageId,'reader')).toThrow();
  expect(store.delivered(message.messageId).status).toBe('Delivered');
  expect(()=>store.read(message.messageId,'sender')).toThrow(expect.objectContaining({code:'FORBIDDEN'}));
  store.read(message.messageId,'reader');store.read(message.messageId,'reader');
  const read=store.read(message.messageId,'second-reader');
  expect(read.status).toBe('Read');expect(read.readBy.map(r=>r.userId)).toEqual(['reader','second-reader']);
  expect(store.delivered(message.messageId).status).toBe('Read');
});
test('SQL parameters retain quoted content and isolate rooms', () => {
  const message=send("hello '); DROP TABLE users; --");
  expect(store.get(message.messageId).content).toBe(message.content);
  const second=rooms.create(identity,{name:'Other'});expect(store.history(second.roomId)).toEqual([]);
});
test('failed persistence prevents a broadcast or successful sender ACK', () => {
  store.save=()=>{throw Error('private database fault');};
  const handlers={},replies=[];
  const socket={id:'socket',data:{identity},on:(e,h)=>{handlers[e]=h;}};
  const emit=jest.fn();registerMessageHandlers(socket,service,{to:()=>({emit})});
  handlers['message:send']({roomId:room.roomId,content:'Hello'},r=>replies.push(r));
  expect(emit).not.toHaveBeenCalled();expect(replies[0]).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}});
});
test('nonmember cannot inspect history or mark another room read', () => {
  const message=send();store.delivered(message.messageId);
  const handlers={};const socket={id:'outside',data:{identity:{userId:'reader',sessionId:'s'}},on:(e,h)=>{handlers[e]=h;}};
  registerMessageHandlers(socket,service,{to:()=>({emit:()=>{}})});
  for(const [event,payload] of [['room:history',{roomId:room.roomId}],['message:read',{messageId:message.messageId}]]) {
    const result=[];handlers[event](payload,r=>result.push(r));expect(result[0].error.code).toBe('FORBIDDEN');
  }
});
