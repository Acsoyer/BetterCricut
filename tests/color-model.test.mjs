import test from 'node:test';
import assert from 'node:assert/strict';
import { hsv,hex,normalizePickedColors } from '../app/editor/color-model.ts';
test('shared advanced color plane preserves exact hex colors including gray and black',()=>{
  for(const color of ['#248ece','#ffffff','#000000','#888888','#ef9999','#ff0000','#00ff00','#0000ff']) {
    const value=hsv(color);assert.equal(hex(value.h,value.s,value.v),color);
  }
});
test('previous BGR records with empty or missing picked colors retain one usable picker',()=>{
  assert.deepEqual(normalizePickedColors([]),[{color:null,sensitivity:30}]);
  assert.equal(normalizePickedColors(undefined).length,1);
  const input=[{color:'#ffffff',sensitivity:0}];const result=normalizePickedColors(input);
  assert.deepEqual(result,input);assert.notEqual(result[0],input[0]);
  assert.equal(normalizePickedColors([...input,...input,...input,...input]).length,3);
});
