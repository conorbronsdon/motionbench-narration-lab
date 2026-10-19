import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {evaluate} from '../tools/evaluate.mjs';
const brief={id:'browser-controls',duration:.3,fps:10,formats:[{id:'wide',width:600,height:400,safe:[20,20,580,380]},{id:'tall',width:400,height:600,safe:[20,20,380,580]}],reads:[{id:'value',selector:'#value',text:'42 requests',cue:.1,toleranceFrames:0,hold:[.1,.3],minFontPx:24,stable:true}]};
const html=extra=>`<!doctype html><style>body{margin:0;background:#121725;color:white;font:30px Arial}#value{position:absolute;left:40px;top:80px} ${extra.css??''}</style><div id="value">42 requests</div>${extra.body??''}<script>window.seek=t=>{document.querySelector('#value').style.opacity=t<.1?0:1;${extra.seek??''}};${extra.script??''}</script>`;
test('browser adversarial controls', {timeout:120000}, async t=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'motion-lab-controls-'));
  const run=async(name,extra,inputBrief=brief)=>{const input=path.join(temp,`${name}.html`);await fs.writeFile(input,html(extra));return evaluate({html:input,brief:inputBrief,out:path.join(temp,name)});};
  await t.test('clean reference passes in both formats',async()=>assert.equal((await run('clean',{})).pass,true));
  await t.test('hidden exact text cannot establish arrival',async()=>{const r=await run('hidden',{css:'#value{visibility:hidden}'});assert.equal(r.pass,false);assert.ok(r.formats.every(f=>f.reads[0].arrival===null));});
  await t.test('ancestor clips all but the first glyph',async()=>{const r=await run('clip',{css:'#value{width:15px;overflow:hidden;white-space:nowrap}'});assert.ok(r.formats.every(f=>f.failures.some(x=>x.reasons?.includes('ancestor-clip'))));});
  await t.test('tight line-height does not clip intact numeral ink',async()=>{const r=await run('tight-line',{css:'#value{line-height:.92;overflow:hidden}',seek:"document.querySelector('#value').textContent='42';"},{...brief,reads:brief.reads.map(r=>({...r,text:'42'}))});assert.equal(r.pass,true);});
  await t.test('vertical clip still rejects removed glyph ink',async()=>{const r=await run('vertical-clip',{css:'#value{height:10px;overflow:hidden}'});assert.ok(r.formats.every(f=>f.failures.some(x=>x.reasons?.includes('ancestor-clip'))));});
  await t.test('source overflow appears in portrait only',async()=>{const r=await run('portrait',{css:'@media(max-width:450px){#value{left:350px}}'});assert.equal(r.formats[0].failures.length,0);assert.ok(r.formats[1].failures.length>0);});
  await t.test('exact-text hold regression is captured at final endpoint',async()=>{const r=await run('endpoint',{seek:"document.querySelector('#value').textContent=t>=.3?'43 requests':'42 requests';"});assert.ok(r.formats[0].failures.some(f=>f.t===.3&&f.kind==='hold'));});
  await t.test('history-dependent seek is detected independently of text state',async()=>{const r=await run('history',{seek:"document.body.style.background=(window.n=(window.n??0)+1)%2?'red':'blue';"});assert.ok(r.formats.some(f=>f.nondeterministic.length>0));});
  await t.test('attempted cross-origin fetch is rejected before it reaches the endpoint',async()=>{const r=await run('network',{script:"fetch('https://example.invalid/secret').catch(()=>{});"});assert.ok(r.blockedRequests.some(x=>x.kind==='csp'));assert.equal(r.pass,false);});
  await t.test('duplicate matching selectors fail instead of choosing a decoy',async()=>{const r=await run('duplicate',{body:'<div id="value">42 requests</div>'});assert.ok(r.formats[0].failures.some(f=>f.reasons?.includes('selector-count:2')));});
  await t.test('a seek that never completes reaches the execution timeout',async()=>{await assert.rejects(run('timeout',{script:'window.seek=()=>new Promise(()=>{});'}),/exceeded 10 seconds/);});
  // Temporary outputs contain only synthetic fixtures and are safe to remove after all jobs stop.
  await fs.rm(temp,{recursive:true,force:true});
});
