// Descriptive presentation only. Never merge these DTOs into actions, plans or receipts.
export type MappingAnnotationDTO = Readonly<{
 workId: string; label: string; description: string; relation: string;
 relatedWorkIds: readonly string[]; repositoryIds: readonly string[]; sourceRefs: readonly string[];
 caveat: string;
}>;
const rules: Readonly<Record<string, readonly [string, readonly string[], readonly string[]]>> = {
 'program:hdilint': ['backend-component', ['sapling:fitcheck'], ['R_kgDOS4jKmg']],
 'program:engineering-orchestration': ['absorbed-capability', ['sapling:cambium'], ['R_kgDOR8yoLw','R_kgDORnhHjQ']],
 'program:thoughtseed-brand-atlas': ['test-reference-rework-pending', ['program:meristem-brand-system'], ['R_kgDOTq9alA']],
 'program:teamforge-control-plane': ['retained-infra-retired-app', ['sapling:seedforge','sapling:cambium'], ['R_kgDOR6-E3A']],
};
const sourceRefs = ['vault:20-operations/project-management/project-repo-context-library.md','vault:00-meta/saplings-branches-operating-model.md'];
const fields = ['workId','relatedWorkIds','relation','description','repositoryIds','sourceMessage','evidence','runtimeVerification','sourceRefs','authority','actionability'];
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) { return Reflect.ownKeys(value).length === keys.length && Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')); }
function denseArray(value: unknown): value is unknown[] {
 if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
 if (Reflect.ownKeys(value).length !== value.length + 1) return false;
 for (let i = 0; i < value.length; i++) {
  const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return false;
 }
 return true;
}
function sameStrings(value: unknown, expected: readonly string[]): value is string[] {return denseArray(value) && value.length === expected.length && value.every((x,i)=>x===expected[i]);}
export function parseAnnotations(value: unknown): readonly MappingAnnotationDTO[] {
 if (!object(value) || !exactKeys(value,['schema','status','records']) || value.schema !== 'cambium.mapping-annotations.proposal.v1' || value.status !== 'proposal-only' || !denseArray(value.records) || value.records.length !== 4) return [];
 const seen = new Set<string>(); const result: MappingAnnotationDTO[] = [];
 for (const row of value.records) {
  if (!object(row) || !exactKeys(row,fields) || typeof row.workId !== 'string' || !Object.hasOwn(rules,row.workId) || seen.has(row.workId)) return [];
  const [relation, related, repos] = rules[row.workId];
  if (row.relation !== relation || !sameStrings(row.relatedWorkIds,related) || !sameStrings(row.repositoryIds,repos) || !sameStrings(row.sourceRefs,sourceRefs) || row.authority !== 'descriptive-only' || row.actionability !== 'none' || row.evidence !== 'founder-confirmed' || row.runtimeVerification !== 'not-independently-verified') return [];
  if(typeof row.sourceMessage !== 'string' || !/^Sentinel_[a-f0-9]{32}$/.test(row.sourceMessage) || typeof row.description !== 'string' || row.description.length < 1 || row.description.length > 1200 || /[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]|javascript:|data:/i.test(row.description)) return [];
  seen.add(row.workId);
  result.push(Object.freeze({workId:row.workId,label:'Mapping note · founder-confirmed',description:row.description,relation,relatedWorkIds:Object.freeze([...related]),repositoryIds:Object.freeze([...repos]),sourceRefs:Object.freeze([...sourceRefs]),caveat:'Descriptive only. Runtime integration is not independently verified; this note grants no action or admission authority.'}));
 }
 return Object.freeze(result);
}
export function annotationFor(value: unknown, workId: string): MappingAnnotationDTO | null {return parseAnnotations(value).find(row=>row.workId===workId) ?? null;}
