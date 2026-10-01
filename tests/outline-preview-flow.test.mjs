import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/editor/page.tsx',import.meta.url),'utf8');

test('outline preview is solid, 2.5px, and deferred until slider motion settles',()=>{
  const helper=source.slice(source.indexOf('const outlineComparisonMarkup'),source.indexOf('const svgViewBox'));
  assert.match(helper,/stroke-width", "2\.5"/);
  assert.doesNotMatch(helper,/stroke-dasharray",/);
  const effectStart=source.indexOf('const request = ++outlinePreviewRequest.current');
  const effectEnd=source.indexOf('}, [one?.id, one?.src',effectStart);
  const effect=source.slice(effectStart,effectEnd);
  assert.match(effect,/\}, 450\);/);
  assert.doesNotMatch(effect,/oldMarkup/);
});

test('normal Cut Shape preview uses the same 2.5px black border',()=>{
  const helper=source.slice(source.indexOf('const scalableSvgPreview'),source.indexOf('const decodeSvgData'));
  assert.match(helper,/stroke", "#141715"/);
  assert.match(helper,/stroke-width", "2\.5"/);
  assert.match(helper,/vector-effect", "non-scaling-stroke"/);
});
