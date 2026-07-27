import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const COMPLETE_SAFE_PROVIDER_POLICY = `
## Provider / Data Policy

| Field | Value |
| --- | --- |
| subgraph_version | \`lead-ops@1.0.0\` |
| stage_capabilities | \`discover:company-observation@1.0.0, enrich:identity-resolution@1.0.0\` |
| provider_binding | \`none\` |
| adapter_version | \`none\` |
| mutation_enabled | \`false\` |
| data_classification | \`synthetic\` |
| processing_region | \`none\` |
| purpose | Offline contract proof only. |
| retention | \`none\` |
| suppression_policy | No contact or mutation; suppression always dominates. |
`;

function runValidator(packetDir) {
  return spawnSync(process.execPath, [VALIDATOR, '--packet-dir', packetDir], {
    encoding: 'utf8'
  });
}

function runValidatorWithTempPackets(mutator) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'cambium-branch-loop-'));
  const tempPacketDir = join(tempRoot, 'product-branches');
  try {
    cpSync(PACKET_DIR, tempPacketDir, { recursive: true });
    const packetFile = join(tempPacketDir, 'fitcheck.md');
    if (mutator) {
      mutator(packetFile, tempPacketDir, join(tempPacketDir, 'index.md'));
    }
    return runValidator(tempPacketDir);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function insertProviderPolicy(packetFile, policy = COMPLETE_SAFE_PROVIDER_POLICY) {
  replaceFitcheck(packetFile, '\n## Promotion Rule\n', `${policy}\n## Promotion Rule\n`);
}

function replaceFitcheck(packetFile, from, to) {
  const original = readFileSync(packetFile, 'utf8');
  const next = original.replace(from, to);
  assert.notStrictEqual(next, original, `expected to replace ${from}`);
  writeFileSync(packetFile, next);
}

test('current branch packets validate cleanly', () => {
  const result = runValidator(PACKET_DIR);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validated 5 branch packet\(s\)/);
});

test('optional provider policy accepts zero-authority omissions and complete safe references', () => {
  const complete = runValidatorWithTempPackets((packetFile) => {
    insertProviderPolicy(packetFile);
  });
  assert.equal(complete.status, 0, complete.stderr);

  const omittedAuthority = runValidatorWithTempPackets((packetFile) => {
    insertProviderPolicy(packetFile, `
## Provider / Data Policy

| Field | Value |
| --- | --- |
| subgraph_version | \`lead-ops@1.0.0\` |
| data_classification | \`synthetic\` |
| purpose | Offline contract proof only. |
`);
  });
  assert.equal(omittedAuthority.status, 0, omittedAuthority.stderr);
});

test('provider policy rejects unknown catalog versions and unversioned active bindings', () => {
  const cases = [
    {
      name: 'unknown subgraph version',
      from: '`lead-ops@1.0.0`',
      to: '`lead-ops@latest`',
      message: /unknown subgraph_version "lead-ops@latest"/
    },
    {
      name: 'unknown capability version',
      from: '`discover:company-observation@1.0.0, enrich:identity-resolution@1.0.0`',
      to: '`discover:company-observation@latest`',
      message: /invalid stage_capabilities reference.*latest/
    },
    {
      name: 'unversioned provider binding',
      from: '`none` |\n| adapter_version | `none`',
      to: '`explee-observation` |\n| adapter_version | `1.0.0`',
      message: /provider_binding must be none or a versioned catalog reference/
    },
    {
      name: 'missing adapter version for binding',
      from: '`none` |\n| adapter_version | `none`',
      to: '`explee-observation@1.0.0` |\n| adapter_version | `none`',
      message: /active provider_binding requires a semantic adapter_version/
    }
  ];

  for (const testCase of cases) {
    const result = runValidatorWithTempPackets((packetFile) => {
      insertProviderPolicy(packetFile);
      replaceFitcheck(packetFile, testCase.from, testCase.to);
    });
    assert.notEqual(result.status, 0, testCase.name);
    assert.match(result.stderr, testCase.message, testCase.name);
  }
});

