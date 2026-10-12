const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),events={},shown=[];
const context={self:{addEventListener(t,fn){events[t]=fn},registration:{scope:'https://berkaypn.github.io/Mesai-Takip/',showNotification(title,options){shown.push({title,options});return Promise.resolve();}},clients:{async matchAll(){return []},async openWindow(url){context.opened=url}}},Date,URL,console};
vm.createContext(context);vm.runInContext(source,context);
assert.match(source,/mesai-takip-v13/);
for(const file of ['notifications-config.js','notification-rules.js','notifications.js']){assert.ok(source.includes(file));assert.ok(fs.statSync(path.join(__dirname,'..',file)).size>0);}
(async()=>{
 for(const data of [{kind:'notes',tag:'canias',title:'Canias',body:'2 dış görev',expiry:Date.now()+60000},{kind:'today',title:'OLD',body:'OLD',expiry:0},null]){
  let done;events.push({data:{json(){if(data===null)throw Error('bad');return data;}},waitUntil(p){done=p}});await done;
 }
 assert.equal(shown.length,3);assert.equal(shown[0].title,'Canias');assert.equal(shown[1].title,'Mesai Takip');assert.equal(shown[2].title,'Mesai Takip');
 let done;events.notificationclick({notification:{data:{tab:'notes'},close(){}},waitUntil(p){done=p}});await done;
 assert.equal(context.opened,'https://berkaypn.github.io/Mesai-Takip/?notification=notes');
 console.log(JSON.stringify({passed:4,method:'Real service worker core files, visible push fallbacks and app-scope notification click'}));
})().catch(e=>{console.error(e);process.exitCode=1});
