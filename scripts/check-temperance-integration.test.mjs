import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateTemperanceIntegration } from './check-temperance-integration.mjs';

const fixture = JSON.parse(readFileSync(new URL('../docs/architecture/contracts/temperance-integration.v1.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(fixture);
const reject = value => assert.throws(() => validateTemperanceIntegration(value), { message: 'Invalid Temperance integration contract' });

test('committed contract normalizes company-owned metadata without effects', () => {
  const result = validateTemperanceIntegration(fixture);
  assert.deepEqual(result, fixture);
  assert.equal(result.effects_authorized, false);
  assert.equal(Object.hasOwn(result, 'admitted'), false);
  result.company.repository = 'mutated';
  assert.deepEqual(validateTemperanceIntegration(fixture), fixture);
});

test('ordering of finite declaration sets does not alter normalization', () => {
  const value = fresh();
  value.seams.reverse();
  value.seams.forEach(seam => seam.requirements.reverse());
  value.excluded_plants.reverse();
  assert.deepEqual(validateTemperanceIntegration(value), fixture);
});

for (const [label, mutate] of [
  ['unknown root field', x => { x.extra = 'value'; }],
  ['private field', x => { x.company.secret = 'private-placeholder'; }],
  ['raw path', x => { x.integration.configuration_reference = '/' + 'tmp/private'; }],
  ['wrong product', x => { x.product.repository = x.company.repository; }],
  ['company dependency', x => { x.product.company_dependency_required = true; }],
  ['product required', x => { x.product.required_by_company = true; }],
  ['integration required', x => { x.integration.required = true; }],
  ['wrong integration', x => { x.integration.repository = x.product.repository; }],
  ['wrong company', x => { x.company.repository = x.integration.repository; }],
  ['authority reassigned', x => { x.company.operational_writer = 'temperance'; }],
  ['wrong plant', x => { x.integration.plant_id = 'heyzack-hosted'; }],
  ['unknown seam', x => { x.seams[0].id = 'unknown'; }],
  ['duplicate seam', x => { x.seams[1] = x.seams[0]; }],
  ['missing seam', x => { x.seams.pop(); }],
  ['missing lineage', x => { x.seams[1].requirements.pop(); }],
  ['duplicate requirement', x => { x.seams[0].requirements[1] = x.seams[0].requirements[0]; }],
  ['unknown requirement', x => { x.seams[0].requirements.push('execute'); }],
  ['execution effect', x => { x.seams[0].effect = 'execute'; }],
  ['effects enabled', x => { x.effects_authorized = true; }],
  ['exclusion drift', x => { x.excluded_plants.pop(); }],
  ['exclusion duplicate', x => { x.excluded_plants[1] = x.excluded_plants[0]; }],
  ['malformed boolean', x => { x.effects_authorized = 'false'; }],
  ['oversized input', x => { x.integration.configuration_reference = 'x'.repeat(20000); }],
]) test(`rejects ${label}`, () => { const value = fresh(); mutate(value); reject(value); });

test('all individual company authorities remain exact', () => {
  for (const key of Object.keys(fixture.company)) {
    const value = fresh(); value.company[key] = 'other'; reject(value);
  }
});

test('rejects unsafe structures without invoking accessors', () => {
  for (const value of [null, undefined, true, 1, '', [], new Date(), Object.create(null)]) reject(value);
  reject(new Proxy(fresh(), { ownKeys() { assert.fail('proxy trap invoked'); } }));
  const value = fresh();
  Object.defineProperty(value, 'schema', { get() { assert.fail('getter invoked'); }, enumerable: true });
  reject(value);
  const symbolic = fresh(); symbolic[Symbol('private')] = 'value'; reject(symbolic);
  const cyclic = fresh(); cyclic.company = cyclic; reject(cyclic);
  const hidden = fresh(); Object.defineProperty(hidden, 'hidden', { value: false }); reject(hidden);
  const sparse = fresh(); delete sparse.seams[1]; reject(sparse);
  const extra = fresh(); extra.seams.extra = false; reject(extra);
  const polluted = fresh(); Object.setPrototypeOf(polluted.company, { injected: true }); reject(polluted);
});

test('CLI reads fixed contract and emits a configuration-only digest', () => {
  const script = fileURLToPath(new URL('./check-temperance-integration.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(child.status, 0); assert.equal(child.stderr, '');
  const result = JSON.parse(child.stdout);
  assert.equal(result.status, 'configuration-only');
  assert.match(result.digest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.metadata, fixture);
  assert.equal(result.effects_authorized, false);
  const failure = spawnSync(process.execPath, [script, '--path', 'private-placeholder'], { encoding: 'utf8' });
  assert.equal(failure.status, 2); assert.equal(failure.stdout, '');
  assert.deepEqual(JSON.parse(failure.stderr), { status: 'invalid', error: 'Invalid Temperance integration contract' });
  assert.equal(failure.stderr.includes('private-placeholder'), false);
});

test('each seam direction, effect, and required lineage field remains exact', () => {
  for (let index = 0; index < fixture.seams.length; index++) {
    for (const key of ['from', 'to', 'effect']) {
      const value = fresh(); value.seams[index][key] = 'other'; reject(value);
    }
    for (let requirement = 0; requirement < fixture.seams[index].requirements.length; requirement++) {
      const value = fresh(); value.seams[index].requirements.splice(requirement, 1); reject(value);
    }
  }
});
