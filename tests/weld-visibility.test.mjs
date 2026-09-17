import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isLayerVisible } from '../app/editor/layer-visibility.ts';

test('hidden layers and hidden group members cannot enter scene operations', () => {
  assert.equal(isLayerVisible({visible:true}), true);
  assert.equal(isLayerVisible({visible:false}), false);
  assert.equal(isLayerVisible({visible:true,groupHidden:true}), false);
  const layers=[{id:'frame',visible:true},{id:'cake',visible:true},{id:'hidden',visible:true,groupHidden:true}];
  assert.deepEqual(layers.filter(isLayerVisible).map(layer=>layer.id), ['frame','cake']);
});

test('weld preserves source SVG root attributes and rejects empty replacements', () => {
  const code=readFileSync(new URL('../app/editor/page.tsx',import.meta.url),'utf8');
  const weld=code.slice(code.indexOf('const weldSelection ='),code.indexOf('const renderCanvas ='));
  assert.ok(weld.includes('sourceRoot.attributes'));
  assert.ok(weld.includes('content.appendChild(output.importNode(node,true))'));
  assert.ok(!weld.includes('vTracerCutout'));
  assert.ok(!weld.includes('const nested='));
  assert.ok(weld.includes('groupHidden: false'));
  assert.ok(weld.includes('Original layers were preserved.'));
  assert.ok(weld.indexOf('Original layers were preserved.') < weld.lastIndexOf('setLayers('));
  assert.ok(code.includes('return isLayerVisible(l) && b.x < marquee'));
  assert.ok(code.includes('selected.includes(l.id) && isLayerVisible(l)'));
});