test('proof-only packets reject provider mutation even with otherwise valid policy', () => {
  const result = runValidatorWithTempPackets((_packetFile, packetDir) => {
    const packetFile = join(packetDir, 'iverif.md');
    const activeMutationPolicy = COMPLETE_SAFE_PROVIDER_POLICY
      .replace('| provider_binding | `none` |', '| provider_binding | `synthetic-observation@1.0.0` |')
      .replace('| adapter_version | `none` |', '| adapter_version | `1.0.0` |')
      .replace('| mutation_enabled | `false` |', '| mutation_enabled | `true` |');
    insertProviderPolicy(packetFile, activeMutationPolicy);
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /proof-only packet cannot enable provider mutation/);
});

test('provider policy rejects caller-owned routing and credential overrides', () => {
  for (const field of ['tenant_id', 'account_id', 'project_id', 'campaign_id', 'credential_ref']) {
    const result = runValidatorWithTempPackets((packetFile) => {
      insertProviderPolicy(packetFile, COMPLETE_SAFE_PROVIDER_POLICY.replace(
        '| provider_binding |',
        `| ${field} | caller-controlled |\n| provider_binding |`
      ));
    });

    assert.notEqual(result.status, 0, field);
    assert.match(result.stderr, new RegExp(`caller-owned override field "${field}"`), field);
  }
});

test('index rejects duplicate product IDs and duplicate packet paths before packet loading', () => {
  const duplicateId = runValidatorWithTempPackets((_packetFile, _packetDir, indexFile) => {
    const source = readFileSync(indexFile, 'utf8');
    writeFileSync(indexFile, `${source.trimEnd()}\n| fitcheck | product | Duplicate ID | Proof | proof-only | Duplicate check | vantyx.md |\n`);
  });
  assert.notEqual(duplicateId.status, 0);
  assert.match(duplicateId.stderr, /duplicate product_id "fitcheck"/);

  const duplicatePath = runValidatorWithTempPackets((_packetFile, _packetDir, indexFile) => {
    const source = readFileSync(indexFile, 'utf8');
    writeFileSync(indexFile, `${source.trimEnd()}\n| fitcheck-copy | product | Duplicate Path | Proof | proof-only | Duplicate check | fitcheck.md |\n`);
  });
  assert.notEqual(duplicatePath.status, 0);
  assert.match(duplicatePath.stderr, /duplicate packet path "fitcheck\.md"/);
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
    const result = runValidatorWithTempPackets((packetFile) => testCase.mutate(packetFile));
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
      label: 'recording guardrail bad path',
      rule: 'Select exactly one remediation and record the finding in docs/review.md.',
      message: /must not suggest batching/
    },
    {
      label: 'documenting guardrail bad path',
      rule: 'Select exactly one remediation and document the finding in docs/review.md.',
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
    const result = runValidatorWithTempPackets((packetFile) => {
      replaceFitcheck(packetFile, BASE_ROW_RULE, failCase.rule);
    });
    assert.notEqual(result.status, 0, failCase.label);
    assert.match(result.stderr, failCase.message, failCase.label);
  }

  const passResult = runValidatorWithTempPackets((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one decision request.');
  });
  assert.equal(passResult.status, 0, passResult.stderr);

  const enumerationPassResult = runValidatorWithTempPackets((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one of gate A, gate B or gate C.');
  });
  assert.equal(enumerationPassResult.status, 0, enumerationPassResult.stderr);

  const documentPassResult = runValidatorWithTempPackets((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one remediation and document the finding in .operator/branch-loops/demo.md.');
  });
  assert.equal(documentPassResult.status, 0, documentPassResult.stderr);

  const recordPassResult = runValidatorWithTempPackets((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one remediation and record the finding in .operator/branch-loops/demo.md.');
  });
  assert.equal(recordPassResult.status, 0, recordPassResult.stderr);

  const pricingPassResult = runValidatorWithTempPackets((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one pricing and packaging remediation.');
  });
  assert.equal(pricingPassResult.status, 0, pricingPassResult.stderr);

  const rdPassResult = runValidatorWithTempPackets((packetFile) => {
    replaceFitcheck(packetFile, BASE_ROW_RULE, 'Select exactly one R&D fix.');
  });
  assert.equal(rdPassResult.status, 0, rdPassResult.stderr);
});
