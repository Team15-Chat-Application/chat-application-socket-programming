const { createHmac } = require('node:crypto');
const { createJwtAuth, ISSUER, AUDIENCE } = require('../../src/jwt-auth');
const { LoginLimiter } = require('../../src/login-limit');
const { sanitizeUsername, sanitizeMessage } = require('../../src/input');
const SECRET = 'test-only-security-edge-key-do-not-use-in-production-64-bytes-long';
const BASE = 1800000000;
function signed(overrides = {}, removed = [], header = { alg: 'HS256', typ: 'JWT' }) {
  const payload = { sub: 'user', jti: 'session', iat: BASE-10, exp: BASE+120, iss: ISSUER, aud: AUDIENCE, ...overrides };
  removed.forEach(key => delete payload[key]);
  const unsigned = [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return unsigned + '.' + createHmac('sha256', SECRET).update(unsigned).digest('base64url');
}
let now, session, auth;
beforeEach(() => {
  now=BASE;
  jest.spyOn(Date,'now').mockImplementation(()=>now*1000);
  session={ userId:'user',sessionId:'session',expiresAt:BASE+120,revokedAt:null };
  auth=createJwtAuth({secret:SECRET,findSession:async()=>session});
});
afterEach(()=>jest.restoreAllMocks());

test.each(['sub','jti','iat','exp','iss','aud'])('TC-Sec-03 requires %s', async field => {
  await expect(auth.authenticate({token:signed({},[field])})).rejects.toMatchObject({code:'UNAUTHORIZED'});
});
test.each([
  {sub:''}, {sub:42}, {jti:[]}, {jti:''}, {iat:'1800000000'}, {iat:true}, {iat:BASE+.5},
  {exp:String(BASE+120)}, {exp:true}, {exp:BASE+.5}, {exp:BASE-10}, {iat:BASE+1},
  {nbf:BASE+1}, {nbf:'0'}, {nbf:-Number.MAX_SAFE_INTEGER-1},
  {iss:'untrusted'}, {aud:'other-app'}, {sub:'\ud800'}, {jti:'x'.repeat(129)}
])('TC-Sec-03 rejects malformed identity/time/issuer claims %#',async claims=>{
  await expect(auth.authenticate({token:signed(claims)})).rejects.toMatchObject({code:'UNAUTHORIZED',message:'Session is not valid'});
});
test.each([null,{}, {sessionId:'other'}, {userId:'other'}, {revokedAt:0},
  {revokedAt:undefined}, {expiresAt:BASE}, {expiresAt:String(BASE+120)}, {expiresAt:Number.MAX_SAFE_INTEGER+1}])(
  'TC-Sec-03 rejects missing, mismatched, revoked or expired session record %#',async override=>{
    session=override===null ? null : {...session,...override};
    if(override && override.revokedAt===undefined && Object.hasOwn(override,'revokedAt')) delete session.revokedAt;
    if(override && Object.keys(override).length===0) session={};
    await expect(auth.authenticate({token:signed()})).rejects.toMatchObject({code:'UNAUTHORIZED'});
  });
test('lookup failures do not reveal backend details',async()=>{
  auth=createJwtAuth({secret:SECRET,findSession:async()=>{throw new Error('private database connection string');}});
  await expect(auth.authenticate({token:signed()})).rejects.toMatchObject({code:'UNAUTHORIZED',message:'Session is not valid'});
});
test('session expiry during an asynchronous lookup fails closed',async()=>{
  session.expiresAt=BASE+1;
  auth=createJwtAuth({secret:SECRET,findSession:async()=>{now=BASE+2;return session;}});
  await expect(auth.authenticate({token:signed()})).rejects.toMatchObject({code:'UNAUTHORIZED'});
});
test('opaque Unicode identity uses the same code-point limit as Python',async()=>{
  session.userId='😀'.repeat(128);
  expect(await auth.authenticate({token:signed({sub:session.userId})})).toEqual({userId:session.userId,sessionId:'session'});
});
test.each(['sub','jti'])('malformed Unicode in matched %s identity is rejected',async field=>{
  if(field==='sub')session.userId='\ud800';else session.sessionId='\ud800';
  await expect(auth.authenticate({token:signed({[field]:'\ud800'})})).rejects.toMatchObject({code:'UNAUTHORIZED'});
});
test('TC-Sec-04 rolling window expires individual attempts rather than resetting an entire minute',()=>{
  let clock=0;const limiter=new LoginLimiter({clock:()=>clock});
  for(const t of [0,15000,30000,45000,59000]) {clock=t;expect(limiter.consume('peer').allowed).toBe(true);}
  clock=59999;expect(limiter.consume('peer')).toEqual({allowed:false,retryAfter:1});
  clock=60000;expect(limiter.consume('peer').allowed).toBe(true);
  clock=60001;expect(limiter.consume('peer')).toEqual({allowed:false,retryAfter:15});
  clock=75000;expect(limiter.consume('peer').allowed).toBe(true);
  expect(limiter.consume('independent-peer').allowed).toBe(true);
});
test.each(['alice\n','alice\r','alice\r\n','a\u2028','a\u2029','a\x00','a\t',[],null,{},'x'.repeat(33)])(
  'TC-Sec-05 rejects invalid username boundaries %#',value=>{
    expect(()=>sanitizeUsername(value)).toThrow(expect.objectContaining({code:'VALIDATION_ERROR'}));
  });
test('TC-Sec-05 validates raw Unicode length before markup is stripped',()=>{
  expect(()=>sanitizeMessage('<b>'+ 'x'.repeat(2000)+'</b>')).toThrow(expect.objectContaining({code:'VALIDATION_ERROR'}));
  expect(sanitizeMessage('x'.repeat(1999)+'😀')).toHaveLength(2001);
  expect(sanitizeUsername('a')).toBe('a');expect(sanitizeUsername('a'.repeat(32))).toHaveLength(32);
});
