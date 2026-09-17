import test from 'node:test';
import assert from 'node:assert/strict';
import { remapSvgReference } from '../app/editor/svg-references.ts';

test('mask references are renamed exactly once even when IDs collide with new prefixes', () => {
  const ids=new Map([['island','w_island'],['w_island','w_w_island']]);
  assert.equal(remapSvgReference('url(#island)',ids), 'url(#w_island)');
  assert.equal(remapSvgReference('url("#island")',ids), 'url(#w_island)');
  assert.equal(remapSvgReference('mask:url(\'#island\');clip-path:url(#w_island)',ids), 'mask:url(#w_island);clip-path:url(#w_w_island)');
  assert.equal(remapSvgReference('#island',ids), '#w_island');
});

test('embedded alpha images and unrelated colors are unchanged', () => {
  const ids=new Map([['island','w_island']]);
  const source='data:image/png;base64,aGVsbG8=';
  assert.equal(remapSvgReference(source,ids), source);
  assert.equal(remapSvgReference('#b71919',ids), '#b71919');
  assert.equal(remapSvgReference('url(#unknown)',ids), 'url(#unknown)');
});
