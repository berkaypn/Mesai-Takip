import webpush from 'web-push';
import {createHash} from 'node:crypto';
import rules from '../notification-rules.js';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const key=k=>typeof k==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(k)&&rules.day(rules.at(k,720))===k;
export function validEndpoint(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(
    u.hostname==='fcm.googleapis.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com'));
  }catch{return false;}
}
export function validate(body,now){
  if(!int(body.seq,1,Number.MAX_SAFE_INTEGER))throw fail(400,'Geçersiz sıra.');
  const p=body.prefs,s=body.snapshot;
  if(!p||!s||Object.keys(body).some(k=>!['seq','prefs','snapshot','subscription'].includes(k)))throw fail(400,'Geçersiz bildirim bilgisi.');
  for(const k of ['enabled','break','exit','entry','weekly','canias'])if(typeof p[k]!=='boolean')throw fail(400,'Geçersiz seçenek.');
  if(!int(p.entryMinute,360,720)||!int(p.exitMinute,900,1320))throw fail(400,'Geçersiz saat.');
  const fields=['capturedAt','day','hasEntry','shiftOpen','breakStart','breakUntil','offDates','weekStart','weekMinutes','weekDays','weekMissing','caniasCount'];
  if(Object.keys(s).some(k=>!fields.includes(k))||!key(s.day)||!key(s.weekStart))throw fail(400,'Geçersiz tarih.');
  if(!int(s.capturedAt,now-2*86400000,now+300000)||typeof s.hasEntry!=='boolean'||typeof s.shiftOpen!=='boolean')throw fail(400,'Geçersiz durum.');
  for(const k of ['breakStart','breakUntil'])if(s[k]!=null&&!int(s[k],now-2*86400000,now+2*86400000))throw fail(400,'Geçersiz mola.');
  if(s.breakStart!=null&&(!s.shiftOpen||rules.day(s.breakStart)!==s.day))throw fail(400,'Mola ofis kaydıyla eşleşmiyor.');
  if(!Array.isArray(s.offDates)||s.offDates.length>180||s.offDates.some(k=>!key(k)))throw fail(400,'Geçersiz izin tarihleri.');
  if(!int(s.weekMinutes,-10080,10080)||!int(s.weekDays,0,5)||!int(s.weekMissing,0,5)||!int(s.caniasCount,0,100000))throw fail(400,'Geçersiz özet.');
  if(body.subscription){const sub=body.subscription;if(!validEndpoint(sub.endpoint)||!sub.keys||!/^[A-Za-z0-9_-]{86,88}=?$/.test(sub.keys.p256dh||'')||!/^[A-Za-z0-9_-]{22,24}={0,2}$/.test(sub.keys.auth||''))throw fail(400,'Geçersiz abonelik.');}
  return {seq:body.seq,prefs:Object.fromEntries(Object.keys(rules.defaults).concat('enabled').map(k=>[k,p[k]])),snapshot:Object.fromEntries(fields.map(k=>[k,s[k]])),subscription:body.subscription||null};
}
async function send(env,subscription,payload){
  if(!validEndpoint(subscription.endpoint))throw fail(400,'Geçersiz uç nokta.');
  const details=webpush.generateRequestDetails(subscription,JSON.stringify(payload),{TTL:60,urgency:'normal',contentEncoding:'aes128gcm',vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
  // Use Workers fetch with the library's encrypted request; never follow endpoint redirects.
  return fetch(details.endpoint,{method:details.method,headers:details.headers,body:details.body,redirect:'manual',signal:AbortSignal.timeout(10000)});
}
export async function dispatch(env,now=Date.now(),sendPush=send){
  const result={sent:0,failed:0,expired:0};
  const {results}=await env.DB.prepare('SELECT * FROM devices WHERE updated_at > ?').bind(now-8*86400000).all();
  for(const row of results){
    const prefs=JSON.parse(row.prefs),snapshot=JSON.parse(row.snapshot);
    if(!row.subscription)continue;
    for(const item of rules.due(snapshot,prefs,now)){
      const claim=await env.DB.prepare("INSERT INTO deliveries(device,tag,status,lease_until,attempts) VALUES(?,?,'sending',?,1) ON CONFLICT(device,tag) DO UPDATE SET status='sending',lease_until=excluded.lease_until,attempts=deliveries.attempts+1 WHERE deliveries.status IN ('retry','sending') AND deliveries.lease_until < ? AND deliveries.attempts < 3").bind(row.id,item.tag,now+120000,now).run();
      if(!claim.meta.changes)continue;
      try{
        // Recheck after claiming: a closed break/shift or changed Canias count cancels delivery.
        const fresh=await env.DB.prepare('SELECT * FROM devices WHERE id=?').bind(row.id).first();
        const candidate=fresh&&rules.due(JSON.parse(fresh.snapshot),JSON.parse(fresh.prefs),now).find(x=>x.tag===item.tag);
        if(!candidate){await env.DB.prepare("UPDATE deliveries SET status='cancelled' WHERE device=? AND tag=?").bind(row.id,item.tag).run();continue;}
        const response=await sendPush(env,JSON.parse(fresh.subscription),{...candidate,seq:fresh.seq});
        if(response.status===404||response.status===410){await env.DB.batch([env.DB.prepare('DELETE FROM devices WHERE id=?').bind(row.id),env.DB.prepare('DELETE FROM deliveries WHERE device=?').bind(row.id)]);result.expired++;break;}
        if(!response.ok)throw Error('push');
        await env.DB.prepare("UPDATE deliveries SET status='sent' WHERE device=? AND tag=?").bind(row.id,item.tag).run();result.sent++;
      }catch{
        await env.DB.prepare("UPDATE deliveries SET status='retry',lease_until=? WHERE device=? AND tag=?").bind(now+300000,row.id,item.tag).run();result.failed++;
      }
    }
  }
  // Only notification-service data expires; attendance data never enters this database.
  await env.DB.batch([env.DB.prepare('DELETE FROM deliveries WHERE lease_until < ?').bind(now-30*86400000),env.DB.prepare('DELETE FROM devices WHERE updated_at < ?').bind(now-90*86400000)]);
  return result;
}
export async function handle(request,env,now=Date.now()){
  const origin=request.headers.get('Origin'),url=new URL(request.url);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin===env.ALLOWED_ORIGIN)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, PUT, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
    if(url.pathname==='/health'&&request.method==='GET')return response({service:'Mesai Takip bildirimleri',ready:!!(env.DB&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY)});
    if(origin!==env.ALLOWED_ORIGIN)throw fail(403,'Bu kaynak kabul edilmiyor.');
    if(request.method==='OPTIONS')return response({ok:true});
    if(url.pathname==='/config'&&request.method==='GET'){
      if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.DB)throw fail(503,'Bildirim servisi hazır değil.');
      return response({publicKey:env.VAPID_PUBLIC_KEY});
    }
    const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization')||'')?.[1];
    if(!token)throw fail(401,'Cihaz doğrulanamadı.');
    const id=createHash('sha256').update(token).digest('hex');
    const text=await request.text();if(text.length>16384)throw fail(413,'İstek çok büyük.');
    let body;try{body=JSON.parse(text);}catch{throw fail(400,'Geçersiz istek.');}
    if(url.pathname==='/device'&&request.method==='PUT'){
      const data=validate(body,now),existing=await env.DB.prepare('SELECT id,subscription FROM devices WHERE id=?').bind(id).first();
      if(!existing&&!data.subscription)throw fail(404,'Önce bildirimleri etkinleştir.');
      if(!existing){const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first();if(count.n>=32)throw fail(429,'Cihaz sınırına ulaşıldı.');}
      await env.DB.prepare('INSERT INTO devices(id,seq,subscription,prefs,snapshot,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET seq=excluded.seq,subscription=COALESCE(excluded.subscription,devices.subscription),prefs=excluded.prefs,snapshot=excluded.snapshot,updated_at=excluded.updated_at WHERE excluded.seq > devices.seq').bind(id,data.seq,data.subscription?JSON.stringify(data.subscription):null,JSON.stringify(data.prefs),JSON.stringify(data.snapshot),now).run();
      return response({ok:true});
    }
    if(url.pathname==='/test'&&request.method==='POST'){
      const row=await env.DB.prepare('SELECT * FROM devices WHERE id=?').bind(id).first();
      if(!row?.subscription||!JSON.parse(row.prefs).enabled)throw fail(404,'Bildirim aboneliği yok.');
      const change=await env.DB.prepare('UPDATE devices SET last_test=? WHERE id=? AND last_test < ?').bind(now,id,now-30000).run();
      if(!change.meta.changes)throw fail(429,'Test için 30 saniye bekle.');
      const pushed=await send(env,JSON.parse(row.subscription),{kind:'today',tag:'test:'+now,title:'🔔 Mesai Takip',body:'Bildirim bağlantın çalışıyor. Mesai kayıtların aynı cihazda korunuyor.',due:now,expiry:now+60000});
      if(!pushed.ok)throw fail(502,'Gönderim servisi bildirimi kabul etmedi.');
      return response({accepted:true});
    }
    throw fail(404,'Bulunamadı.');
  }catch(error){return response({error:error.status?error.message:'Bildirim servisine ulaşılamadı.'},error.status||503);}
}
export default {fetch(request,env){return handle(request,env);},scheduled(event,env,ctx){ctx.waitUntil(dispatch(env,event.scheduledTime));}};
