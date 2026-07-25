import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditBannedPatterns,
  auditElementCaps,
  auditTextDensity,
  collapseClosedDetails,
  countWords,
  extractElementsByClass,
  leafButtonLabels,
  stripNonRenderedTextNodes,
  visibleTextFromHtml,
} from './text-density-audit.mjs';

test('text-density audit · visible-text walk skips hidden, aria-hidden, sr, and svg subtrees', () => {
  const html = '<div>shown <span class="sr">screen-reader only</span> text'
    + '<span aria-hidden="true">glyph</span><svg><text>dial</text></svg>'
    + '<span style="display:none">hidden</span><em>tail</em></div>';
  assert.equal(visibleTextFromHtml(html), 'shown text tail');
});

test('text-density audit · collapsed details bodies stay out of the at-rest count', () => {
  const closed = '<details class="mc-info"><summary>why this branch</summary><p>a long narrative body that must not count at rest</p></details>';
  assert.equal(visibleTextFromHtml(closed), 'why this branch');
  const open = '<details class="mc-info" open><summary>why this branch</summary><p>body counts when open</p></details>';
  assert.equal(visibleTextFromHtml(open), 'why this branch body counts when open');
  // nested card markup inside a closed details body is fully dropped
  const nested = '<details><summary>sum</summary><div><details><summary>inner</summary><p>deep</p></details></div></details>';
  assert.equal(visibleTextFromHtml(nested), 'sum');
});

test('text-density audit · word counting treats mono tokens and numbers as single words', () => {
  assert.equal(countWords('<span>Fitcheck 9/17</span>'), 2);
  assert.equal(countWords('<b>fresh 2m</b><span>sha256:9d2c4f6a8b0e</span>'), 3);
  assert.equal(countWords('   '), 0);
});

test('text-density audit · element caps flag over-budget strings via component hooks', () => {
  const failures = auditElementCaps(
    '<div class="mc-eyebrow">three word eyebrow</div>'
    + '<div class="cmdgrp">fine</div>'
    + '<span class="mc-state-token" aria-label="state: needs gate review now">x</span>'
    + '<div class="mc-proof-row"><span><b>this proof row label is long</b></span></div>'
    + '<button type="button">Review Gate</button>'
    + '<button type="button">this button label is too long</button>',
    'unit',
  );
  assert.ok(failures.some((f) => /eyebrow.*3 words \(cap 2\)/.test(f)), failures.join('\n'));
  assert.ok(failures.some((f) => /state-token subtitle.*4 words \(cap 3\)/.test(f)), failures.join('\n'));
  assert.ok(failures.some((f) => /ProofList row label.*6 words \(cap 4\)/.test(f)), failures.join('\n'));
  assert.ok(failures.some((f) => /button label "this button label is too long"/.test(f)), failures.join('\n'));
  assert.ok(!failures.some((f) => /Review Gate/.test(f)), 'compliant button stays silent');
});

test('text-density audit · element caps exclude action buttons from empty/error states', () => {
  const ok = auditElementCaps(
    '<div class="gate-empty"><b>no founder decisions waiting.</b><span>decisions appear here when Cambium serves open work</span>'
    + '<button>Mission</button><button>Inspect</button></div>',
    'unit',
  );
  assert.deepEqual(ok, []);
  const over = auditElementCaps('<div class="mission-empty"><b>one two three four five six seven</b><p>eight nine ten eleven twelve thirteen</p><button>Refresh</button></div>', 'unit');
  assert.equal(over.length, 1);
  assert.match(over[0], /13 words \(cap 12\)/);
});

test('text-density audit · banned list catches AI copy, initData ritual, kv walls, nar blocks, redaction leaks', () => {
  const failures = auditBannedPatterns(
    '<div class="kv"><b>k</b><span>v</span></div><p class="nar">a powerful seamless narrative</p>'
    + '<span>paste TELEGRAM_INIT_DATA here</span><span>?query_id=AAE-test&amp;hash=abc</span>',
    'unit',
  );
  assert.ok(failures.some((f) => /banned AI-copy term "powerful"/.test(f)));
  assert.ok(failures.some((f) => /banned AI-copy term "seamless"/.test(f)));
  assert.ok(failures.some((f) => /initData ritual copy/.test(f)));
  assert.ok(failures.some((f) => /redaction violation/.test(f)));
  assert.ok(failures.some((f) => /kv grid outside Inspect/.test(f)));
  assert.ok(failures.some((f) => /paragraph narrative/.test(f)));
  const inspectScoped = auditBannedPatterns('<div class="kv"><b>k</b><span>v</span></div><p class="nar">kept in inspect</p>', 'unit', { inspectSurface: true });
  assert.deepEqual(inspectScoped, []);
});

test('text-density audit · exclamation marks in state labels fail (frozen/05 §4.6)', () => {
  const failures = auditElementCaps('<span class="mc-state-token" aria-label="state: blocked!">x</span>', 'unit');
  assert.ok(failures.some((f) => /exclamation mark/.test(f)));
});

test('text-density audit · helpers classify leaf buttons and hooked elements', () => {
  assert.deepEqual(leafButtonLabels('<button>Approve</button><button><b>card</b><small>body</small></button><button>›</button>'), ['Approve']);
  assert.deepEqual(extractElementsByClass('<div class="cmdgrp">STATE STACK</div>', 'cmdgrp'), ['STATE STACK']);
});

test('text-density audit · every scene fixture state stays within its contract word cap (frozen/05)', async () => {
  const report = await auditTextDensity(new URL('..', import.meta.url));
  assert.equal(report.ok, true, report.failures.join('\n'));
  assert.deepEqual(report.failures, []);
  for (const scene of report.scenes) {
    for (const [state, info] of Object.entries(scene.states)) {
      assert.ok(info.words <= info.cap, `${scene.scene}/${state} renders ${info.words} words (cap ${info.cap})`);
    }
  }
  assert.ok(report.chrome.words <= report.chrome.cap, `chrome renders ${report.chrome.words} words (cap ${report.chrome.cap})`);
});

test('text-density audit · ratified-verbatim overrides stay explicit and bounded', async () => {
  const report = await auditTextDensity(new URL('..', import.meta.url));
  // The only waived element failure anywhere in the app is the frozen/06 M12 mission empty
  // state; any NEW over-cap element must fail the gate, not silently join the waiver list.
  assert.ok(report.overrides.length <= 1, report.overrides.map((o) => o.failure).join('\n'));
});
