import * as Push from './webpush.js';
import rules from './rules.js';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const date=k=>typeof k==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(k)&&rules.day(rules.at(k,720))===k;
const allowed='https://berkaypn.github.io';
const maxAge=8*86400000;
const ready=env=>!!(env.DB&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_JWK&&env.VAPID_SUBJECT);
const hash=async token=>Push.hash(token);
async function bodyOf(request){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))throw fail(415,'JSON gerekli.');
  if(Number(request.headers.get('Content-Length')||0)>16384)throw fail(413,'İstek çok büyük.');
  const reader=request.body?.getReader();if(!reader)throw fail(400,'İstek gövdesi eksik.');
  let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw fail(413,'İstek çok büyük.');}chunks.push(value);}}finally{reader.releaseLock();}
  const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{throw fail(400,'Geçersiz istek.');}
}

export function validate(body,now){
  if(!body||typeof body!=='object'||Array.isArray(body)||!int(body.seq,1,Number.MAX_SAFE_INTEGER))throw fail(400,'Geçersiz sıra.');
  const p=body.prefs,s=body.snapshot;
  if(!p||!s||Object.keys(body).some(k=>!['seq','prefs','snapshot','subscription'].includes(k)))throw fail(400,'Geçersiz bildirim bilgisi.');
  for(const k of ['enabled','break','exit','entry','weekly','canias'])if(typeof p[k]!=='boolean')throw fail(400,'Geçersiz seçenek.');
  if(!int(p.entryMinute,360,720)||!int(p.exitMinute,900,1320))throw fail(400,'Geçersiz saat.');
  const fields=['capturedAt','day','hasEntry','shiftOpen','breakStart','breakUntil','offDates','weekStart','weekMinutes','weekDays','weekMissing','caniasCount'];
  if(Object.keys(s).some(k=>!fields.includes(k))||!date(s.day)||!date(s.weekStart))throw fail(400,'Geçersiz tarih.');
  if(!int(s.capturedAt,now-2*86400000,now+300000)||typeof s.hasEntry!=='boolean'||typeof s.shiftOpen!=='boolean')throw fail(400,'Geçersiz durum.');
  for(const k of ['breakStart','breakUntil'])if(s[k]!=null&&!int(s[k],now-2*86400000,now+2*86400000))throw fail(400,'Geçersiz mola.');
  if(s.breakStart!=null&&(!s.shiftOpen||rules.day(s.breakStart)!==s.day))throw fail(400,'Mola ofis kaydıyla eşleşmiyor.');
  if(!Array.isArray(s.offDates)||s.offDates.length>180||s.offDates.some(k=>!date(k)))throw fail(400,'Geçersiz izin tarihleri.');
  if(!int(s.weekMinutes,-10080,10080)||!int(s.weekDays,0,5)||!int(s.weekMissing,0,5)||!int(s.caniasCount,0,100000))throw fail(400,'Geçersiz özet.');
  return {seq:body.seq,prefs:Object.fromEntries(Object.keys(rules.defaults).concat('enabled').map(k=>[k,p[k]])),snapshot:Object.fromEntries(fields.map(k=>[k,s[k]])),subscription:body.subscription||null};
}

async function send(env,subscription,payload){
  const response=await Push.sendPush(subscription,payload,env);
  return response;
}

export async function dispatch(env,now=Date.now(),sender=send){
  const result={sent:0,failed:0,expired:0};
  const {results}=await env.DB.prepare('SELECT * FROM devices WHERE updated_at > ? ORDER BY updated_at DESC LIMIT 32').bind(now-maxAge).all();
  for(const row of results){
    if(!row.subscription)continue;
    const due=rules.due(JSON.parse(row.snapshot),JSON.parse(row.prefs),now);
    for(const item of due){
      const claim=await env.DB.prepare("INSERT INTO deliveries(device,tag,status,lease_until,attempts) VALUES(?,?,'sending',?,1) ON CONFLICT(device,tag) DO UPDATE SET status='sending',lease_until=excluded.lease_until,attempts=deliveries.attempts+1 WHERE deliveries.status IN ('retry','sending') AND deliveries.lease_until < ? AND deliveries.attempts < 3").bind(row.id,item.tag,now+120000,now).run();
      if(!claim.meta.changes)continue;
      try{
        const fresh=await env.DB.prepare('SELECT * FROM devices WHERE id=?').bind(row.id).first();
        const candidate=fresh&&rules.due(JSON.parse(fresh.snapshot),JSON.parse(fresh.prefs),now).find(x=>x.tag===item.tag);
        if(!candidate){await env.DB.prepare("UPDATE deliveries SET status='cancelled' WHERE device=? AND tag=?").bind(row.id,item.tag).run();continue;}
        const response=await sender(env,JSON.parse(fresh.subscription),{...candidate,seq:fresh.seq});
        if([404,410].includes(response.status)){await env.DB.batch([env.DB.prepare('DELETE FROM devices WHERE id=?').bind(row.id),env.DB.prepare('DELETE FROM deliveries WHERE device=?').bind(row.id)]);result.expired++;break;}
        if(!response.ok)throw Error('push');
        await env.DB.prepare("UPDATE deliveries SET status='sent' WHERE device=? AND tag=?").bind(row.id,item.tag).run();result.sent++;
      }catch{
        await env.DB.prepare("UPDATE deliveries SET status='retry',lease_until=? WHERE device=? AND tag=?").bind(now+300000,row.id,item.tag).run();result.failed++;
      }
    }
  }
  await env.DB.batch([env.DB.prepare('DELETE FROM deliveries WHERE lease_until < ?').bind(now-30*86400000),env.DB.prepare('DELETE FROM devices WHERE updated_at < ?').bind(now-90*86400000)]);
  return result;
}

