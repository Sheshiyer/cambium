import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

function rule(selector: string): string {
  const found = css.match(new RegExp(`${selector.replace(/[.]/g, '\\.')} \\{[^}]+\\}`));
  assert.ok(found, selector);
  return found[0];
}

test('location readout uses the canonical signal, mist, and sans stacks', () => {
  const location = rule('.cw .cw-location');
  const index = rule('.cw .cw-location-index');
  const district = rule('.cw .cw-district');
  const tagline = rule('.cw .cw-tagline');
  const sans = '"Arial Narrow", "Aptos Display", "Satoshi", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  assert.match(location, /border-left:1px solid var\(--cw-acid\)/);
  assert.doesNotMatch(location, /text-shadow|cw-copper/);
  assert.match(index, /ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace/);
  assert.match(index, /color:var\(--cw-acid\)/);
  assert.doesNotMatch(index, /cw-peach/);
  assert.match(district, new RegExp(sans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(district, /color:var\(--cw-mint\)/);
  assert.match(tagline, /color:var\(--cw-mint\)/);
  assert.doesNotMatch(tagline, /#d3e9e0/);
});
