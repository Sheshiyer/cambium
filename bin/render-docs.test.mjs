import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gatherOrgan, renderOrganPage, renderCatalog } from './render-docs.mjs';

// a fake reader so gather is tested without touching real repos
const fakeReader = {
  list: (root, src) => (src.dir === 'brandmint/core' ? ['wave_planner', 'design_memory', 'compositor'] : []),
  readJson: () => ({ counts: { clusters: 40, total_indexed: 720 } }),
  readText: () => 'model: nv-embedqa-e5-v5\ndimension: 1024\n',
};

const genesisMeta = {
  id: 'genesis', emoji: '🧬', name: 'genesis — mint the brand', tagline: 'idea → brand system',
  repo: 'Sheshiyer/brandmint-oracle-aleph', role: 'genesis / brand brain',
  contract: { in: 'idea', out: 'brand-dna' }, spend: { class: 'gate', label: '💲 gated' },
  conductor: { name: 'wave_planner.py', desc: 'sequences waves 1-8' },
  homeostasis: 'establishes x*', entrypoint: 'brandmint launch --waves 1-8',
  sources: [{ root: 'brandmint', dir: 'brandmint/core', ext: '.py', kind: 'core module', exclude: ['__init__'] }],
  descriptions: { wave_planner: 'sequences the waves', design_memory: 'writes x*' },
};

test('gatherOrgan reads the real component list from source via the injected reader', () => {
  const data = gatherOrgan(genesisMeta, fakeReader);
  const names = data.components.map((c) => c.name);
  assert.ok(names.includes('wave_planner') && names.includes('design_memory') && names.includes('compositor'));
});

test('gatherOrgan attaches meta descriptions; unknown components are name-only', () => {
  const data = gatherOrgan(genesisMeta, fakeReader);
  assert.equal(data.components.find((c) => c.name === 'wave_planner').desc, 'sequences the waves');
  assert.equal(data.components.find((c) => c.name === 'compositor').desc, '');
});

test('gatherOrgan reads counts from a source json file', () => {
  const meta = { ...genesisMeta, counts: [{ root: 'sc', path: 'skill-index.json', json: true, map: { clusters: 'counts.clusters', skills: 'counts.total_indexed' } }] };
  const data = gatherOrgan(meta, fakeReader);
  assert.equal(data.counts.clusters, 40);
  assert.equal(data.counts.skills, 720);
});

test('gatherOrgan greps counts from a non-json source file', () => {
  const meta = { ...genesisMeta, counts: [{ root: 'sg', path: 'config.yaml', grep: { model: 'model:\\s*(\\S+)', dim: 'dimension:\\s*(\\d+)' } }] };
  const data = gatherOrgan(meta, fakeReader);
  assert.equal(data.counts.model, 'nv-embedqa-e5-v5');
  assert.equal(data.counts.dim, '1024');
});

test('renderOrganPage produces well-formed HTML with the hero, components, and a generated banner', () => {
  const html = renderOrganPage(gatherOrgan(genesisMeta, fakeReader));
  assert.ok(html.startsWith('<!DOCTYPE'));
  assert.ok(html.trimEnd().endsWith('</html>'));
  assert.ok(html.includes('organ.css'));
  assert.match(html, /generated/i); // the do-not-edit banner
  assert.ok(html.includes('wave_planner')); // a real component
  assert.ok(html.includes('idea') && html.includes('brand-dna')); // the contract
});

test('renderCatalog links every organ page', () => {
  const data = gatherOrgan(genesisMeta, fakeReader);
  const html = renderCatalog([data]);
  assert.ok(html.includes('organs/genesis.html'));
});

test('renderOrganPage escapes double-quotes (defends odd future filenames + quoted entrypoints)', () => {
  const meta = { ...genesisMeta, sources: [], componentsLiteral: [{ name: 'a"b', kind: 'k', desc: '' }] };
  const html = renderOrganPage(gatherOrgan(meta, fakeReader));
  assert.ok(html.includes('a&quot;b'));
  assert.ok(!/a"b/.test(html));
});
