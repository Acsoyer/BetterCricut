import test from 'node:test';
import assert from 'node:assert/strict';
import {circularDilateAlpha} from '../app/editor/outline-mask.ts';

test('outline dilation makes a continuous circular offset without angular stamp gaps',()=>{
  const width=61,height=61,cx=30,cy=30,radius=17,alpha=new Uint8Array(width*height);
  alpha[cy*width+cx]=255;
  const expanded=circularDilateAlpha(alpha,width,height,radius);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++)
    assert.equal(Boolean(expanded[y*width+x]),(x-cx)**2+(y-cy)**2<=radius**2);
});

test('outline dilation keeps a sharp tip while joining its offset continuously',()=>{
  const width=80,height=70,alpha=new Uint8Array(width*height);
  for(let y=8;y<58;y++){
    const half=Math.floor((y-8)*.42);
    for(let x=40-half;x<=40+half;x++) alpha[y*width+x]=255;
  }
  const expanded=circularDilateAlpha(alpha,width,height,7);
  for(let y=1;y<height-1;y++){
    const xs=[];
    for(let x=0;x<width;x++) if(expanded[y*width+x]) xs.push(x);
    if(xs.length) for(let x=xs[0];x<=xs.at(-1);x++) assert.equal(expanded[y*width+x],255);
  }
});

test('blank rows around artwork do not introduce outline artifacts',()=>{
  const width=47,height=43,alpha=new Uint8Array(width*height);
  for(let y=19;y<=23;y++) for(let x=21;x<=25;x++) alpha[y*width+x]=255;
  const expanded=circularDilateAlpha(alpha,width,height,6);
  assert.equal(expanded.slice(0,width*10).some(Boolean),false);
  assert.equal(expanded.slice(width*32).some(Boolean),false);
});
