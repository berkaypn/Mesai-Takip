const assert=require('node:assert/strict'),{boot,ts}=require('./harness.cjs');
const b=boot({now:ts('2026-10-12',600)}),day='2026-10-12';b.seed(day,[{t:'o',s:ts(day,480),e:null}],{open:ts(day,595)});
const counts={};for(const id of ['hSub','todayTL','flow']){const node=b.el(id);let value=node.innerHTML;counts[id]=0;Object.defineProperty(node,'innerHTML',{get(){return value},set(v){counts[id]++;value=v}});}
const raw=b.storage.get('molaTakip:v1');for(let i=1;i<60;i++){b.setTime(ts(day,600)+i*1000);b.api.renderLive();}
assert.deepEqual(counts,{hSub:0,todayTL:0,flow:0});assert.equal(b.el('hBig').textContent,'5:59');assert.equal(b.storage.get('molaTakip:v1'),raw);
b.setTime(ts(day,601));b.api.renderLive();assert.ok(counts.hSub>0);const before={...counts};b.context.document.hidden=true;b.setTime(ts(day,602));b.api.renderLive();assert.deepEqual(counts,before);assert.equal(b.storage.get('molaTakip:v1'),raw);
b.context.document.hidden=false;b.events['doc:visibilitychange']();assert.equal(b.el('hBig').textContent,'7:00');
console.log(JSON.stringify({checks:5,seconds:59,repeatedTimelineWrites:0,method:'Actual app JS; seconds update stopwatch only; minute refresh and background/resume verified'}));
