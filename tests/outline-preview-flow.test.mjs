import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/editor/page.tsx',import.meta.url),'utf8');

test('outline preview is solid blue, 3.5px, and deferred until slider motion settles',()=>{
  const helper=source.slice(source.indexOf('const outlineComparisonMarkup'),source.indexOf('const cutShapeBorderMarkup'));
  assert.match(helper,/stroke-width", "3\.5"/);
  assert.doesNotMatch(helper,/stroke-dasharray",/);
  const effectStart=source.indexOf('const request = ++outlinePreviewRequest.current');
  const effectEnd=source.indexOf('}, [one?.id, one?.src',effectStart);
  const effect=source.slice(effectStart,effectEnd);
  assert.match(effect,/\}, 450\);/);
  assert.match(effect,/"#1687d9"/);
  assert.match(effect,/, 420\)/);
  assert.doesNotMatch(effect,/oldMarkup/);
});

test('every normal Cut Shape receives an unclipped 2px black vector overlay',()=>{
  const helper=source.slice(source.indexOf('const cutShapeBorderMarkup'),source.indexOf('const flipSvgSource'));
  assert.match(helper,/stroke", "#111715"/);
  assert.match(helper,/stroke-width", "2"/);
  assert.match(helper,/vector-effect", "non-scaling-stroke"/);
  assert.match(source,/className="cut-shape-border"/);
});

test('outline edit mode exposes cancel, loading feedback and direct apply',()=>{
  assert.match(source,/className="outline-loading"/);
  assert.match(source,/outlineEditing\?"Cancel":"Remove"/);
  assert.match(source,/className="outline-apply-badge"/);
  assert.match(source,/saveOrOpenDialog/);
  assert.match(source,/beginOutlineForPrintable/);
  assert.match(source,/disabled-property/);
});
