const {test,expect}=require('@playwright/test');
const axe=require('axe-core');
async function signUp(page,name){await page.goto('/');await page.getByRole('button',{name:'New here? Create an account'}).click();await page.getByLabel('Username',{exact:true}).fill(name);await page.getByLabel('Password',{exact:true}).fill('Browser-test-password');await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.locator('#connection')).toHaveText('Connected');}
test('actual two-browser product: rooms, messages, receipts, unread badges and keyboard access',async({browser})=>{
 const c1=await browser.newContext(),c2=await browser.newContext();const a=await c1.newPage(),b=await c2.newPage();
 try{
  await signUp(a,'Alice_'+Date.now());await signUp(b,'Bob_'+Date.now());
  await a.getByLabel('Create a room',{exact:true}).fill('Project Team');await a.getByRole('button',{name:'Create room',exact:true}).click();
  await b.getByRole('button',{name:/# Project Team/}).click();
  await a.getByLabel('Message',{exact:true}).fill('Hello team');await a.getByLabel('Message',{exact:true}).press('Enter');
  await expect(b.locator('#messages')).toContainText('Hello team');await expect(a.locator('.receipt').last()).toHaveText('Read');
  await b.getByLabel('Message',{exact:true}).fill('Working together');await expect(a.locator('#typing')).toContainText('typing');
  await b.getByLabel('Message',{exact:true}).press('Enter');await expect(a.locator('#messages')).toContainText('Working together');
  await a.getByLabel('Create a room',{exact:true}).fill('Another Room');await a.getByRole('button',{name:'Create room',exact:true}).click();
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
