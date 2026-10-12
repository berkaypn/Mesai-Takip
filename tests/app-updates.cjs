const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('path').join(__dirname,'../app-updates.js'),'utf8');
function fixture({waiting=true,controller=true,blocked=false}={}){
 const events={},nodes={},writes=[],el=id=>nodes[id]||={hidden:true,disabled:false,textContent:'',addEventListener(t,f){events[id+':'+t]=f}},worker={postMessage(m){writes.push(m)},addEventListener(t,f){events['worker:'+t]=f},state:'installed'};
 const reg={waiting:waiting?worker:null,installing:null,addEventListener(t,f){events['reg:'+t]=f},async update(){writes.push('update')}};
 const sw={controller:controller?{}:null,addEventListener(t,f){events['sw:'+t]=f},async register(url,options){writes.push({url,options});return reg}};
 const context={window:{addEventListener(t,f){events['win:'+t]=f}},document:{hidden:false,getElementById:el,addEventListener(t,f){events['doc:'+t]=f}},navigator:{serviceWorker:sw,onLine:true},location:{protocol:'https:',reload(){writes.push('reload')}},localStorage:{setItem(){throw Error('must not write attendance')},clear(){throw Error('must not clear attendance')}},Date,setInterval(){}};
 vm.createContext(context);vm.runInContext(source,context);let deny=blocked;const api=context.window.MesaiAppUpdates.start({canReload:()=>!deny});return {api,events,reg,sw,context,el,writes,setBlocked(v){deny=v}};
}
(async()=>{
 const f=fixture();await Promise.resolve();assert.equal(f.el('appUpdateBanner').hidden,false);assert.equal(f.writes[0].options.updateViaCache,'none');assert.equal(f.writes.includes('reload'),false);
 f.setBlocked(true);f.events['appUpdateApply:click']();assert.equal(f.writes.length,1);assert.match(f.el('appUpdateStatus').textContent,/düzenleme/);
 f.setBlocked(false);f.events['appUpdateApply:click']();assert.equal(f.writes.at(-1).type,'MESAI_SKIP_WAITING');f.events['sw:controllerchange']();f.events['sw:controllerchange']();assert.equal(f.writes.filter(x=>x==='reload').length,1);
 const fresh=fixture({waiting:false,controller:false});await Promise.resolve();fresh.events['sw:controllerchange']();assert.equal(fresh.el('appUpdateBanner').hidden,true);assert.equal(fresh.writes.includes('reload'),false);
 const another=fixture({waiting:false});await Promise.resolve();another.events['sw:controllerchange']();assert.equal(another.el('appUpdateBanner').hidden,false);assert.equal(another.writes.includes('reload'),false);another.events['appUpdateApply:click']();assert.equal(another.writes.at(-1),'reload');
 const failed=fixture({waiting:false});await Promise.resolve();failed.reg.update=async()=>{throw Error('offline')};await failed.api.check();assert.match(failed.el('appUpdateStatus').textContent,/Bağlantı/);assert.equal(failed.writes.includes('reload'),false);
 console.log(JSON.stringify({checks:8,method:'Actual updater JS; explicit consent, unfinished form, first install, other tabs, one reload, offline failure; no attendance writes'}));
})().catch(e=>{console.error(e);process.exitCode=1});
