import test from 'node:test';
import assert from 'node:assert/strict';
import {packProjectLayers,unpackProjectLayers,projectSaveError} from '../app/editor/project-data.ts';
const original='data:image/png;base64,b3JpZ2luYWw=';
const first='data:image/png;base64,Zmlyc3Q=';
const last='data:image/png;base64,bGFzdA==';
const step=(id,src,before)=>({id,type:'remove-bg',before:{src:before},snapshot:{src},removalSettings:{strokes:[]}});
test('saving collapses BGR only in detached saved data',()=>{
 const layers=[{src:last,originalSrc:original,steps:[step('first',first,original),step('last',last,first)],activeStep:1}];
 const before=JSON.stringify(layers);
 const packed=packProjectLayers(layers), restored=unpackProjectLayers(packed);
 assert.equal(JSON.stringify(layers),before);
 assert.equal(restored[0].steps.length,1);
 assert.equal(restored[0].steps[0].snapshot.src,last);
 assert.equal(restored[0].steps[0].before.src,original);
 assert.equal(restored[0].activeStep,0);
 assert.equal(restored[0].steps[0].baked,true);
 assert.equal(Object.values(packed.assets).includes(first),false);
});
test('nested shape and unweld sources share the same asset',()=>{
 const layers=[{src:original,steps:[],shapeImage:{source:{src:original,steps:[]}},weldedSources:[{src:original,steps:[]}]}];
 const packed=packProjectLayers(layers);
 assert.equal(Object.keys(packed.assets).length,1);
 assert.deepEqual(unpackProjectLayers(packed),layers);
});
test('non BGR steps and active history position are retained',()=>{
 const layers=[{src:last,steps:[step('first',first,original),step('last',last,first),{type:'cutout',snapshot:{src:'data:image/svg+xml,%3Csvg/%3E'}}],activeStep:2}];
 const restored=unpackProjectLayers(packProjectLayers(layers));
 assert.deepEqual(restored[0].steps.map(s=>s.type),['remove-bg','cutout']);
 assert.equal(restored[0].activeStep,1);
});
test('old inline projects still open and missing assets fail explicitly',()=>{
 assert.deepEqual(unpackProjectLayers({layers:[{src:original}]}),[{src:original}]);
 assert.throws(()=>unpackProjectLayers({layers:[{src:'asset://missing'}]}),/missing/);
 assert.match(projectSaveError('STORAGE_LIMIT_ALREADY_EXCEEDED'),/Storage limit/);
});
test('two uses of a 384 KB image keep only one approximately 512 KB encoded asset',()=>{
 const image='data:image/png;base64,'+Buffer.alloc(384*1024,1).toString('base64');
 const layers=[{src:image,originalSrc:image,steps:[]},{src:image,originalSrc:image,steps:[]}];
 const packed=packProjectLayers(layers);
 assert.equal(Object.keys(packed.assets).length,1);
 assert.ok(new Blob([JSON.stringify(packed)]).size<514*1024);
});
test('saving an earlier selected BGR result retains that applied result',()=>{
 const layer={src:first,steps:[step('first',first,original),step('future',last,first)],activeStep:0};
 const restored=unpackProjectLayers(packProjectLayers([layer]));
 assert.equal(restored[0].steps[0].snapshot.src,first);
 assert.equal(restored[0].activeStep,0);
 assert.equal(restored[0].src,first);
});
