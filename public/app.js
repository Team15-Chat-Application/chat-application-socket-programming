/* Same-origin client. Credentials and JWTs never enter persistent browser storage. */
'use strict';
const $=id=>document.getElementById(id);
$('messages').tabIndex=0;
let session=null,socket=null,registering=false,active=null;
const rooms=new Map(),joined=new Set(),messages=new Map(),unread=new Map(),reading=new Set();
const decode=value=>String(value??'').replace(/&(lt|gt|amp|quot|#39);/g,(_,key)=>({lt:'<',gt:'>',amp:'&',quot:'"','#39':"'"}[key]));
function notice(text){$('notice').textContent=text;}
async function api(route,data,token){
  const response=await fetch('/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});
  if(response.status===204)return null;
  const result=await response.json();if(!response.ok)throw Error(result.error?.message||'Request failed');
  return result.data||result;
}
function emit(event,payload){
  return new Promise((resolve,reject)=>{
    if(!socket?.connected){reject(Error('Connection unavailable. Your draft is kept; try again once connected.'));return;}
    socket.timeout(5000).emit(event,payload,(error,result)=>error?reject(Error('No confirmation received. Check history before retrying.')):result?.ok?resolve(result.data):reject(Error(result?.error?.message||'Request failed')));
  });
}
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
function renderRooms(){
  const focused=document.activeElement?.dataset?.room;
  $('room-count').textContent=String(rooms.size);$('room-list').replaceChildren();
  for(const room of rooms.values()){
    const button=node('button','room-button');button.type='button';button.dataset.room=room.roomId;
    button.setAttribute('aria-current',String(active===room.roomId));
    button.append(node('span','room-name','# '+decode(room.name)));
    const meta=node('span','room-meta',String(room.memberCount));
    if(unread.get(room.roomId)){const badge=node('span','unread',String(unread.get(room.roomId)));badge.setAttribute('aria-label',unread.get(room.roomId)+' unread');meta.append(badge);}
    button.append(meta);button.addEventListener('click',()=>openRoom(room.roomId).catch(error=>notice(error.message)));$('room-list').append(button);
  }
  if(focused)$('room-list').querySelector(`[data-room="${CSS.escape(focused)}"]`)?.focus();
}
function markRead(message){
  if(!session||message.senderId===session.user.userId||message.status==='Sent'||!message.status||reading.has(message.messageId)||message.readBy?.some(r=>r.userId===session.user.userId)||document.hidden)return;
  reading.add(message.messageId);emit('message:read',{messageId:message.messageId}).catch(()=>{}).finally(()=>reading.delete(message.messageId));
}
function renderMessages(){
  const log=$('messages');const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<100;log.replaceChildren();
  for(const message of messages.get(active)||[]){
    const mine=message.senderId===session?.user.userId;
    const row=node('li','message-row'+(mine?' mine':''));row.dataset.message=message.messageId;
    const meta=node('div','message-meta');meta.append(node('strong','',mine?'You':message.senderName||message.senderId.slice(0,8)),node('span','',new Date(message.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
    row.append(meta,node('div','bubble',decode(message.content)));
    if(mine)row.append(node('div','receipt',message.status||'Sent'));
    log.append(row);markRead(message);
  }
  if(nearBottom)log.scrollTop=log.scrollHeight;
}
function merge(roomId,items){
  const map=new Map((messages.get(roomId)||[]).map(m=>[m.messageId,m]));
  for(const item of items)map.set(item.messageId,{...map.get(item.messageId),...item});
  messages.set(roomId,[...map.values()]);
}
async function refreshPeople(){
  if(!active)return;
  try{const data=await emit('presence:list',{roomId:active});$('people').replaceChildren(...data.users.map(user=>node('li','person',user.username+(user.userId===session.user.userId?' (you)':''))));}catch{ /* Connection state is shown separately. */ }
}
async function openRoom(roomId){
  const result=await emit('room:join',{roomId});joined.add(roomId);active=roomId;unread.set(roomId,0);
  if(result.history){const live=messages.get(roomId)||[];messages.set(roomId,[]);merge(roomId,result.history);merge(roomId,live);}
  else{const history=await emit('room:history',{roomId});merge(roomId,history.messages);}
  $('room-title').textContent='# '+decode(rooms.get(roomId)?.name||result.name);$('empty-chat').hidden=true;$('message-form').hidden=false;$('leave-room').hidden=false;$('typing').textContent='';
  renderRooms();renderMessages();await refreshPeople();$('message').focus();
}
function resetSession(text='Signed out.'){
  socket?.disconnect();socket=null;session=null;active=null;rooms.clear();joined.clear();messages.clear();unread.clear();reading.clear();
  $('auth').hidden=false;$('workspace').hidden=true;$('logout').hidden=true;$('account-name').textContent='';$('auth-error').textContent='';notice(text);$('username').focus();
}
function connect(){
  socket=io({autoConnect:false,auth:{token:session.token},reconnectionDelay:500,reconnectionDelayMax:10000});
  socket.on('connect',async()=>{
    $('connection').textContent='Connected';notice('');
    for(const roomId of joined){try{const result=await emit('room:join',{roomId});if(result.history)merge(roomId,result.history);}catch{joined.delete(roomId);}}
    if(active){renderMessages();refreshPeople();}
  });
  socket.on('disconnect',()=>{$('connection').textContent='Reconnecting…';});
  socket.on('connect_error',error=>{if(error.data?.code==='UNAUTHORIZED'||error.data?.code==='AUTH_NOT_IMPLEMENTED')resetSession(error.message);else notice('Unable to connect. Retrying…');});
  socket.on('system:error',result=>resetSession(result.error?.message||'Please sign in again.'));
  socket.on('room:list-updated',data=>{rooms.clear();for(const room of data.rooms)rooms.set(room.roomId,room);renderRooms();});
  socket.on('room:membership',data=>{if(active===data.roomId){refreshPeople();if(data.action==='leave')$('typing').textContent='';}});
  socket.on('presence:changed',data=>{if(active===data.roomId)refreshPeople();});
  socket.on('presence:typing',data=>{if(data.roomId===active)$('typing').textContent=data.typing?(data.username||'Someone')+' is typing…':'';});
  socket.on('message:received',message=>{
    const fresh=!(messages.get(message.roomId)||[]).some(m=>m.messageId===message.messageId);merge(message.roomId,[message]);
    if(active===message.roomId){renderMessages();$('typing').textContent='';}
    else if(fresh&&message.senderId!==session?.user.userId){unread.set(message.roomId,(unread.get(message.roomId)||0)+1);renderRooms();notice('New message in #'+decode(rooms.get(message.roomId)?.name||'another room'));}
  });
  socket.on('message:status',message=>{merge(message.roomId,[message]);if(active===message.roomId)renderMessages();});
  socket.connect();
}
$('auth-toggle').addEventListener('click',()=>{registering=!registering;$('auth-title').textContent=registering?'Create your account':'Sign in to your space';$('auth-kicker').textContent=registering?'MAKE YOURSELF AT HOME':'WELCOME BACK';$('auth-submit').textContent=registering?'Create account':'Sign in';$('auth-toggle').textContent=registering?'Already have an account? Sign in':'New here? Create an account';$('password').autocomplete=registering?'new-password':'current-password';$('auth-error').textContent='';});
$('auth-form').addEventListener('submit',async event=>{
  event.preventDefault();$('auth-error').textContent='';$('auth-submit').disabled=true;
  const credentials={username:$('username').value,password:$('password').value};
  try{
    if(registering){await api('register',credentials);registering=false;$('auth-toggle').textContent='New here? Create an account';$('auth-title').textContent='Sign in to your space';$('auth-submit').textContent='Sign in';notice('Account created. Signing you in…');}
    session=await api('login',credentials);$('password').value='';$('auth').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('account-name').textContent=session.user.username;
    connect();
  }catch(error){$('auth-error').textContent=error.message;}finally{$('auth-submit').disabled=false;}
});
$('logout').addEventListener('click',async()=>{try{await api('logout',null,session?.token);}catch{ /* Clear local access even if already expired. */ }resetSession();});
$('room-form').addEventListener('submit',async event=>{event.preventDefault();try{const room=await emit('room:create',{name:$('room-name').value});$('room-name').value='';await openRoom(room.roomId);}catch(error){notice(error.message);}});
$('leave-room').addEventListener('click',async()=>{try{await emit('room:leave',{roomId:active});joined.delete(active);active=null;$('room-title').textContent='Choose a room';$('messages').replaceChildren();$('people').replaceChildren();$('message-form').hidden=true;$('leave-room').hidden=true;$('empty-chat').hidden=false;renderRooms();}catch(error){notice(error.message);}});
$('message').addEventListener('input',()=>{const length=[...$('message').value].length;$('counter').textContent=length+' / 2000';$('send').disabled=length>2000;if(active)emit('typing:set',{roomId:active,typing:!!length}).catch(()=>{});});
$('message').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('message-form').requestSubmit();}});
$('message-form').addEventListener('submit',async event=>{event.preventDefault();const content=$('message').value;if(!content.trim()||[...content].length>2000)return;const roomId=active;$('send').disabled=true;try{const message=await emit('message:send',{roomId,content});merge(roomId,[message]);if($('message').value===content)$('message').value='';$('counter').textContent=[...$('message').value].length+' / 2000';renderMessages();emit('typing:set',{roomId,typing:false}).catch(()=>{});notice('');}catch(error){notice(error.message);}finally{$('send').disabled=false;}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)renderMessages();});