export async function handle(request,env,now=Date.now()){
  const origin=request.headers.get('Origin'),url=new URL(request.url);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin===allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, PUT, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
    if(url.pathname==='/api/notifications/health'&&request.method==='GET')return response({service:'Mesai Takip bildirimleri',ready:ready(env)});
    if(url.pathname==='/api/notifications/dispatch'&&request.method==='POST'){
      if(!ready(env))throw fail(503,'Bildirim servisi hazır değil.');
      const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
      if(!await Push.verifySchedulerJWT(token,url.origin,env,now))throw fail(401,'Yetkisiz zamanlayıcı.');
      const result=await dispatch(env,now);return response(result,result.failed?503:200);
    }
    if(origin!==allowed)throw fail(403,'Bu kaynak kabul edilmiyor.');
    if(request.method==='OPTIONS')return response({ok:true});
    if(!ready(env))throw fail(503,'Bildirim servisi hazır değil.');
    if(url.pathname==='/api/notifications/config'&&request.method==='GET')return response({publicKey:env.VAPID_PUBLIC_KEY});
    const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization')||'')?.[1];
    if(!token)throw fail(401,'Cihaz doğrulanamadı.');
    const id=await hash(token);
    if(url.pathname==='/api/notifications/device'&&request.method==='PUT'){
      const body=await bodyOf(request);
      const data=validate(body,now),existing=await env.DB.prepare('SELECT id,subscription FROM devices WHERE id=?').bind(id).first();
      if(!existing&&!data.subscription&&data.prefs.enabled)throw fail(404,'Önce bildirimleri etkinleştir.');
      if(!existing){const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first();if(count.n>=32)throw fail(429,'Cihaz sınırına ulaşıldı.');}
      let subscription=null;
      if(data.prefs.enabled&&data.subscription){try{subscription=await Push.validateSubscription(data.subscription);}catch{throw fail(400,'Geçersiz bildirim aboneliği.');}}
      if(data.prefs.enabled&&!subscription&&!existing?.subscription)throw fail(400,'Bildirim aboneliği eksik.');
      const statement=env.DB.prepare('INSERT INTO devices(id,seq,subscription,prefs,snapshot,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM devices WHERE id=?) OR (SELECT COUNT(*) FROM devices)<32 ON CONFLICT(id) DO UPDATE SET seq=excluded.seq,subscription=CASE WHEN json_extract(excluded.prefs,\'$.enabled\') = 0 THEN NULL ELSE COALESCE(excluded.subscription,devices.subscription) END,prefs=excluded.prefs,snapshot=excluded.snapshot,updated_at=excluded.updated_at WHERE excluded.seq > devices.seq').bind(id,data.seq,subscription?JSON.stringify(subscription):null,JSON.stringify(data.prefs),JSON.stringify(data.snapshot),now,id);
      const update=data.prefs.enabled?await statement.run():(await env.DB.batch([statement,env.DB.prepare("DELETE FROM deliveries WHERE device=? AND EXISTS(SELECT 1 FROM devices WHERE id=? AND seq=? AND json_extract(prefs,'$.enabled')=0)").bind(id,id,data.seq)]))[0];
      if(!existing&&!update.meta.changes)throw fail(429,'Cihaz sınırına ulaşıldı.');
      return response({ok:true});
    }
    if(url.pathname==='/api/notifications/test'&&request.method==='POST'){
      const row=await env.DB.prepare('SELECT * FROM devices WHERE id=?').bind(id).first();
      if(!row?.subscription||!JSON.parse(row.prefs).enabled)throw fail(404,'Bildirim aboneliği yok.');
      const changed=await env.DB.prepare('UPDATE devices SET last_test=? WHERE id=? AND last_test < ?').bind(now,id,now-30000).run();
      if(!changed.meta.changes)throw fail(429,'Test için 30 saniye bekle.');
      const pushed=await send(env,JSON.parse(row.subscription),{kind:'today',tag:'test:'+now,title:'🔔 Mesai Takip',body:'Bildirim bağlantın çalışıyor. Mesai kayıtların aynı cihazda korunuyor.',due:now,expiry:now+60000});
      if(!pushed.ok)throw fail(502,'Gönderim servisi bildirimi kabul etmedi.');
      return response({accepted:true});
    }
    throw fail(404,'Bulunamadı.');
  }catch(error){return response({error:error.status?error.message:'Bildirim servisine ulaşılamadı.'},error.status||503);}
}
