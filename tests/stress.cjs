const assert = require('node:assert/strict');
const fs = require('node:fs');
const {boot,ts,plain} = require('./harness.cjs');
const day='2026-10-08', seg=(t,s,e)=>({t,s:ts(day,s),e:e==null?null:ts(day,e)});
const results=[];
function test(name,fn){try{fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
// Independent minute-by-minute reference, rather than the application's interval helpers.
function reference(segs,weekend=false){let net=0;for(let m=0;m<1440;m++){const active=segs.filter(s=>s.s<=m&&s.e>m);if(!active.length)continue;if(!weekend&&m>=720&&m<780&&!(m>=750&&active.some(s=>s.t==='g')))continue;net++;}return net;}
let generated=0;
for(const order of [['o','g'],['g','o']]) for(const start of [390,450,480,510,540]) for(const transition of [600,710,719,720,721,749,750,751,765,779,780,781,900]) for(const gap of [0,1,15,60]) for(const end of [990,1020,1050,1080]) {
 if(transition+gap>=end)continue;
 const spans=[{t:order[0],s:start,e:transition},{t:order[1],s:transition+gap,e:end}];
 test(`mixed/${order.join('→')}/${start}/${transition}/${gap}/${end}`,()=>{const b=boot();b.seed(day,spans.map(s=>seg(s.t,s.s,s.e)));assert.equal(b.api.netWork(day,b.api.state.days[day],b.now)/60000,reference(spans));});generated++;
}
test('past-end-clear: invalid edit must preserve original end',()=>{const b=boot({now:ts('2026-10-09',1080)});b.seed(day,[seg('o',480,600),seg('g',600,1050)]);b.change({f:'e',k:day,i:'0'},'');assert.equal(b.api.state.days[day].segs[0].e,ts(day,600));});
test('overlap-add: office cannot overlap an external duty record',()=>{const b=boot();b.seed(day,[seg('o',480,600)]);b.click({edit:'today'});b.click({addkind:'g'});b.el('addS').value='09:00';b.el('addE').value='11:00';b.click({addsave:day});assert.equal(b.api.state.days[day].segs.length,1);});
test('full-day-existing: full-duty shortcut cannot overwrite a mixed day',()=>{const b=boot();b.seed(day,[seg('o',480,600),seg('g',600,1020)]);const before=plain(b.api.state.days[day]);b.click({fullg:day});assert.deepEqual(plain(b.api.state.days[day]),before);});
test('overlap-edit: segment edit must reject a conflicting time',()=>{const b=boot();b.seed(day,[seg('o',480,600),seg('g',600,1020)]);b.change({f:'e',k:day,i:'0'},'11:00');assert.equal(b.api.state.days[day].segs[0].e,ts(day,600));});
test('multiple-open-import: second running location must be rejected atomically',()=>{const b=boot();const before=plain(b.api.state);assert.throws(()=>b.api.importCsv('Tarih;Ofis;Dış görev\n2026-10-08;08:00-;10:00-'));assert.deepEqual(plain(b.api.state),before);});
test('invalid-csv-time: 08:75 is rejected without corrupting existing data',()=>{const b=boot();b.seed(day,[seg('o',480,1050)]);const before=plain(b.api.state);assert.throws(()=>b.api.importCsv('Tarih;Ofis;Dış görev\n2026-10-08;;09:75-16:30'));assert.deepEqual(plain(b.api.state),before);});
test('invalid-csv-date: September 31 is not a valid day',()=>{const b=boot();const before=plain(b.api.state);assert.throws(()=>b.api.importCsv('Tarih;Ofis\n2026-09-31;08:00-17:30'));assert.deepEqual(plain(b.api.state),before);});
test('reversed-csv-time: end earlier than start is not zero-duration work',()=>{const b=boot();assert.throws(()=>b.api.importCsv('Tarih;Ofis\n2026-10-08;17:30-08:00'));assert.equal(Object.keys(b.api.state.days).length,0);});
test('conflicting-csv-backup: changed end is not silently ignored',()=>{const b=boot();b.seed(day,[seg('g',450,990)]);const before=plain(b.api.state);assert.throws(()=>b.api.importCsv('Tarih;Ofis;Dış görev\n2026-10-08;;07:30-17:00'));assert.deepEqual(plain(b.api.state),before);});
test('overlapping-breaks: 10:00–10:30 and 10:15–10:45 total 45 min',()=>{const b=boot();b.seed(day,[seg('o',480,1050)],{day:{breaks:[{s:ts(day,600),e:ts(day,630)},{s:ts(day,615),e:ts(day,645)}]}});assert.equal(b.api.breakSum(day,b.api.state.days[day],b.now)/60000,45);});
test('break-in-work-gap: gap between office and duty cannot count as office break',()=>{const b=boot();b.seed(day,[seg('o',480,600),seg('g',660,1020)],{day:{breaks:[{s:ts(day,590),e:ts(day,670)}]}});assert.equal(b.api.breakSum(day,b.api.state.days[day],b.now)/60000,10);});
test('wc-overlap: WC overlaps are not counted twice',()=>{const b=boot();b.seed(day,[seg('o',480,1050)],{day:{breaks:[{s:ts(day,600),e:ts(day,630),wc:true},{s:ts(day,615),e:ts(day,645),wc:true}]}});assert.equal(b.api.wcSum(day,b.api.state.days[day],b.now)/60000,45);});
test('manual-open-return: return after lunch still closes pre-lunch break at noon',()=>{const b=boot({now:ts(day,715)});b.seed(day,[seg('o',480,null)],{open:ts(day,710),openWc:true});b.setTime(ts(day,790));b.change({of:'e'},'13:10');assert.equal(b.api.state.days[day].breaks[0].e,ts(day,720));assert.equal(b.api.state.days[day].breaks[0].wc,true);});
test('timeline-target-gap: target marker includes the 60-min absence',()=>{const b=boot();b.seed(day,[seg('o',480,600),seg('g',660,1050)]);const x=b.api.state.days[day],markup=b.api.timelineHtml(day,x,b.now,true);const percent=Number(/class="t" style="left:calc\(([\d.]+)%/.exec(markup)[1]);assert.equal(percent,100);assert.match(markup,/18:00/);});
test('valid-identical-backup: duplicate import remains idempotent',()=>{const b=boot();const csv='Tarih;Ofis;Dış görev\n2026-10-08;08:00-10:00;10:00-17:00';b.api.importCsv(csv);const before=plain(b.api.state);b.api.importCsv(csv);assert.deepEqual(plain(b.api.state),before);});
test('switch-while-breaking: break closes exactly on duty transition',()=>{const b=boot({now:ts(day,590)});b.seed(day,[seg('o',480,null)],{open:ts(day,580)});b.click({act:'task'});assert.equal(b.api.state.open,null);assert.equal(b.api.state.days[day].breaks[0].e,ts(day,590));assert.equal(b.api.state.days[day].segs[1].t,'g');});
test('core-gap-is-preserved: full net target does not erase core absence',()=>{const b=boot();b.seed(day,[seg('o',420,600),seg('g',660,1080)]);const d=b.api.state.days[day];assert.equal(b.api.dayFark(day,d,b.now)/60000,60);assert.equal(b.api.violations(day,d,b.now).reduce((sum,v)=>sum+v.e-v.s,0)/60000,60);});
const monthly = [];
for(let n=1;n<=30;n++) {
 const k='2026-09-'+String(n).padStart(2,'0'),start=[450,480,510,540][n%4],transition=[710,720,749,750,780,840][n%6],end=[990,1020,1050,1080][n%4],order=n%2?['o','g']:['g','o'];
 test('month/day-'+n+'/live-'+order.join('→'),()=>{
  const b=boot({now:ts(k,start)});b.api.startSeg(order[0],b.now);
  const weekend=[0,6].includes(new Date(ts(k,0)).getDay());
  let breakExpected;
  if(order[0]==='o'){
   const pause=Math.min(710,transition-10);b.setTime(ts(k,pause));b.click({act:'breakStart'});
   breakExpected=(weekend?transition:Math.min(transition,720))-pause;
  }
  b.setTime(ts(k,transition));b.api.startSeg(order[1],b.now);b.api.render();
  if(order[1]==='o'){
   const pause=Math.max(transition+10,790);b.setTime(ts(k,pause));b.click({act:'breakStart'});b.setTime(ts(k,pause+15));b.click({act:'breakEnd'});breakExpected=15;
  }
  b.setTime(ts(k,end));b.api.endDay(b.now);
  const d=b.api.state.days[k],spans=[{t:order[0],s:start,e:transition},{t:order[1],s:transition,e:end}];
  assert.equal(d.segs.length,2);assert.equal(d.segs.filter(s=>s.t==='o').length,1);assert.equal(d.segs.filter(s=>s.t==='g').length,1);assert.equal(b.api.state.open,null);
  const expected=reference(spans,weekend);assert.equal(b.api.netWork(k,d,b.now)/60000,expected);assert.equal(b.api.breakSum(k,d,b.now)/60000,breakExpected);
  monthly.push({date:k,segs:plain(d.segs),breaks:plain(d.breaks),expectedNetMinutes:expected,expectedDifferenceMinutes:expected-(weekend?0:510)});
 });
}
test('atomic-import: a valid first row followed by a bad row saves nothing',()=>{const b=boot();b.seed(day,[seg('o',480,1050)]);const before=plain(b.api.state),saved=b.storage.get('molaTakip:v1');assert.throws(()=>b.api.importCsv('Tarih;Ofis\n2026-10-07;08:00-17:30\n2026-10-08;09:75-18:00'));assert.deepEqual(plain(b.api.state),before);assert.equal(b.storage.get('molaTakip:v1'),saved);});
test('legacy-break-only: old location-free records retain totals',()=>{const b=boot();b.seed(day,[],{day:{breaks:[{s:ts(day,600),e:ts(day,630)}]}});assert.equal(b.api.breakSum(day,b.api.state.days[day],b.now)/60000,30);});
test('wc-normal-overlap: total 45, WC 30, ordinary break 15',()=>{const b=boot();b.seed(day,[seg('o',480,1050)],{day:{breaks:[{s:ts(day,600),e:ts(day,630)},{s:ts(day,615),e:ts(day,645),wc:true}]}});const d=b.api.state.days[day];assert.equal(b.api.breakSum(day,d,b.now)/60000,45);assert.equal(b.api.wcSum(day,d,b.now)/60000,30);});
test('live-break-overlap: imported break and running break display 45 min, not 60',()=>{const b=boot({now:ts(day,645)});b.seed(day,[seg('o',480,null)],{open:ts(day,615)});b.api.importCsv('Tarih;Ofis\n2026-10-08;08:00-\n\nMolalar\nTarih;Çıkış;Giriş;Süre (dk);Sayılan (dk);Tür\n2026-10-08;10:00;10:30;;;');b.api.render();assert.equal(b.el('tBrk').innerHTML,'45 dk');b.click({tab:'sum'});assert.match(b.el('sumBody').innerHTML,/<span>Mola<\/span><b>45 dk<\/b>/);});
test('canias-valid-edit: accepted duty time change reopens reminder',()=>{const b=boot();b.seed(day,[seg('o',480,600),seg('g',600,1020)],{day:{caniasConfirmed:'10:00-17:00'}});b.change({f:'e',k:day,i:'1'},'17:30');b.click({tab:'notes'});assert.equal(b.el('notesCount').textContent,'1 gün');});
test('canias-invalid-edit: rejected overlap keeps confirmation',()=>{const b=boot();b.seed(day,[seg('o',480,600),seg('g',600,1020)],{day:{caniasConfirmed:'10:00-17:00'}});b.change({f:'s',k:day,i:'1'},'09:00');b.click({tab:'notes'});assert.equal(b.el('notesCount').textContent,'0 gün');});
test('csv-zero-minute: legitimate minute-rounded zero record survives import',()=>{const b=boot();b.api.importCsv('Tarih;Ofis;Dış görev\n2026-10-08;08:00-08:00;08:00-17:00');assert.equal(b.api.state.days[day].segs.length,2);});
test('legacy-backup-no-type: old CSV preserves existing WC classification',()=>{const b=boot();b.seed(day,[seg('o',480,1050)],{day:{breaks:[{s:ts(day,600),e:ts(day,615),wc:true}]}});b.api.importCsv('Tarih;Ofis\n2026-10-08;08:00-17:30\n\nMolalar\nTarih;Çıkış;Giriş;Süre (dk);Sayılan (dk)\n2026-10-08;10:00;10:15;;');assert.equal(b.api.state.days[day].breaks[0].wc,true);});
(async()=>{
 const b=boot({now:ts('2026-09-30',1140)});
 b.api.state={days:Object.fromEntries(monthly.map(r=>[r.date,{segs:r.segs,breaks:r.breaks,type:'normal',izin:false,caniasConfirmed:''}])),open:null,openWc:false,set:{...b.api.DEF}};
 await b.events['export:click']();
 const csv=b.context.csv, before=plain(b.api.state.days);
 test('month-backup: 30 mixed days including all pauses round-trip exactly',()=>{b.api.state.days={};b.api.importCsv(csv);assert.deepEqual(plain(b.api.state.days),before);});
 test('month-backup-repeat: same 30-day backup cannot duplicate records',()=>{const before=plain(b.api.state);b.api.importCsv(csv);assert.deepEqual(plain(b.api.state),before);});
 test('month-aggregate: restored net and difference equal independent day totals',()=>{let net=0,diff=0;for(const row of monthly){const d=b.api.state.days[row.date];net+=b.api.netWork(row.date,d,b.now)/60000;diff+=b.api.dayFark(row.date,d,b.now)/60000;}assert.equal(net,monthly.reduce((sum,r)=>sum+r.expectedNetMinutes,0));assert.equal(diff,monthly.reduce((sum,r)=>sum+r.expectedDifferenceMinutes,0));});
 const failures=results.filter(r=>!r.pass);
 const summary={generated,checks:results.length,passed:results.length-failures.length,failures};
 if(process.argv.includes('--json'))fs.writeFileSync(process.argv[process.argv.indexOf('--json')+1],JSON.stringify({...summary,monthly},null,2));
 console.log(JSON.stringify(summary,null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
