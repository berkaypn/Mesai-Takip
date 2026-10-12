const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),events={},shown=[];
let skipped=0,installCore=[];const cached={offline:true},cache={async addAll(items){installCore=items},async match(){return cached},async put(){}};
const context={AbortController,setTimeout,clearTimeout,caches:{async open(){return cache}},async fetch(){throw Error('offline')},self:{addEventListener(t,fn){events[t]=fn},skipWaiting(){skipped++;return Promise.resolve()},registration:{scope:'https://berkaypn.github.io/Mesai-Takip/',showNotification(title,options){shown.push({title,options});return Promise.resolve();}},clients:{async matchAll(){return []},async openWindow(url){context.opened=url}}},Date,URL,console};
vm.createContext(context);vm.runInContext(source,context);
assert.match(source,/mesai-takip-v16/);
for(const file of ['notifications-config.js','notification-rules.js','notifications.js']){assert.ok(source.includes(file));assert.ok(fs.statSync(path.join(__dirname,'..',file)).size>0);}
(async()=>{
 let install;events.install({waitUntil(p){install=p}});await install;assert.equal(skipped,0);assert.ok(installCore.some(x=>x.startsWith('app-updates.js')));
 let applied;events.message({data:{type:'MESAI_SKIP_WAITING'},source:{url:'https://berkaypn.github.io/Mesai-Takip/'},waitUntil(p){applied=p}});await applied;assert.equal(skipped,1);
 events.message({data:{type:'MESAI_SKIP_WAITING'},source:{url:'https://attacker.example/'},waitUntil(){throw Error('must reject')}});assert.equal(skipped,1);
 let page;events.fetch({request:{method:'GET',mode:'navigate',url:'https://berkaypn.github.io/Mesai-Takip/'},respondWith(p){page=p},waitUntil(){}});assert.equal(await page,cached);

 for(const data of [{kind:'notes',tag:'canias',title:'Canias',body:'2 dış görev',expiry:Date.now()+60000},{kind:'today',title:'OLD',body:'OLD',expiry:0},null]){
  let done;events.push({data:{json(){if(data===null)throw Error('bad');return data;}},waitUntil(p){done=p}});await done;
 }
 assert.equal(shown.length,3);assert.equal(shown[0].title,'Canias');assert.equal(shown[1].title,'Mesai Takip');assert.equal(shown[2].title,'Mesai Takip');
 let done;events.notificationclick({notification:{data:{tab:'notes'},close(){}},waitUntil(p){done=p}});await done;
 assert.equal(context.opened,'https://berkaypn.github.io/Mesai-Takip/?notification=notes');
 console.log(JSON.stringify({passed:8,method:'Real service worker core files, visible push fallbacks and app-scope notification click'}));
})().catch(e=>{console.error(e);process.exitCode=1});
