import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(['./gap-contour-sampling','./svg-subpaths'].includes(specifier) ? specifier+'.ts' : specifier, context); } });
const { polygonArea, containsPoint, fillVectorGaps } = await import('../app/editor/vector-gap-fill.ts');
test('hole nesting distinguishes gaps from adjacent separate pieces', () => {
  const outer = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  assert.equal(polygonArea(outer),10000);
  assert.equal(containsPoint(outer,{x:25,y:25}),true);
  assert.equal(containsPoint(outer,{x:110,y:25}),false);
  assert.equal(polygonArea([...outer].reverse()),-10000);
});
test('zero fill returns the exact unmodified vector source', async () => {
  const svg = '<svg><path d="M0 0C1 2 3 4 5 6Z"/></svg>';
  assert.equal(await fillVectorGaps(svg,10,10,0),svg);
});
test('Fill Gaps actions never rasterize or retrace the outer contour', () => {
  const page = readFileSync(new URL('../app/editor/page.tsx',import.meta.url),'utf8');
  const actions = page.slice(page.indexOf('  const applyGapPreview ='),page.indexOf('  const makeGapsPermanent ='));
  assert.equal(/strokeImage|smoothVectorCutout|vTracerCutout|trimTransparent/.test(actions),false);
  assert.equal((actions.match(/fillVectorGaps\(/g)||[]).length,2);
  const source=readFileSync(new URL('../app/editor/vector-gap-fill.ts',import.meta.url),'utf8');
  assert.ok(source.includes('map(entry => entry.part).join(""'));
});

test('generated cubic holes fill without browser length traversal or rewriting outer commands', async () => {
  const outer='M0 0 C0 0 100 0 100 0 L100 100 L0 100 Z ';
  const hole='M20 20 L20 40 L40 40 L40 20 Z ';
  const island='M25 25 L30 25 L30 30 L25 30 Z';
  let d=outer+hole+island;
  const originals=new Map(['document','DOMParser','XMLSerializer','getComputedStyle'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const path={getAttribute:()=>d,getCTM:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),setAttribute:(_,value)=>{d=value;}};
  const live={getBoundingClientRect:()=>({width:100,height:100}),querySelectorAll:()=>[path]};
  globalThis.document={createElement:()=>({style:{},append(){},remove(){}}),importNode:()=>live,body:{append(){}},createElementNS(){throw new Error('Unexpected browser path-length sampling');}};
  globalThis.DOMParser=class {parseFromString(){return {querySelector:()=>null,documentElement:live};}};
  globalThis.XMLSerializer=class {serializeToString(){return d;}};
  globalThis.getComputedStyle=()=>({fillRule:'evenodd'});
  try {
    assert.equal(await fillVectorGaps('<svg/>',10,10,'all'),outer);
    d=outer+hole+island;
    assert.equal(await fillVectorGaps('<svg/>',10,10,1),outer+hole+island);
    d="M0 0 L100 0 L100 100 L0 100 L0 0 M20 20 L20 40 L40 40 L40 20 L20 20";
    assert.equal(await fillVectorGaps("<svg/>",10,10,"all"),"M0 0 L100 0 L100 100 L0 100 L0 0 ");
    d="m0 0 h100 v100 h-100 z m20 20 v20 h20 v-20 z";
    assert.equal(await fillVectorGaps("<svg/>",10,10,"all"),"M0 0 h100 v100 h-100 z ");
  } finally {
    for(const [key,descriptor] of originals) {if(descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];}
  }
});