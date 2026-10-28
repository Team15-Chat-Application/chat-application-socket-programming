const { roomChannel } = require('./rooms');
const { AppError, failure } = require('./errors');

function registerPresenceHandlers(io,socket,rooms,usernameFor=id=>id.slice(0,8)){
  const timers=new Map(),last=new Map();
  const identity=socket.data.identity;
  const userInfo=(userId,status)=>({userId,username:usernameFor(userId),status});
  function online(roomId){
    const ids=new Set();
    for(const peer of io.of('/').sockets.values())if(rooms.hasSocket(roomId,peer.id))ids.add(peer.data.identity.userId);
    return [...ids].map(id=>userInfo(id,'online'));
  }
  function requireRoom(payload){
    rooms.get(payload);
    if(!rooms.hasSocket(payload.roomId,socket.id))throw new AppError('FORBIDDEN','Join the room first');
  }
  socket.on('presence:list',(payload,ack)=>{
    try{requireRoom(payload);if(typeof ack==='function')ack({ok:true,data:{roomId:payload.roomId,users:online(payload.roomId)}});}
    catch(err){if(typeof ack==='function')ack(failure(err));}
  });
  socket.on('typing:set',(payload,ack)=>{
    try{
      requireRoom(payload);
      if(typeof payload.typing!=='boolean')throw new AppError('VALIDATION_ERROR','typing must be boolean');
      const now=Date.now(),roomId=payload.roomId;
      if(payload.typing&&now-(last.get(roomId)||0)<500){if(typeof ack==='function')ack({ok:true,data:{debounced:true}});return;}
      last.set(roomId,now);clearTimeout(timers.get(roomId));
      socket.to(roomChannel(roomId)).emit('presence:typing',{roomId,...userInfo(identity.userId,'online'),typing:payload.typing});
      if(payload.typing){const timer=setTimeout(()=>{timers.delete(roomId);if(socket.connected)socket.to(roomChannel(roomId)).emit('presence:typing',{roomId,userId:identity.userId,typing:false});},1500);timer.unref();timers.set(roomId,timer);}
      if(typeof ack==='function')ack({ok:true,data:{accepted:true}});
    }catch(err){if(typeof ack==='function')ack(failure(err));}
  });
  socket.on('disconnect',()=>{for(const timer of timers.values())clearTimeout(timer);});
}
module.exports={registerPresenceHandlers};
