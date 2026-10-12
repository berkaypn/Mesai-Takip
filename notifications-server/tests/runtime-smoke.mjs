import {Miniflare} from 'miniflare';
import {readFileSync} from 'node:fs';
import {createECDH,randomBytes} from 'node:crypto';
import webpush from 'web-push';
import assert from 'node:assert/strict';
import rules from '../../notification-rules.js';
const keys=webpush.generateVAPIDKeys(),calls=[];
const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/worker.js',import.meta.url).pathname,compatibilityDate:'2026-10-12',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ALLOWED_ORIGIN:'https://berkaypn.github.io',APP_URL:'https://berkaypn.github.io/Mesai-Takip/',VAPID_SUBJECT:'https://github.com/berkaypn/Mesai-Takip',VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey},outboundService:async request=>{calls.push({url:request.url,encoding:request.headers.get('content-encoding'),body:Buffer.from(await request.arrayBuffer())});return new Response('',{status:201});}});
try{
 const db=await mf.getD1Database('DB');await db.exec(readFileSync(new URL('../migrations/0001_notifications.sql',import.meta.url),'utf8'));
 const r=await mf.dispatchFetch('https://notify.example/config',{headers:{Origin:'https://berkaypn.github.io'}});assert.equal(r.status,200);assert.equal((await r.json()).publicKey,keys.publicKey);
 const today=rules.day(Date.now()),start=Date.now()-16*60000;
 const c=createECDH('prime256v1');c.generateKeys();
 const body={seq:1,prefs:{...rules.defaults,entry:false,exit:false,weekly:false,canias:false,enabled:true},snapshot:{capturedAt:Date.now(),day:today,hasEntry:true,shiftOpen:true,breakStart:start,breakUntil:null,offDates:[],weekStart:rules.monday(today),weekMinutes:0,weekDays:0,weekMissing:0,caniasCount:0},subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/runtime-test',keys:{p256dh:c.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}};
 const en=await mf.dispatchFetch('https://notify.example/device',{method:'PUT',headers:{Origin:'https://berkaypn.github.io',Authorization:'Bearer '+'f'.repeat(64)},body:JSON.stringify(body)});assert.equal(en.status,200);
 const worker=await mf.getWorker();await worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'});
 assert.equal(calls.length,1);assert.equal(calls[0].encoding,'aes128gcm');assert.equal(calls[0].body.includes(Buffer.from('Molayı')),false);
 await worker.scheduled({scheduledTime:Date.now()+60000,cron:'* * * * *'});assert.equal(calls.length,1);
 console.log('Worker runtime + D1 + encrypted push to mock transport + cron dedup: passed. No real device contacted.');
}finally{await mf.dispose();}
