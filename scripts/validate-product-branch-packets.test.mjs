import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const VALIDATOR = join(REPO_ROOT, 'scripts/validate-product-branch-packets.mjs');
const PACKET_DIR = join(REPO_ROOT, 'docs/plans/product-branches');
const BASE_ROW_RULE = 'Select exactly one of Shopify QA, Dodo reservation env, privacy copy, outreach approval, or first merchant proof.';

function runValidator(packetDir) {
  return spawnSync(process.execPath, [VALIDATOR, '--packet-dir', packetDir], {
    encoding: 'utf8'
  });
}

function withTempDocs(mutator) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'cambium-branch-loop-'));
  const tempDocs = join(tempRoot, 'docs');
  cpSync(join(REPO_ROOT, 'docs'), tempDocs, { recursive: true });
  const packetFile = join(tempDocs, 'plans/product-branches/fitcheck.md');
  if (mutator) {
    mutator(packetFile);
  }
  return join(tempDocs, 'plans/product-branches');
}

function replaceFitcheck(packetFile, from, to) {
  const original = readFileSync(packetFile, 'utf8');
  const next = original.replace(from, to);
  assert.notStrictEqual(next, original, `expected to replace ${from}`);
  writeFileSync(packetFile, next);
}

test('current product packets validate cleanly', () => {
  const result = runValidator(PACKET_DIR);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validated 4 product branch packet\(s\)/);
});

test('boundary colors, required loop cells, and state files fail closed', () => {
  const cases = [
    {
      name: 'uppercase boundary',
      mutate(file) {
        replaceFitcheck(file, '| yellow | Select exactly one of Shopify QA, Dodo reservation env, privacy copy, outreach approval, or first merchant proof. |', '| Green | Select exactly one of Shopify QA, Dodo reservation env, privacy copy, outreach approval, or first merchant proof. |');
      },
      message: /invalid boundary_color "Green"/
    },
    {
      name: 'blank proof_required',
      mutate(file) {
        replaceFitcheck(file, '| Updated Evidence Ledger row, Gate Ledger row, or founder approval request pasted into the loop state file. |', '|  |');
      },
      message: /missing required loop field\(s\): proof_required/
    },
    {
      name: 'unsafe state_file',
      mutate(file) {
        replaceFitcheck(file, '.operator/branch-loops/fitcheck-launch-gate-loop.md', '../fitcheck-loop.md');
      },
      message: /unsafe state_file "\.\.\/fitcheck-loop\.md"/
    }
  ];

  for (const testCase of cases) {
    const packetDir = withTempDocs((packetFile) => testCase.mutate(packetFile));
    const result = runValidator(packetDir);
    assert.notEqual(result.status, 0, testCase.name);
    assert.match(result.stderr, testCase.message, testCase.name);
  }
});

test('one_change_rule structural guard rejects follow-on action punctuation and keeps a standalone decision request valid', () => {
  const failCases = [
    {
      label: 'file',
      rule: 'Select exactly one gate and file a founder approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'comma file',
      rule: 'Select exactly one gate, file a founder approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'comma approval',
      rule: 'Select exactly one gate, one approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'comma submit',
      rule: 'Select exactly one gate, submit a founder approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'period-separated follow-on',
      rule: 'Select exactly one gate. File a founder approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'then escalate',
      rule: 'Select exactly one gate, then escalate another blocker.',
      message: /must not suggest batching/
    },
    {
      label: 'punctuated request',
      rule: 'Select exactly one remediation; request one decision.',
      message: /must not suggest batching/
    },
    {
      label: 'guardrail with follow-on',
      rule: 'Select exactly one claim and write only the finding to .operator/branch-loops/demo.md; request one decision.',
      message: /must not suggest batching/
    },
    {
      label: 'decision request batching',
      rule: 'Select exactly one remediation, then request one decision.',
      message: /must not suggest batching/
    },
    {
      label: 'enumeration file',
      rule: 'Select exactly one of gate A or gate B and file a founder approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'enumeration then request',
      rule: 'Select exactly one of gate A, gate B, or gate C then request one decision.',
      message: /must not suggest batching/
    },
    {
      label: 'spaced ampersand',
      rule: 'Select exactly one gate & file a founder approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'spaced slash',
      rule: 'Select exactly one gate / request one decision.',
      message: /must not suggest batching/
    },
    {
      label: 'unspaced slash',
      rule: 'Select exactly one gate/request one decision.',
      message: /must not suggest batching/
    },
    {
      label: 'unspaced plus',
      rule: 'Select exactly one gate+file approval request.',
      message: /must not suggest batching/
    },
    {
      label: 'unspaced ampersand',
      rule: 'Select exactly one gate&request approval.',
      message: /must not suggest batching/
    }
  ];

  for (const failCase of failCases) {
    const packetDir = withTempDocs((packetFile) => {
      replaceFitcheck(packetFile, BASE_ROW_RULE, failCase.rule);
    });
    const result = runValidator(packetDir);
    assert.notEqual(result.status, 0, failCase.label);
    assert.match(result.stderr, failCase.message, failCase.label);
  }

  const passPacketDir = withTempDocs((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one decision request.');
  });
  const passResult = runValidator(passPacketDir);
  assert.equal(passResult.status, 0, passResult.stderr);

  const enumerationPassPacketDir = withTempDocs((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one of gate A, gate B or gate C.');
  });
  const enumerationPassResult = runValidator(enumerationPassPacketDir);
  assert.equal(enumerationPassResult.status, 0, enumerationPassResult.stderr);

  const documentPassPacketDir = withTempDocs((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one remediation and document the finding in .operator/branch-loops/demo.md.');
  });
  const documentPassResult = runValidator(documentPassPacketDir);
  assert.equal(documentPassResult.status, 0, documentPassResult.stderr);

  const recordPassPacketDir = withTempDocs((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one remediation and record the finding in .operator/branch-loops/demo.md.');
  });
  const recordPassResult = runValidator(recordPassPacketDir);
  assert.equal(recordPassResult.status, 0, recordPassResult.stderr);
});
