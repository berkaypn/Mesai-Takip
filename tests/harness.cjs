// Exercises the actual inline application script. DOM stubs do not verify browser layout.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.TZ = 'Europe/Istanbul';
const ts = (day, minute) => new Date(Number(day.slice(0,4)), Number(day.slice(5,7))-1, Number(day.slice(8,10)), 0, minute).getTime();
const plain = value => JSON.parse(JSON.stringify(value));
function boot(options = {}) {
  let clock = options.now || ts('2026-10-08', 1080);
  const storage = options.storage || new Map(), nodes = {}, events = {}, timers = [];
  const el = id => nodes[id] ||= { dataset:{}, style:{setProperty(){}}, value:'', textContent:'', innerHTML:'', hidden:false, className:'', classList:{toggle(){},add(){},remove(){}}, addEventListener(type, fn){events[id+':'+type] = fn;}, blur(){}, scrollIntoView(){}, appendChild(){}, setAttribute(){}, remove(){}, click(){} };
  class Clock extends Date { constructor(...args){super(...(args.length ? args : [clock]));} static now(){return clock;} }
  const document = {getElementById:el, activeElement:null, hidden:false, querySelectorAll:()=>[], querySelector:()=>null, addEventListener(type,fn){events['doc:'+type] = fn;}, createElement:()=>el('created'), head:{appendChild(){}}, body:{style:{},appendChild(){}}};
  const window = {top:{},scrollTo(){}};
  const context = {window,document,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},navigator:{clipboard:{async writeText(csv){context.csv=csv;}}},Date:Clock,setTimeout:()=>0,clearTimeout(){},setInterval:fn=>timers.push(fn),console};
  const html = options.html || fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  let source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  source = source.replace('  render();\n  if (!DEMO) connect();', '  globalThis.api={get state(){return state},set state(v){state=v},DEF,norm,netWork,dayFark,targetNet,violations,breakSum,wcSum,workLunch,targetEndFrom,timelineHtml,render,renderLive,importCsv,saveLocal,closeBreak,breakError,startSeg,endDay}; render();');
  vm.createContext(context); vm.runInContext(source,context);
  const api = context.api;
  return {api,el,events,timers,storage,context,setTime(value){clock=value;},get now(){return clock;},click(dataset){const target={dataset,classList:{add(){},remove(){}},textContent:'',closest(){return this;}};events['doc:click']({target});},change(dataset,value){events['doc:change']({target:{dataset,value,blur(){}}});},seed(day,segs,extra={}){api.state={days:{[day]:{segs,breaks:[],izin:false,type:'normal',caniasConfirmed:'',...(extra.day||{})}},open:extra.open||null,openWc:!!extra.openWc,set:{...api.DEF,...extra.set}};api.saveLocal();api.render();}};
}
module.exports = {boot, ts, plain};
