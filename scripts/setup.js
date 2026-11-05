const fs=require('node:fs');
const {randomBytes}=require('node:crypto');
const file='.env';let content=fs.existsSync(file)?fs.readFileSync(file,'utf8'):fs.readFileSync('.env.example','utf8');
if(!/^JWT_SECRET=.+$/m.test(content))content+='\nJWT_SECRET='+randomBytes(48).toString('base64url')+'\n';
fs.writeFileSync(file,content,{mode:0o600});
console.log('Local configuration ready. Signing key stays in ignored .env. Run npm start.');
