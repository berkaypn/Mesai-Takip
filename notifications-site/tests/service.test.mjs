import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handle,dispatch,dispatchPhoneTests} from '../lib/service.js';
import rules from '../lib/rules.js';

function db(){
  const sqlite=new DatabaseSync(':memory:');
  for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
  return {prepare(sql){let args=[];return {bind(...values){args=values;return this},first(){return sqlite.prepare(sql).get(...args)||null},all(){return {results:sqlite.prepare(sql).all(...args)}},run(){return {meta:{changes:sqlite.prepare(sql).run(...args).changes}}}}},batch(queries){return Promise.all(queries.map(q=>q.run()))},close(){sqlite.close()}};
}
const origin='https://berkaypn.github.io',token='a'.repeat(64);
const at=(day,minute)=>rules.at(day,minute);
function snapshot(day,now,options={}){return {capturedAt:now,day,hasEntry:true,shiftOpen:true,breakStart:null,breakUntil:null,offDates:[],weekStart:rules.monday(day),weekMinutes:60,weekDays:5,weekMissing:0,caniasCount:2,...options};}
function prefs(options={}){return {...rules.defaults,enabled:true,...options};}
function req(path,method='GET',body,tokenValue=token,requestOrigin=origin){return new Request('https://notify.example/api/notifications/'+path,{method,headers:{Origin:requestOrigin,Authorization:'Bearer '+tokenValue,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const env=database=>({DB:database,VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_JWK:'{}',VAPID_SUBJECT:'mailto:test@example.com',SCHEDULER_REPOSITORY:'berkaypn/Mesai-Takip',SCHEDULER_REPOSITORY_ID:'1401896269'});
const fakeSub={endpoint:'https://web.push.apple.com/Q',keys:{p256dh:'B'+'A'.repeat(86),auth:'A'.repeat(22)}};

// Use a valid generated ECDH receiver public key for subscription validation.
async function subscription(){const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const b64=bytes=>Buffer.from(bytes).toString('base64url');return {endpoint:fakeSub.endpoint,keys:{p256dh:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}};}

// These cover the cross-device and cancellation behaviors that matter for existing phone data.
test('nine devices are isolated; no attendance ledger is accepted',async()=>{
  const database=db(),now=at('2026-10-16',850),e=env(database),sub=await subscription();
  for(let i=0;i<9;i++){const t=i.toString(16).padStart(64,'0');const body={seq:1,prefs:prefs(),snapshot:snapshot('2026-10-16',now,{caniasCount:i+1}),subscription:sub};let response=await handle(req('device','PUT',body,t),e,now);assert.equal(response.status,200);}
  assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM devices').first()).n,9);
  const delivered=[];await dispatch(e,now,async(_env,_sub,p)=>{delivered.push(p);return {ok:true,status:201}});assert.equal(delivered.length,9);assert.equal(new Set(delivered.map(p=>p.body)).size,9);
  let invalid=await handle(req('device','PUT',{seq:2,prefs:prefs(),snapshot:{...snapshot('2026-10-16',now),days:{segs:[]}}}),e,now);assert.equal(invalid.status,400);
  assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM devices').first()).n,9);database.close();
});

test('closed break cancels reminder; stale state cannot overwrite it',async()=>{
  const database=db(),day='2026-10-12',start=at(day,600),now=start+20*60000,e=env(database),sub=await subscription();
  const open=snapshot(day,now,{breakStart:start}),closed=snapshot(day,now,{breakStart:null});
  assert.equal((await handle(req('device','PUT',{seq:1,prefs:prefs(),snapshot:open,subscription:sub}),e,now)).status,200);
  assert.equal((await handle(req('device','PUT',{seq:2,prefs:prefs(),snapshot:closed}),e,now)).status,200);
  assert.equal((await handle(req('device','PUT',{seq:1,prefs:prefs(),snapshot:open}),e,now)).status,200);
  let sent=[];await dispatch(e,now,async(_e,_sub,payload)=>{sent.push(payload);return {ok:true,status:201}});
  assert.equal(sent.filter(x=>x.tag==='break:'+start).length,0);database.close();
});

test('Canias notification goes once per device and authenticated scheduler is required',async()=>{
  const database=db(),day='2026-10-16',now=at(day,845),e=env(database),sub=await subscription();
  assert.equal((await handle(req('device','PUT',{seq:1,prefs:prefs(),snapshot:snapshot(day,now),subscription:sub}),e,now)).status,200);
  const bad=await handle(new Request('https://notify.example/api/notifications/dispatch',{method:'POST'}),e,now);assert.equal(bad.status,401);
  const sent=[];const sender=async(_env,_sub,payload)=>{sent.push(payload);return {ok:true,status:201}};
  await dispatch(e,now,sender);await dispatch(e,now+60000,sender);
  assert.equal(sent.filter(x=>x.tag==='canias:'+day).length,1);database.close();
});

test('disable clears subscription and delivery queue; expired entry ignored',async()=>{
  const database=db(),day='2026-10-12',now=at(day,850),e=env(database),sub=await subscription();
  const s=snapshot(day,now);
  await handle(req('device','PUT',{seq:1,prefs:prefs(),snapshot:s,subscription:sub}),e,now);
  await handle(req('device','PUT',{seq:2,prefs:prefs({enabled:false}),snapshot:s}),e,now);
  assert.equal((await database.prepare('SELECT subscription FROM devices').first()).subscription,null);
  assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM deliveries').first()).n,0);
  assert.deepEqual(rules.due(snapshot(day,now-9*86400000),prefs(),now).filter(x=>x.kind==='notes'),[]);
  database.close();
});

test('device limit also bounds disabled enrollment; large streamed body rejected',async()=>{
 const database=db(),now=at('2026-10-12',600),e=env(database),body={seq:1,prefs:prefs({enabled:false}),snapshot:snapshot('2026-10-12',now)};
 for(let i=0;i<32;i++)assert.equal((await handle(req('device','PUT',body,i.toString(16).padStart(64,'0')),e,now)).status,200);
 assert.equal((await handle(req('device','PUT',body,'f'.repeat(64)),e,now)).status,429);
 assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM devices').first()).n,32);
 const large=new Request('https://notify.example/api/notifications/device',{method:'PUT',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'x'.repeat(16385)});
 assert.equal((await handle(large,e,now)).status,413);database.close();
});

const forkOrigin='https://oguzhancirit.github.io';
test('phone examples wait one minute, deliver once and cannot cross origins',async()=>{
 const database=db(),now=at('2026-10-16',845),e=env(database),sub=await subscription(),body={seq:1,prefs:prefs(),snapshot:snapshot('2026-10-16',now),subscription:sub};
 assert.equal((await handle(req('device','PUT',body,token,forkOrigin),e,now)).status,200);
 assert.equal((await handle(req('device','PUT',{...body,seq:2},token,origin),e,now)).status,403);
 assert.equal((await handle(req('test-later','POST',{scenario:'canias'},token,origin),e,now)).status,403);
 const queued=await handle(req('test-later','POST',{scenario:'canias'},token,forkOrigin),e,now);
 assert.equal(queued.status,200);assert.equal((await queued.json()).due,now+60000);
 const sent=[],sender=async(_e,_s,p)=>{sent.push(p);return {ok:true,status:201}};
 await dispatch(e,now,sender);assert.equal(sent.length,0);
 await dispatchPhoneTests(e,now+59999,sender);assert.equal(sent.length,0);
 await dispatchPhoneTests(e,now+60000,sender);assert.equal(sent.length,1);assert.equal(sent[0].kind,'notes');assert.match(sent[0].title,/TEST/);
 await dispatchPhoneTests(e,now+120000,sender);assert.equal(sent.length,1);database.close();
});
test('disabling test notifications removes queued example and rejects new samples',async()=>{
 const database=db(),now=at('2026-10-12',600),e=env(database),sub=await subscription(),s=snapshot('2026-10-12',now);
 await handle(req('device','PUT',{seq:1,prefs:prefs(),snapshot:s,subscription:sub},token,forkOrigin),e,now);
 assert.equal((await handle(req('test-later','POST',{scenario:'weekly'},token,forkOrigin),e,now)).status,200);
 await handle(req('device','PUT',{seq:2,prefs:prefs({enabled:false}),snapshot:s},token,forkOrigin),e,now+1000);
 assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM phone_tests').first()).n,0);
 assert.equal((await handle(req('test-later','POST',{scenario:'weekly'},token,forkOrigin),e,now+61000)).status,404);
 await dispatchPhoneTests(e,now+61000,()=>{throw Error('should not send')});database.close();
});

test('immediate test followed by five rapid samples queues and delivers every scenario',async()=>{
 const database=db(),now=at('2026-10-12',850),e=env(database),sub=await subscription();
 const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);e.VAPID_PRIVATE_JWK=JSON.stringify(await crypto.subtle.exportKey('jwk',vapid.privateKey));e.VAPID_PUBLIC_KEY=Buffer.from(await crypto.subtle.exportKey('raw',vapid.publicKey)).toString('base64url');
 await handle(req('device','PUT',{seq:1,prefs:prefs(),snapshot:snapshot('2026-10-12',now),subscription:sub},token,forkOrigin),e,now);
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:201});
 try{
  assert.equal((await handle(req('test','POST',{},token,forkOrigin),e,now)).status,200);
  const limited=await handle(req('test','POST',{},token,forkOrigin),e,now+1000);assert.equal(limited.status,429);assert.equal((await limited.json()).retryAfter,4);
  for(const scenario of ['break','exit','entry','canias','weekly']){
   const r=await handle(req('test-later','POST',{scenario},token,forkOrigin),e,now+1000);assert.equal(r.status,200);assert.equal((await r.json()).due,now+61000);
  }
  assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM phone_tests').first()).n,5);
  const duplicate=await handle(req('test-later','POST',{scenario:'canias'},token,forkOrigin),e,now+10000);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).due,now+61000);
  assert.equal((await handle(req('test','POST',{},token,forkOrigin),e,now+5000)).status,200);
  const sent=[];await dispatchPhoneTests(e,now+61000,async(_e,_s,p)=>{sent.push(p);return {ok:true,status:201}});assert.equal(sent.length,5);assert.equal(new Set(sent.map(p=>p.tag)).size,5);
  await dispatchPhoneTests(e,now+62000,()=>{throw Error('no duplicate')});assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM phone_tests').first()).n,0);
 }finally{globalThis.fetch=original;database.close();}
});
