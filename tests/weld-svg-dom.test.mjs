import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Alias keeps Paper's optional Node jsdom adapter out of geometry-only tests.
import { JSDOM } from 'weld-test-dom';
import ts from 'typescript';
import { remapSvgReference } from '../app/editor/svg-references.ts';

const code = readFileSync(new URL('../app/editor/page.tsx', import.meta.url), 'utf8');
const start = code.indexOf('      const area=bounds(picked),top=', code.indexOf('const weldSelection'));
const end = code.indexOf('      const src=`data:image/svg+xml', start);
assert.ok(start >= 0 && end > start);
const buildCode = ts.transpile(`function build(){${code.slice(start, end)}return new XMLSerializer().serializeToString(root);}`, { target: ts.ScriptTarget.ES2022 });
const compose = new Function('picked', 'layers', 'bounds', 'DOMParser', 'document', 'uid', 'svgViewBox', 'decodeSvgData', 'remapSvgReference', 'XMLSerializer', `${buildCode}return build();`);

for (const indices of [[1, 2], [0, 1, 2, 3]]) {
  test(`actual weld serializes ${indices.length} vector pieces as valid XML without rewriting curves`, () => {
    const dom = new JSDOM('');
    const { window } = dom;
    try {
      const locations = [[0, 0], [2.9, 6.85], [2.9, 5.5], [2.9, .95]];
      const fixtures = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="10cm" height="11cm" viewBox="-3 -3 1006 1106" fill="#333"><path d="M0 0H1000V1100H0Z M80 80V1020H920V80Z" fill-rule="evenodd"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="4.6cm" height="2.8cm" viewBox="0 0 460 280"><path d="M0 20H460V280H0Z M20 40V260H440V40Z" fill-rule="evenodd"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="3.3cm" height="2.7cm" viewBox="0 0 330 270"><path d="M0 150 C0 0 330 0 330 150 L330 270 H0 Z" fill-rule="evenodd"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="4cm" height="1.2cm" viewBox="0 0 400 120"><path d="M60 0H340A60 60 0 0 1 340 120H60A60 60 0 0 1 60 0Z M60 30A30 30 0 0 0 60 90H340A30 30 0 0 0 340 30Z" fill-rule="evenodd"/></svg>'
      ];
      const layers = locations.map(([x, y], index) => {
        const src = fixtures[index];
        const root = new window.DOMParser().parseFromString(src, 'image/svg+xml').documentElement;
        return { id: String(index), src, x, y, w: parseFloat(root.getAttribute('width')), h: parseFloat(root.getAttribute('height')), rotation: 0, color: '#b91d1d' };
      });
      const bounds = parts => {
        const x = Math.min(...parts.map(p => p.x)), y = Math.min(...parts.map(p => p.y));
        return { x, y, w: Math.max(...parts.map(p => p.x + p.w)) - x, h: Math.max(...parts.map(p => p.y + p.h)) - y };
      };
      const picked = indices.map(index => layers[index]);
      let nextId = 0;
      const raw = compose(picked, layers, bounds, window.DOMParser, window.document, () => String(nextId++), root => root.getAttribute('viewBox').split(/[ ,]+/).map(Number), src => src, remapSvgReference, window.XMLSerializer);
      const result = new window.DOMParser().parseFromString(raw, 'image/svg+xml');
      assert.equal(result.querySelectorAll('parsererror').length, 0, raw.slice(0, 200));
      assert.equal((raw.match(/xmlns="http:\/\/www.w3.org\/2000\/svg"/g) || []).length, 1);
      const paths = [...result.querySelectorAll('path')];
      assert.equal(paths.length, picked.length);
      paths.forEach((path, index) => {
        const original = new window.DOMParser().parseFromString(picked[index].src, 'image/svg+xml').querySelector('path');
        assert.equal(path.getAttribute('d'), original.getAttribute('d'));
        assert.equal(path.getAttribute('fill-rule'), original.getAttribute('fill-rule'));
      });
    } finally {
      window.close();
    }
  });
}
