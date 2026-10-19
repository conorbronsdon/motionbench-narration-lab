import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBrief, sampleTimes, assessRead} from '../tools/contract.mjs';
const fixture = () => ({id:'test',duration:1,fps:10,formats:[{id:'wide',width:800,height:600,safe:[20,20,780,580]}],reads:[{id:'number',selector:'#number',text:'42',cue:.3,toleranceFrames:0,hold:[.3,.95],minFontPx:24,stable:true}]});
const sample = (t, changes={}) => ({t,text:'42',visible:true,fits:true,font:30,box:[30,30,80,70],reasons:[],...changes});
test('schema rejects empty checks, duplicate IDs, invalid holds and unsafe rectangles',()=>{
  for(const mutate of [b=>b.reads=[],b=>b.reads.push(b.reads[0]),b=>b.reads[0].hold=[.8,.2],b=>b.formats[0].safe=[0,0,900,600]]) {const b=fixture();mutate(b);assert.throws(()=>validateBrief(b));}
});
test('sample schedule explicitly includes a hold endpoint between frames',()=>assert.ok(sampleTimes(fixture()).includes(.95)));
test('early exact arrival fails even if the entire hold is perfect',()=>{
  const r=assessRead(fixture().reads[0],[sample(.1),sample(.3),sample(.95)],10);assert.equal(r.arrival,.1);assert.ok(r.failures.some(f=>f.kind==='cue'));
});
test('late hold endpoint regression and motion produce separate defects',()=>{
  const r=assessRead(fixture().reads[0],[sample(.3),sample(.8,{box:[40,30,90,70]}),sample(.95,{text:'43'})],10);assert.ok(r.failures.some(f=>f.kind==='unstable'));assert.ok(r.failures.some(f=>f.kind==='hold'&&f.t===.95));
});
test('a hidden or clipped exact-text decoy cannot establish arrival',()=>{
  for(const change of [{visible:false},{fits:false},{font:12}]){const r=assessRead(fixture().reads[0],[sample(.1,change),sample(.3),sample(.95)],10);assert.equal(r.arrival,.3);assert.equal(r.failures.length,0);}
});
