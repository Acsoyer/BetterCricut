import test from 'node:test';
import assert from 'node:assert/strict';
import { savedProjectDisplayName } from '../app/editor/project-display-name.ts';
test('first successful autosave replaces Untitled with the saved name', () => {
  assert.equal(savedProjectDisplayName('Untitled Project','Autosave - 2026-09-16',true),'Autosave - 2026-09-16');
});
test('subsequent autosave timestamps and legacy autosave names stay synchronized', () => {
  assert.equal(savedProjectDisplayName('Autosave-old','Autosave - new',true),'Autosave - new');
  assert.equal(savedProjectDisplayName('Autosave - old','Autosave - new',true),'Autosave - new');
});
test('autosave cannot overwrite a custom name typed during the request', () => {
  assert.equal(savedProjectDisplayName('Birthday','Autosave - date',true),'Birthday');
  assert.equal(savedProjectDisplayName('Untitled Project','Birthday',false),'Birthday');
});
