import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWeldCoverage } from '../app/editor/weld-preview.ts';

function alpha(width, height, rectangles) {
  const pixels=new Uint8ClampedArray(width*height*4);
  for(const [left,top,right,bottom] of rectangles)
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)pixels[(y*width+x)*4+3]=255;
  return pixels;
}

test('one-pixel boundary sampling differences do not pretend that pieces vanished', () => {
  const expected=alpha(32,32,[[5,5,20,20]]),actual=alpha(32,32,[[6,5,21,20]]);
  assert.deepEqual(inspectWeldCoverage(expected,actual,32,32),{foreground:225,missing:0,valid:true});
});

test('a missing separate thin piece is still rejected', () => {
  const expected=alpha(32,32,[[2,2,16,16],[25,4,26,24]]),actual=alpha(32,32,[[2,2,16,16]]);
  const result=inspectWeldCoverage(expected,actual,32,32);
  assert.equal(result.missing,20);assert.equal(result.valid,false);
});

test('missing interior geometry cannot be dismissed as antialiasing', () => {
  const expected=alpha(32,32,[[4,4,28,28]]),actual=alpha(32,32,[[4,4,28,28]]);
  for(let y=10;y<22;y++)for(let x=10;x<22;x++)actual[(y*32+x)*4+3]=0;
  const result=inspectWeldCoverage(expected,actual,32,32);
  assert.equal(result.missing,100);assert.equal(result.valid,false);
});

test('empty source coverage never passes validation', () => {
  assert.equal(inspectWeldCoverage(alpha(8,8,[]),alpha(8,8,[]),8,8).valid,false);
});
