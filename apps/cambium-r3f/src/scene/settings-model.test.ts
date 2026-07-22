import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSettings,
  normalizeTenant,
  saveSettings,
  settingsToRows,
  type AppSettings,
  type StorageLike,
} from './settings-model.ts';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
  };
}

test('round-trip persists and reloads settings', () => {
  const storage = fakeStorage();
  const settings: AppSettings = { reducedMotion: 'on', defaultCamera: 'flat', tenant: 'acme', workerBaseUrl: 'https://quests.example.com' };
  saveSettings(settings, storage);
  assert.ok(storage.data[SETTINGS_STORAGE_KEY]);
  assert.deepEqual(loadSettings(storage), settings);
});

test('corrupt JSON falls back to defaults', () => {
  const storage = fakeStorage({ [SETTINGS_STORAGE_KEY]: '{not json' });
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
});

test('invalid enum values fall back per-field', () => {
  const storage = fakeStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({ reducedMotion: 'banana', defaultCamera: 'orbit', tenant: '  ACME ', workerBaseUrl: 42 }),
  });
  const loaded = loadSettings(storage);
  assert.equal(loaded.reducedMotion, 'system');
  assert.equal(loaded.defaultCamera, 'overview');
  assert.equal(loaded.tenant, 'acme');
  assert.equal(loaded.workerBaseUrl, '');
});

test('tenant normalizes trim and case; empty falls back', () => {
  assert.equal(normalizeTenant('  Demo-Org '), 'demo-org');
  const storage = fakeStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ tenant: '   ' }) });
  assert.equal(loadSettings(storage).tenant, 'demo-org');
});

test('rows have non-empty label and value', () => {
  const rows = settingsToRows(DEFAULT_SETTINGS);
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.ok(row.label.length > 0);
    assert.ok(row.value.length > 0);
  }
});

test('missing storage is a no-op, never throws', () => {
  assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
  saveSettings({ ...DEFAULT_SETTINGS, tenant: 'x' });
});
