import { createHash } from 'node:crypto';
import manifest from '../docs/project-management/iverif-claim-proof-source.v1.json' with { type: 'json' };
import acceptancePins from '../docs/project-management/iverif-claim-acceptance-verifier.v1.json' with { type: 'json' };

export function canonicalClaimJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalClaimJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalClaimJson(record[key])}`).join(',')}}`;
}
export const claimDigest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalClaimJson(value)).digest('hex')}`;
export const CLAIM_SOURCE = manifest;
export const CLAIM_POLICY = Object.freeze({
  schema: 'cambium.iverif.claim-proof-policy.v1', command: 'iverif.claim-proof.review',
  workObjectId: 'sapling:iverif', loadoutId: 'loadout:iverif-claim-proof', clusterId: 'cluster:iverif-claim-proof',
  sourceManifestDigest: claimDigest(manifest), modelPool: 'noesis-free', paidFallback: false,
  executor: 'conservative-source-inventory-v2', timeoutMs: 120000, maxSourceBytes: 524288,
  maxClaims: 4096, maxArtifactBytes: 2097152, attempts: 1, automaticRetries: false,
  budget: {modelCalls:0,incrementalSpend:0,currency:'USD'},
  stopConditions: ['source or manifest digest mismatch','expired or revoked admission','changed graph, direction or signal revision','lost execution fence','source or artifact byte limit','timeout','unconfirmed immutable artifact upload'],
  outputs: ['claims.json', 'claims.md', 'provenance.json'], semanticAcceptance: 'founder-and-existing-acceptance-owner',
  productPromotion: false, externalAction: 'none',
});
export const CLAIM_POLICY_DIGEST = claimDigest(CLAIM_POLICY);
export const CLAIM_ACCEPTANCE_SCHEMA = 'cambium.founder.claim-result-acceptance-intent.v1';
export const CLAIM_ARTIFACT_INPUT_PATH = '.local/iverif-acceptance/claim-artifact.json';
export const CLAIM_FOUNDER_INPUT_PATH = '.local/iverif-acceptance/founder-decision.json';
export const CLAIM_ACCEPTANCE_PINS = acceptancePins;
export function claimAcceptancePolicyHash(artifactDigest: string, founderDecisionDigest: string): string {
  return claimDigest({schema:'cambium.iverif.claim-proof-acceptance-policy.v1',claimPolicyDigest:CLAIM_POLICY_DIGEST,artifactDigest,founderDecisionDigest,verifierPins:acceptancePins}).slice(7);
}
export interface ClaimProofInput {
  schema: 'cambium.iverif.claim-proof-input.v1';
  workObjectId: 'sapling:iverif';
  taskId: string; goalId: string; workNodeId: string; graphHeadDigest: string;
  directionId: string; directionRevision: number; directionDigest: string;
  sourceManifestDigest: string; policyDigest: string; modelPool: 'noesis-free';
}
const id = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
export function parseClaimProofInput(value: unknown): ClaimProofInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ['schema','workObjectId','taskId','goalId','workNodeId','graphHeadDigest','directionId','directionRevision','directionDigest','sourceManifestDigest','policyDigest','modelPool'];
  if (Object.keys(v).length !== keys.length || !keys.every(key => Object.hasOwn(v,key))
      || v.schema !== 'cambium.iverif.claim-proof-input.v1' || v.workObjectId !== 'sapling:iverif' || v.modelPool !== 'noesis-free'
      || v.sourceManifestDigest !== CLAIM_POLICY.sourceManifestDigest || v.policyDigest !== CLAIM_POLICY_DIGEST
      || typeof v.graphHeadDigest !== 'string' || !/^[a-f0-9]{64}$/.test(v.graphHeadDigest)
      || !Number.isSafeInteger(v.directionRevision) || Number(v.directionRevision) < 1
      || !['taskId','goalId','workNodeId','directionId'].every(key => typeof v[key] === 'string' && id.test(v[key]))
      || typeof v.directionDigest !== 'string' || !digest.test(v.directionDigest)) return null;
  return v as unknown as ClaimProofInput;
}
export interface ClaimProofRow {
  id: string; claim: string; sourcePath: string; sourceLine: number; sourceRef: string;
  evidenceRefs: string[]; classification: 'verified' | 'blocked' | 'pending' | 'no-signal'; rationale: string;
}
export interface ClaimProofArtifact {
  schema: 'cambium.iverif.claim-proof-artifact.v1'; inputDigest: string; policyDigest: string;
  sourceManifestDigest: string; files: Record<'claims.json' | 'claims.md' | 'provenance.json', string>;
}
/** The reviewed task inventories source assertions; it never verifies a product claim from copy. */
export function inventoryClaimSource(path: string, text: string): ClaimProofRow[] {
  let frontmatter = false, fence = false, codeStyle = false;
  const code = /\.(?:astro|ts)$/.test(path);
  const sensitive = /compli|certif|GDPR|SOC\s?2|ISO\s?27001|encrypt|AES.?256|secur|authenticat|SAML|OAuth|DPA|residen|SLA|uptime|24\/7|\d\s*%|\d\s*ms|processing time|audit/i;
  const candidateText = (value:string) => value.length >= 20 && /\s/.test(value) || sensitive.test(value);
  return text.split(/\r?\n/).flatMap((line, index) => {
    let candidates: string[] = [];
    if (code) {
      if (/<(?:style|script)(?:\s|>)/i.test(line)) codeStyle = true;
      const skip = codeStyle;
      if (/<\/(?:style|script)>/i.test(line)) codeStyle = false;
      if (skip || /^\s*(?:\/\/|<!--|\*)/.test(line)) return [];
      for (const match of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
        const prefix = line.slice(0, match.index);
        if (/\b(?:class|style|id|href|src|target|rel|viewBox|d|aria-controls)\s*=\s*$/.test(prefix)) continue;
        candidates.push(match[2].replace(/\\[nrt]/g, ' ').replace(/\\(["'`\\])/g, '$1'));
      }
      if (path.endsWith('.astro')) for (const match of line.matchAll(/>([^<>{}]+)</g)) candidates.push(match[1]);
      candidates = candidates.map(value => value.trim()).filter(value => candidateText(value) && !/^https?:\/\//.test(value) && !value.includes('${'));
    } else {
      if (index === 0 && line.trim() === '---') { frontmatter = true; return []; }
      if (frontmatter) {
        if (line.trim() === '---') { frontmatter = false; return []; }
        const field = /^\s*(?:title|description|summary):\s*["']?(.+?)["']?\s*$/.exec(line);
        if (!field || !candidateText(field[1])) return [];
        candidates = [field[1]];
      } else {
        if (/^\s*```/.test(line)) { fence = !fence; return []; }
        let claim = line.trim();
        if (path.endsWith('.json')) {
          const value = /^(?:"(?:[^"\\]|\\.)+"\s*:\s*)?("(?:[^"\\]|\\.)*")\s*,?$/.exec(claim);
          if (!value) return [];
          try { claim = JSON.parse(value[1]); } catch { return []; }
          if (!candidateText(claim) || /^https?:\/\//.test(claim) || /\?$/.test(claim)) return [];
        }
        if (fence || !claim || /^(?:<!--|---+$|\|[\s:|-]+\|?$)/.test(claim)) return [];
        claim = claim.replace(/^#{1,6}\s+/, ''); candidates = [claim];
      }
    }
    return [...new Set(candidates)].map(claim => {
      const refs = [...claim.matchAll(/https:\/\/[^\s<>"')\]]+/g)].map(match => match[0]);
      const highStakes = sensitive.test(claim);
      const sourceLine = index + 1;
      return { id: `claim_${claimDigest({path,sourceLine,claim}).slice(7,31)}`, claim, sourcePath: path, sourceLine,
        sourceRef: `https://github.com/${CLAIM_SOURCE.repository}/blob/${CLAIM_SOURCE.commit}/${path.split('/').map(encodeURIComponent).join('/')}#L${sourceLine}`,
        evidenceRefs: refs, classification: highStakes ? 'blocked' as const : 'pending' as const,
        rationale: highStakes ? 'Source assertion requires independent product evidence; no compliance or performance proof is established.' : 'Source-linked candidate awaiting evidence and founder review; links have not been authenticated as supporting proof.' };
    });
  });
}
export function renderClaimsMarkdown(rows: readonly ClaimProofRow[]): string {
  const escape = (value: string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
  const url = (value: string) => value.replace(/[\\()[\]| <>]/g, character => encodeURIComponent(character));
  return '# IVerif claim-evidence review\n\nSource assertions remain candidates. Product compliance, performance, promotion and publication are not established.\n\n'
    + '| Claim | Classification | Source | Evidence and rationale |\n| --- | --- | --- | --- |\n'
    + rows.map(row => `| ${escape(row.claim)} | ${row.classification} | [${escape(row.sourcePath)}:${row.sourceLine}](${url(row.sourceRef)}) | ${row.evidenceRefs.map((ref,index)=>`[reference ${index+1}](${url(ref)})`).join(' ')} ${escape(row.rationale)} |`).join('\n')+'\n';
}
export function validateClaimArtifact(value: unknown, input: ClaimProofInput): value is ClaimProofArtifact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as ClaimProofArtifact;
  if (v.schema !== 'cambium.iverif.claim-proof-artifact.v1' || v.inputDigest !== claimDigest(input)
      || v.policyDigest !== CLAIM_POLICY_DIGEST || v.sourceManifestDigest !== CLAIM_POLICY.sourceManifestDigest
      || !v.files || Object.keys(v.files).sort().join(',') !== 'claims.json,claims.md,provenance.json'
      || !Object.values(v.files).every(text => typeof text === 'string')
      || Buffer.byteLength(canonicalClaimJson(v)) > CLAIM_POLICY.maxArtifactBytes) return false;
  try {
    const rows: unknown = JSON.parse(v.files['claims.json']);
    const provenance = JSON.parse(v.files['provenance.json']);
    if (!Array.isArray(rows) || !rows.length || rows.length > CLAIM_POLICY.maxClaims || new Set(rows.map(row => row?.id)).size !== rows.length) return false;
    for (const file of CLAIM_SOURCE.files) {
      const selected = rows.filter(row => row?.sourcePath === file.path);
      if (!('inventoryDigest' in file) || claimDigest(selected) !== file.inventoryDigest) return false;
    }
    if (provenance.inputDigest !== v.inputDigest || provenance.policyDigest !== v.policyDigest
        || provenance.sourceManifestDigest !== v.sourceManifestDigest || provenance.repository !== CLAIM_SOURCE.repository
        || provenance.commit !== CLAIM_SOURCE.commit || provenance.semanticAcceptance !== 'awaiting-founder-review'
        || canonicalClaimJson(provenance.files) !== canonicalClaimJson(CLAIM_SOURCE.files)) return false;
    if (v.files['claims.md'] !== renderClaimsMarkdown(rows)) return false;
    return rows.every(row => row && typeof row.id === 'string' && /^claim_[a-f0-9]{24}$/.test(row.id)
      && typeof row.claim === 'string' && row.claim.length > 0 && row.claim.length <= 20000
      && CLAIM_SOURCE.files.some(file => file.path === row.sourcePath) && Number.isSafeInteger(row.sourceLine) && row.sourceLine > 0
      && ['blocked','pending','no-signal'].includes(row.classification) && typeof row.rationale === 'string' && row.rationale.length > 0
      && Array.isArray(row.evidenceRefs) && row.evidenceRefs.every((ref: unknown) => typeof ref === 'string' && ref.startsWith('https://'))
      && row.sourceRef === `https://github.com/${CLAIM_SOURCE.repository}/blob/${CLAIM_SOURCE.commit}/${row.sourcePath.split('/').map(encodeURIComponent).join('/')}#L${row.sourceLine}`);
  } catch { return false; }
}
