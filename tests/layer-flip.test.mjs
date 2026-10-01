import test from 'node:test';
import assert from 'node:assert/strict';
import {flippedLayerBox} from '../app/editor/layer-flip.ts';

test('horizontal flip mirrors selected layer centres and preserves sizes',()=>{
  const area={x:2,y:3,w:10,h:8},layer={x:3,y:4,w:2,h:3,rotation:25};
  assert.deepEqual(flippedLayerBox(layer,area,'horizontal'),{x:9,y:4,w:2,h:3,rotation:-25});
});

test('vertical flip mirrors selected layer centres',()=>{
  const area={x:2,y:3,w:10,h:8},layer={x:3,y:4,w:2,h:3,rotation:0};
  assert.deepEqual(flippedLayerBox(layer,area,'vertical'),{x:3,y:7,w:2,h:3,rotation:-0});
});
