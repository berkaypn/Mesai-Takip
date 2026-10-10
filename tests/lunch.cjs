// Actual application JS with mocked DOM; browser rendering is not covered.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
process.env.TZ='Europe/Istanbul';
const html=fs.readFileSync(require('path').join(__dirname, '..', 'index.html'),'utf8');
const ts=(k,t)=>Date.parse(k+'T'+t+':00+03:00');
let clock=ts('2026-10-08','11:55');
const store=new Map(),results=[];
function boot(){
 const nodes={},events={},timers=[];
 const el=id=>nodes[id]??={dataset:{},style:{},value:'',textContent:'',innerHTML:'',hidden:false,className:'',classList:{toggle(){},add(){},remove(){}},addEventListener(t,f){events[id+':'+t]=f},blur(){},scrollIntoView(){},appendChild(){},remove(){},click(){}};
 class Clock extends Date {constructor(...a){super(...(a.length?a:[clock]))} static now(){return clock}}
 const doc={getElementById:el,activeElement:null,hidden:false,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(t,f){events['doc:'+t]=f},createElement:()=>el('created'),head:{appendChild(){}},body:{style:{},appendChild(){}}};
 const window={top:{},scrollTo(){}};
 const ctx={window,document:doc,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},navigator:{clipboard:{async writeText(csv){ctx.csv=csv}}},Date:Clock,setTimeout:()=>0,clearTimeout(){},setInterval:f=>timers.push(f),console};
 let code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 code=code.replace('  render();\n  if (!DEMO) connect();','  globalThis.api={get state(){return state},set state(v){state=v},DEF,norm,netWork,dayFark,targetNet,violations,breakSum,workLunch,targetEndFrom,render,renderLive,importCsv,saveLocal,autoCloseLunch,closeBreak}; render();');
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {a:ctx.api,ctx,el,events,timers,click(d){const t={dataset:d,classList:{add(){},remove(){}},textContent:'',closest(){return this}};events['doc:click']({target:t})}};
}
let b=boot(),a=b.a;
const plain=x=>JSON.parse(JSON.stringify(x));
const k='2026-10-08',seg=(t,s,e)=>({t,s:ts(k,s),e:e?ts(k,e):null});
function seed(day,segs,extra={}){a.state={days:{[day]:{segs,breaks:[],izin:false,type:'normal',caniasConfirmed:'',...(extra.day||{})}},open:extra.open||null,openWc:!!extra.openWc,set:{...a.DEF,...extra.set}};a.saveLocal();a.render()}
function check(name,fn){fn();results.push(name)}
function calc(name,segs,net,fark,extra={}){check(name,()=>{seed(k,segs,extra);const d=a.state.days[k];assert.deepEqual([a.netWork(k,d,clock)/60000,a.dayFark(k,d,clock)/60000],[net,fark])})}
calc('Ofis 08:00–17:30: 510 dk net, fark 0',[seg('o','08:00','17:30')],510,0);
calc('Dış görev 07:30–16:30: 510 dk net, fark 0',[seg('g','07:30','16:30')],510,0);
calc('Dış görev 08:00–17:00: 510 dk net, fark 0',[seg('g','08:00','17:00')],510,0);
calc('Kısa dış görev eksik kalır',[seg('g','08:00','16:30')],480,-30);
calc('Uzun dış görev +30 dk',[seg('g','08:00','17:30')],540,30);
calc('Ofis 07:30–16:30: 1 saat yemek kesintisi korunur',[seg('o','07:30','16:30')],480,-30);
calc('Öğleden önce dış görev ofis yemeğini kısaltmaz',[seg('g','08:00','11:00'),seg('o','11:00','17:30')],510,0);
calc('Karma gün 12:30–12:45 görev: sadece 15 dk geri sayılır',[seg('o','08:00','12:30'),seg('g','12:30','12:45'),seg('o','12:45','17:30')],525,15);
calc('12:45 başlayan görev: 15 dk ek çalışma',[seg('o','08:00','12:45'),seg('g','12:45','17:15')],510,0);
calc('Çakışan görev/ofis çift sayılmaz',[seg('o','08:00','17:30'),seg('g','12:30','13:00')],540,30);
calc('Yemek kapalıysa kesinti yok',[seg('g','08:00','17:30')],570,0,{set:{lunchS:null,lunchE:null}});
calc('Değişen yemek başlangıcı 11:30–12:30',[seg('g','07:30','16:30')],510,0,{set:{lunchS:690,lunchE:750}});
calc('20 dakikalık yemek ayarı uzatılmaz',[seg('g','08:00','17:30')],550,0,{set:{lunchS:720,lunchE:740}});
check('Hafta sonu yemek kesintisi ve hedef yok',()=>{const w='2026-10-10';seed(w,[{t:'g',s:ts(w,'07:30'),e:ts(w,'16:30')}]);assert.equal(a.dayFark(w,a.state.days[w],clock)/60000,540)});
check('Dış görev çekirdek ihlali 0 ve hedef 510 dk',()=>{seed(k,[seg('g','07:30','16:30')]);assert.equal(a.violations(k,a.state.days[k],clock).length,0);assert.equal(a.targetNet(k,a.state.days[k])/60000,510)});
check('Canlı hedef çıkış dış görev 16:30; ofis 17:00',()=>{for(const t of ['g','o']){seed(k,[seg(t,'07:30',null)]);assert.match(b.el('hSub').innerHTML,new RegExp(t==='g'?'16:30':'17:00'))}});
check('11:50 mola 12:00’da 10 dk kayıt olur',()=>{seed(k,[seg('o','08:00',null)],{open:ts(k,'11:50')});clock=ts(k,'12:00');b.timers[0]();assert.equal(a.state.open,null);assert.deepEqual(plain(a.state.days[k].breaks),[{s:ts(k,'11:50'),e:ts(k,'12:00')}]);assert.equal(a.breakSum(k,a.state.days[k],clock)/60000,10);assert.match(b.el('flow').innerHTML,/11:50 – 12:00/)});
check('Öğle içinde mola yeniden başlatılmaz',()=>{b.click({act:'breakStart'});assert.equal(a.state.open,null)});
check('Diğer sekmede otomatik kapanır, wc korunur',()=>{clock=ts(k,'11:59');seed(k,[seg('o','08:00',null)],{open:ts(k,'11:50'),openWc:true});b.click({tab:'log'});clock=ts(k,'12:00');b.timers[0]();assert.deepEqual(plain([a.state.open,a.state.openWc,a.state.days[k].breaks]),[null,false,[{s:ts(k,'11:50'),e:ts(k,'12:00'),wc:true}]])});
check('Arka plandan dönüş 12:00 kaydı üretir, tekrarlanmaz',()=>{clock=ts(k,'11:55');seed(k,[seg('o','08:00',null)],{open:ts(k,'11:50')});clock=ts(k,'13:10');b.events['doc:visibilitychange']();a.render();a.renderLive();assert.deepEqual(plain(a.state.days[k].breaks),[{s:ts(k,'11:50'),e:ts(k,'12:00')}])});
check('Öğleden sonra uygulama açılışında kalan mola kapanır',()=>{a.state.open=ts(k,'11:50');a.state.days[k].breaks=[];a.saveLocal();b=boot();a=b.a;assert.equal(a.state.open,null);assert.deepEqual(plain(a.state.days[k].breaks),[{s:ts(k,'11:50'),e:ts(k,'12:00')}])});
check('Öğleden sonraki mola kesilmez',()=>{seed(k,[seg('o','08:00',null)],{open:ts(k,'13:05')});assert.equal(a.state.open,ts(k,'13:05'))});
check('Yemek kapalıysa mola kesilmez',()=>{seed(k,[seg('o','08:00',null)],{open:ts(k,'11:50'),set:{lunchS:null,lunchE:null}});assert.equal(a.state.open,ts(k,'11:50'))});
check('Hafta sonu mola kesilmez',()=>{const w='2026-10-10';clock=ts(w,'12:10');seed(w,[{t:'o',s:ts(w,'08:00'),e:null}],{open:ts(w,'11:50')});assert.equal(a.state.open,ts(w,'11:50'))});
check('Değişmiş yemek başlangıcında tam o saatte kapanır',()=>{clock=ts(k,'11:20');seed(k,[seg('o','08:00',null)],{open:ts(k,'11:10'),set:{lunchS:690,lunchE:750}});clock=ts(k,'11:35');a.renderLive();assert.equal(a.state.days[k].breaks[0].e,ts(k,'11:30'))});
check('Yeniden açılışta Canias işareti, wc ve izin korunur',()=>{clock=ts(k,'17:30');seed(k,[seg('g','07:30','16:30')],{day:{caniasConfirmed:'07:30-16:30',breaks:[{s:ts(k,'10:00'),e:ts(k,'10:05'),wc:true}],izin:true}});b=boot();a=b.a;assert.equal(a.state.days[k].caniasConfirmed,'07:30-16:30');assert.equal(a.state.days[k].breaks[0].wc,true);assert.equal(a.state.days[k].izin,true);b.click({tab:'notes'});assert.equal(b.el('notesCount').textContent,'0 gün')});
check('Eski in/out ve mola dizi formatları hâlâ okunur',()=>{assert.equal(a.norm({in:ts(k,'08:00'),out:ts(k,'17:30'),breaks:[]}).segs[0].t,'o');assert.equal(a.norm([{s:ts(k,'10:00'),e:ts(k,'10:10')}]).breaks.length,1)});
check('Tüm gün dış görev düğmesi 08:00–17:00 ve fark 0',()=>{seed(k,[]);b.click({fullg:k});assert.equal(a.state.days[k].segs[0].e,ts(k,'17:00'));assert.equal(a.dayFark(k,a.state.days[k],clock),0)});
check('Mola dış göreve geçişte öğleden önce normal kapanır',()=>{clock=ts(k,'11:20');seed(k,[seg('o','08:00',null)],{open:ts(k,'11:10')});b.click({act:'task'});assert.equal(a.state.open,null);assert.equal(a.state.days[k].breaks[0].e,ts(k,'11:20'))});
check('Molalar net çalışmadan düşülmez',()=>{clock=ts(k,'17:30');seed(k,[seg('o','08:00','17:30')],{day:{breaks:[{s:ts(k,'10:00'),e:ts(k,'11:00')}]}});assert.equal(a.dayFark(k,a.state.days[k],clock),0)});
(async()=>{
 seed(k,[seg('g','07:30','16:30')],{day:{caniasConfirmed:'07:30-16:30',breaks:[{s:ts(k,'10:00'),e:ts(k,'10:05'),wc:true}],izin:true}});
 await b.events['export:click']();const csv=b.ctx.csv;assert.match(csv,/510;0;/);assert.match(csv,/Tuvalet/);
 a.state.days={};a.importCsv(csv);assert.equal(a.state.days[k].caniasConfirmed,'07:30-16:30');assert.equal(a.state.days[k].breaks[0].wc,true);assert.equal(a.dayFark(k,a.state.days[k],clock),0);results.push('CSV dışa/içe aktarma net süre, Canias ve wc korunur');
 if(process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json')+1],JSON.stringify({passed:results.length,method:'Actual application JavaScript, Node VM with clock and DOM event stubs; not a real browser',results},null,2));console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
