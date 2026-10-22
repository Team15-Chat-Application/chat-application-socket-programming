// Test-only interop bridge. Fixture tokens/claims travel via stdin, not CLI arguments.
const jwt = require('jsonwebtoken');
const { createJwtAuth } = require('../../src/jwt-auth');
const { sanitizeMessage, sanitizeUsername } = require('../../src/input');
let input='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{input+=chunk;});
process.stdin.on('end',async()=>{
  try {
    const data=JSON.parse(input);
    let result;
    if(data.operation==='sign') result=jwt.sign(data.claims,data.secret,{algorithm:'HS256'});
    else if(data.operation==='verify') {
      const auth=createJwtAuth({secret:data.secret,findSession:async()=>data.session});
      result=await auth.validate({token:data.token,identity:data.identity});
    } else if(data.operation==='sanitize') {
      result=data.values.map(value=>{
        try { return {ok:true,value:(data.kind==='username'?sanitizeUsername:sanitizeMessage)(value)}; }
        catch(error) {return {ok:false,code:error.code};}
      });
    } else throw new Error();
    process.stdout.write(JSON.stringify(result));
  } catch {
    process.stderr.write('Security fixture operation failed');
    process.exitCode=1;
  }
});
