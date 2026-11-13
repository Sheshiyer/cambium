/** Actual local owner readers. File reads only; no planning, publication or graph writer. */
import { readFile, realpath, lstat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { DepartmentSourceReaders, GsdSourceHold } from '../../../shared/department-pilot/readers.ts';
import type { KpiDefinition, ProductId } from '../../../shared/department-pilot/catalog.ts';
export const sha = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export interface PlanningRead { productId: ProductId; workObjectId: string; sourceHead: string; files: Array<{path:string;digest:string|null}>; hold: GsdSourceHold }
export async function readPlanningOwner(root: string, productId: ProductId): Promise<PlanningRead> {
  const canonical = await realpath(root);
  const files: PlanningRead['files'] = [];
  let orchestration: Record<string, unknown> | null = null;
  for (const relative of ['ISA.md','.planning/STATE.md','.planning/ORCHESTRATION.json','.planning/APPROVALS.json','.planning/NEXT-WAVE.json']) {
    const path = join(canonical,relative);
    try {
      const stat=await lstat(path); const target=await realpath(path);
      if(!stat.isFile() || stat.isSymbolicLink() || !target.startsWith(canonical+sep) || stat.size>2_000_000)throw new Error('Unsafe planning source');
      const content=await readFile(path,'utf8'); files.push({path:relative,digest:sha(content)});
      if(relative.endsWith('ORCHESTRATION.json'))orchestration=JSON.parse(content);
    } catch(error) {
      if((error as NodeJS.ErrnoException).code==='ENOENT'){files.push({path:relative,digest:null});continue;}
      throw error;
    }
  }
  const sourceHead=execFileSync('git',['-C',canonical,'rev-parse','HEAD'],{encoding:'utf8',timeout:5000}).trim();
  const workObjectId=productId==='lumenbar'?'sapling:lumen-bar':'program:temperance-hermes';
  const sourceRef=`owner-files:${productId}:${sourceHead}:${sha(JSON.stringify(files))}`;
  const missing=!files.some(f=>f.path==='ISA.md'&&f.digest)||!orchestration;
  // The existing orchestration does not declare canonical graph-node mappings or a
  // corresponding accepted owner contract. Never convert a cached approval flag.
  const reason=missing?'Actual product planning files read; ISA/GSD scope or graph-node mapping is missing. Owner acceptance is required.':
    `Actual ISA/GSD files read; orchestration state ${String(orchestration?.state??'unknown')}. An exact accepted owner task-to-graph mapping and dependency evidence are required; no tasks admitted.`;
  return {productId,workObjectId,sourceHead,files,hold:{kind:'owner-hold',state:missing?'unavailable':'held',sourceRef,reason}};
}
export interface EditorialEvidence {
  schema: string; queueDigest: string; approvalDigest: string; consumerDigest: string;
  items: Array<{id:string;status:string;platform:string;account:string;destination:string;scheduled_for:string;payload_sha256:string;approvalDigest:string;
    publication:null|{observedAt:string;publicUrl:string;receiptDigest:string;observationDigest:string;trust:string}}>;
}
export function growthMeasurement(definition: KpiDefinition, evidence: EditorialEvidence, now: string, window: string) {
  if(definition.departmentId!=='growth')return null;
  const at=Date.parse(now);if(!Number.isFinite(at))throw new Error('Invalid reader clock');
  const prefix=definition.productId==='lumenbar'?'launch-lumenbar-':'launch-temperance-';
  const all=evidence.items.filter(item=>item.id.startsWith(prefix));
  if(all.length!==3||new Set(all.map(i=>i.id)).size!==3)throw new Error('Incomplete or duplicate approved product cohort');
  const due=all.filter(item=>{
    const time=Date.parse(item.scheduled_for);if(!Number.isFinite(time))throw new Error('Invalid approved time');
    const month=new Date(time+330*60000).toISOString().slice(0,7);return time<=at&&month===window;
  });
  // Eligibility for an uncompleted due item requires an actual native-channel
  // outcome. Its absence holds the whole denominator rather than excluding it.
  if(!due.length||due.some(i=>!i.publication))return null;
  for(const item of due) {
    const observed=Date.parse(item.publication!.observedAt);
    if(!Number.isFinite(observed)||observed>at||at-observed>definition.maxAgeHours*3600000)return null;
  }
  return [{definition,observation:{definitionId:definition.id,version:definition.version,productId:definition.productId,
    cohort:definition.cohort,window,observedAt:new Date(Math.min(...due.map(i=>Date.parse(i.publication!.observedAt)))).toISOString(),sourceRef:`editorial-native:${sha(JSON.stringify({queue:evidence.queueDigest,approval:evidence.approvalDigest,consumer:evidence.consumerDigest,due}))}:operator-observed`,
    numerator:due.length,denominator:due.length}}];
}
export function bindOwnerReaders(plans: PlanningRead[], editorial: EditorialEvidence): DepartmentSourceReaders {
  return {
    readAcceptedGsd:async(_scope,workObjectId)=>plans.find(p=>p.workObjectId===workObjectId)?.hold??null,
    readKpi:async(scope,definition,window)=>growthMeasurement(definition,editorial,scope.observedAt,window),
  };
}
