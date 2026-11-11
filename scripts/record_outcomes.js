// Genuine browser capture of the running product, using real REST credentials.
const path=require('node:path'),fs=require('node:fs');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('.cache/playwright');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
const {randomBytes,randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {createRuntime}=require('../src/runtime');

async function signUp(page,name){
 await page.goto('/');await page.getByRole('button',{name:'New here? Create an account'}).click();
 await page.getByLabel('Username',{exact:true}).fill(name);await page.getByLabel('Password',{exact:true}).fill('isolated-demo-password');
 await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Connected');
}
async function record(browser,seconds,stage){
 const runtime=createRuntime({env:{},filename:path.resolve('reports','recording-'+randomUUID()+'.sqlite'),secret:randomBytes(48).toString('hex')});
 const address=await runtime.app.start(0),baseURL='http://127.0.0.1:'+address.port;
 const context=await browser.newContext({baseURL,viewport:{width:1280,height:800},recordVideo:{dir:'reports/raw-videos',size:{width:1280,height:800}}});
 const peerContext=await browser.newContext({baseURL,viewport:{width:1280,height:800}});
 const a=await context.newPage(),b=await peerContext.newPage();
 const started=Date.now();
 async function at(second,action){const wait=second*1000-(Date.now()-started);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));await action();console.log('Sprint '+stage+' capture: '+second+' seconds');}
 try{
  await at(0,()=>a.goto('/'));
  await at(3,async()=>{await signUp(a,'Alice');await signUp(b,'Bob');});
  await at(12,async()=>{await a.getByLabel('Create a room',{exact:true}).fill('Project Team');await a.getByRole('button',{name:'Create room',exact:true}).click();await b.getByRole('button',{name:/# Project Team/}).click();});
  await at(18,async()=>{await a.getByLabel('Message',{exact:true}).fill('Hi team! The project room is ready.');await a.getByRole('button',{name:'Send message'}).click();await expect(b.locator('#messages')).toContainText('Hi team!');});
  await at(24,async()=>{await b.getByLabel('Message',{exact:true}).pressSequentially('Hi Alice, I am here.',{delay:80});});
  await at(29,async()=>{await b.getByRole('button',{name:'Send message'}).click();await expect(a.locator('#messages')).toContainText('Hi Alice');await expect(a.locator('.receipt').last()).toHaveText('Read');});
  await at(35,async()=>{await a.getByLabel('Message',{exact:true}).fill('Great — messages are delivered live to everyone in this room.');await a.getByRole('button',{name:'Send message'}).click();});
  if(stage===1){
   await at(43,async()=>{await b.getByLabel('Message',{exact:true}).fill('Confirmed. I received it and the read receipt is visible.');await b.getByRole('button',{name:'Send message'}).click();});
   await at(51,async()=>{await b.getByRole('button',{name:'Sign out'}).click();await expect(a.locator('#people')).not.toContainText('Bob');});
  }else{
   await at(44,async()=>{await a.getByLabel('Create a room',{exact:true}).fill('Release Notes');await a.getByRole('button',{name:'Create room',exact:true}).click();});
   await at(52,async()=>{await b.getByLabel('Message',{exact:true}).fill('One more update for Project Team.');await b.getByRole('button',{name:'Send message'}).click();await expect(a.locator('.unread')).toHaveText('1');});
   await at(61,async()=>{await a.getByRole('button',{name:/# Project Team/}).click();await expect(a.locator('#messages')).toContainText('One more update');});
   await at(69,async()=>{await a.reload();await a.getByLabel('Username',{exact:true}).fill('Alice');await a.getByLabel('Password',{exact:true}).fill('isolated-demo-password');await a.getByRole('button',{name:'Sign in',exact:true}).click();await expect(a.locator('#connection')).toHaveText('Connected');await a.getByRole('button',{name:/# Project Team/}).click();await expect(a.locator('#messages')).toContainText('One more update');});
   await at(84,async()=>{await a.getByLabel('Message',{exact:true}).fill('<b>Saved history</b>, safe text, and working read receipts.');await a.getByRole('button',{name:'Send message'}).click();});
   await at(96,async()=>{await b.getByLabel('Message',{exact:true}).fill('Looks good. I can read the saved conversation and see who is online.');await b.getByRole('button',{name:'Send message'}).click();});
   await at(109,async()=>{await b.getByRole('button',{name:'Sign out'}).click();await expect(a.locator('#people')).not.toContainText('Bob');});
  }
  await at(seconds+1,async()=>{});
 }finally{await peerContext.close();await context.close();await runtime.close();}
 const source=await a.video().path();
 const ffmpegFolder=fs.readdirSync('.cache/playwright').find(name=>name.startsWith('ffmpeg-'));
 const binary=path.resolve('.cache/playwright',ffmpegFolder,process.platform==='win32'?'ffmpeg-win64.exe':process.platform==='darwin'?'ffmpeg-mac':'ffmpeg-linux');
 fs.mkdirSync('videos',{recursive:true});const output=`videos/sprint-${stage}-outcome-2026-10-28.webm`;
 const result=spawnSync(binary,['-y','-i',source,'-t',String(seconds),'-an','-c:v','libvpx-vp9','-b:v','650k',output],{encoding:'utf8'});
 if(result.status!==0)throw Error('Video encoding failed: '+result.stderr.slice(-700));
 const verifyContext=await browser.newContext();const videoPage=await verifyContext.newPage();
 const bytes=fs.readFileSync(output).toString('base64');
 await videoPage.setContent('<video controls></video>');
 const playback=await videoPage.evaluate(async data=>{const video=document.querySelector('video');video.src='data:video/webm;base64,'+data;await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;});video.currentTime=2;await video.play();return{duration:video.duration,width:video.videoWidth,height:video.videoHeight,playing:!video.paused};},bytes);
 await verifyContext.close();if(!playback.playing||Math.abs(playback.duration-seconds)>1)throw Error('Playback validation failed');
 return {file:output,bytes:fs.statSync(output).size,...playback,recordedAt:new Date().toISOString(),method:'Actual Chromium UI capture, real account registration/login; no fixture auth or invented frames',lateDelivery:stage===1};
}
async function main(){fs.mkdirSync('reports',{recursive:true});const browser=await chromium.launch();try{const results=[];for(const stage of [1,2]){results.push(await record(browser,stage===1?60:120,stage));fs.writeFileSync('reports/video-evidence.json',JSON.stringify(results,null,2));console.log('Verified outcome recording',results.at(-1).file);}}finally{await browser.close();}}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
