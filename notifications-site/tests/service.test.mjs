import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handle,dispatch} from '../lib/service.js';
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
  const database=db(),now=at('2026-10-15',850),e=env(database),sub=await subscription();
  for(let i=0;i<9;i++){const t=i.toString(16).padStart(64,'0');const body={seq:1,prefs:prefs(),snapshot:snapshot('2026-10-15',now,{caniasCount:i+1}),subscription:sub};let response=await handle(req('device','PUT',body,t),e,now);assert.equal(response.status,200);}
  assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM devices').first()).n,9);
  const delivered=[];await dispatch(e,now,async(_env,_sub,p)=>{delivered.push(p);return {ok:true,status:201}});assert.equal(delivered.length,9);assert.equal(new Set(delivered.map(p=>p.body)).size,9);
  let invalid=await handle(req('device','PUT',{seq:2,prefs:prefs(),snapshot:{...snapshot('2026-10-15',now),days:{segs:[]}}}),e,now);assert.equal(invalid.status,400);
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
  const database=db(),day='2026-10-15',now=at(day,845),e=env(database),sub=await subscription();
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
test('legacy preferences remain valid; optional reminders stay off; removed samples return 404',async()=>{
 const database=db(),day='2026-10-15',now=at(day,850),e=env(database),sub=await subscription(),legacy=prefs();delete legacy.goal;delete legacy.missing;
 const body={seq:1,prefs:legacy,snapshot:snapshot(day,now),subscription:sub};
 assert.equal((await handle(req('device','PUT',body,token,forkOrigin),e,now)).status,200);
 const row=await database.prepare('SELECT prefs,snapshot FROM devices').first();assert.equal(JSON.parse(row.prefs).goal,false);assert.equal(JSON.parse(row.prefs).missing,false);
 assert.equal((await handle(req('test-later','POST',{scenario:'weekly'},token,forkOrigin),e,now)).status,404);
 database.close();
});
test('short notification rules: Thursday Canias, goal and past missing exits',()=>{
 const thu='2026-10-15',fri='2026-10-16',t=at(thu,840),s=snapshot(thu,t,{targetAt:t,missingCount:2});
 assert.equal(rules.due(s,prefs(),t-1).some(x=>x.kind==='notes'),false);
 assert.equal(rules.due(s,prefs(),t).filter(x=>x.kind==='notes').length,1);
 assert.equal(rules.due(snapshot(fri,at(fri,840)),prefs(),at(fri,840)).some(x=>x.kind==='notes'),false);
 assert.equal(rules.due(s,prefs(),t).some(x=>x.tag.startsWith('goal:')),false);
 const p=prefs({goal:true,missing:true});assert.equal(rules.due(s,p,t).some(x=>x.tag.startsWith('goal:')),true);
 assert.equal(rules.due({...s,shiftOpen:false},p,t).some(x=>x.tag.startsWith('goal:')),false);
 assert.equal(rules.due({...s,breakStart:t},p,t).some(x=>x.tag.startsWith('goal:')),false);
 const friday=snapshot(fri,at(fri,960),{missingCount:2});assert.equal(rules.due(friday,p,at(fri,960)).filter(x=>x.tag.startsWith('missing:')).length,1);
 assert.equal(rules.due({...friday,missingCount:0},p,at(fri,960)).some(x=>x.tag.startsWith('missing:')),false);
 for(const payload of [...rules.due(s,p,t),...rules.due(friday,p,at(fri,960)),...rules.due(snapshot('2026-10-17',at('2026-10-17',600)),p,at('2026-10-17',600))]){assert.ok(payload.title.length<=35);assert.ok(payload.body.length<=75);}
});
