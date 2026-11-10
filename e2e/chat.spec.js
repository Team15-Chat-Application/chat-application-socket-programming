const {test,expect}=require('@playwright/test');
const axe=require('axe-core');
async function signUp(page,name){await page.goto('/');await page.getByRole('button',{name:'New here? Create an account'}).click();await page.getByLabel('Username',{exact:true}).fill(name);await page.getByLabel('Password',{exact:true}).fill('Browser-test-password');await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Connected');}
test('actual two-browser product: rooms, messages, receipts, unread badges and keyboard access',async({browser})=>{
 const c1=await browser.newContext(),c2=await browser.newContext();const a=await c1.newPage(),b=await c2.newPage();
 try{
  await signUp(a,'Alice_'+Date.now());await signUp(b,'Bob_'+Date.now());
  await a.getByLabel('Create a room',{exact:true}).fill('Project Team');await a.getByRole('button',{name:'Create room',exact:true}).click();
  await b.evaluate(()=>{window.__live=[];new MutationObserver(list=>list.forEach(m=>window.__live.push(m.target.getAttribute('aria-live')))).observe(document.getElementById('messages'),{attributes:true,attributeFilter:['aria-live']});});
  await b.getByRole('button',{name:/# Project Team/}).click();
  await expect(b.locator('#message')).toBeFocused();
  await expect.poll(()=>b.evaluate(()=>window.__live.join(',')),{timeout:3000}).toBe('off,polite');
  await a.getByLabel('Message',{exact:true}).fill('Hello team');await a.getByLabel('Message',{exact:true}).press('Enter');
  await expect(b.locator('#messages')).toContainText('Hello team');await expect(a.locator('.receipt').last()).toHaveText('Read');
  await b.getByLabel('Message',{exact:true}).fill('Working together');await expect(a.locator('#typing')).toContainText('typing');
  await b.getByLabel('Message',{exact:true}).press('Enter');await expect(a.locator('#messages')).toContainText('Working together');
  await a.getByLabel('Create a room',{exact:true}).fill('Another Room');await a.getByRole('button',{name:'Create room',exact:true}).click();
  await expect(a.locator('#room-title')).toHaveText('# Another Room');
  await b.getByLabel('Message',{exact:true}).fill('One more update');await b.getByRole('button',{name:'Send message'}).click();
  await expect(a.locator('.unread')).toHaveText('1');await a.getByRole('button',{name:/# Project Team/}).click();await expect(a.locator('#messages')).toContainText('One more update');
  await a.getByLabel('Message',{exact:true}).fill('<img src=x onerror="window.pwned=1">Safe <b>text</b> & comparison');await a.getByRole('button',{name:'Send message'}).click();
  await expect(b.locator('#messages')).toContainText('Safe text & comparison');expect(await b.evaluate(()=>window.pwned)).toBeUndefined();expect(await b.locator('#messages img').count()).toBe(0);
  await a.getByLabel('Message',{exact:true}).fill('x'.repeat(2001));await expect(a.getByRole('button',{name:'Send message'})).toBeDisabled();
  await a.getByLabel('Message',{exact:true}).fill('Keyboard message');await a.getByLabel('Message',{exact:true}).press('Enter');await expect(b.locator('#messages')).toContainText('Keyboard message');
  await a.screenshot({path:'reports/chat-desktop.png',fullPage:true});
  await a.evaluate(axe.source);const audit=await a.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
  expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await a.getByRole('button',{name:'Sign out'}).click();await expect(a.locator('#auth')).toBeVisible();
 }finally{await c1.close();await c2.close();}
});
test('login form and mobile layout pass automated accessibility checks',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(axe.source);
 const audit=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));expect(audit.violations.map(v=>v.id)).toEqual([]);
 await page.keyboard.press('Tab');await expect(page.locator('.skip')).toBeFocused();
 await page.screenshot({path:'reports/chat-mobile.png',fullPage:true});
});
const roomsClipped=page=>page.evaluate(()=>{const list=document.getElementById('room-list').getBoundingClientRect();return [...document.querySelectorAll('.room-button')].filter(b=>{const r=b.getBoundingClientRect(),n=b.querySelector('.room-name');return r.left<list.left-0.5||r.right>list.right+0.5||n.scrollWidth>n.clientWidth+1;}).map(b=>b.textContent);});
const overflows=page=>page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
test('TC-UX-01 rows 14 and 15: 320 px and 200% zoom-equivalent viewports reflow without overflow or clipped rooms',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.goto('/');expect(await overflows(page)).toBe(false);
 const name='Narrow_'+Date.now();await signUp(page,name);
 for(const room of ['Narrow room','Another very long room name here','Design reviews']){
  await page.getByLabel('Create a room',{exact:true}).fill(room);await page.getByRole('button',{name:'Create room',exact:true}).click();
  await expect(page.locator('#room-title')).toHaveText('# '+room);
  expect(await overflows(page)).toBe(false);
 }
 await page.getByRole('button',{name:/# Narrow room/}).focus();expect(await overflows(page)).toBe(false);expect(await roomsClipped(page)).toEqual([]);
 // Row 14: 200% zoom on a 1280x800 window lays out at 640x400 CSS px.
 await page.setViewportSize({width:640,height:400});expect(await overflows(page)).toBe(false);expect(await roomsClipped(page)).toEqual([]);
 await page.screenshot({path:'reports/chat-320px.png',fullPage:true});
});
test('TC-UX-01 row 3: signing in again announces the signed-in user, not a reconnect',async({page})=>{
 const name='Again_'+Date.now();await signUp(page,name);
 await page.getByRole('button',{name:'Sign out'}).click();await expect(page.locator('#auth')).toBeVisible();
 await page.getByLabel('Username',{exact:true}).fill(name);await page.getByLabel('Password',{exact:true}).fill('Browser-test-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Connected');
 await expect(page.locator('#room-name')).toBeFocused();
 await expect(page.locator('#notice')).toHaveText('Signed in as '+name+'.');
});
