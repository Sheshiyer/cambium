#!/usr/bin/env node
/** Manually read actual sources and prepare evidence, never write a ledger or graph. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlanningOwner, bindOwnerReaders, sha } from '../bin/operator/quests/department-owner-readers.ts';
import { readDepartmentSources } from '../shared/department-pilot/readers.ts';
const options={};const args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){if(!['--graph','--lumenbar','--temperance','--queue','--approval','--consumer','--out','--now'].includes(args[i])||!args[i+1]||Object.hasOwn(options,args[i]))throw new Error('Invalid or duplicate reader option');options[args[i]]=args[i+1];}
for(const required of ['--graph','--lumenbar','--temperance','--queue','--approval','--consumer','--out'])if(!options[required])throw new Error(`Missing ${required}`);
const now=options['--now']??new Date().toISOString();
const graphText=await readFile(options['--graph'],'utf8');const graph=JSON.parse(graphText);
if(graph.schema!=='cambium.founder.bookkeeping-graph.v1'||!graph.head?.graphDigest||graph.tenantId!=='cambium'||!Array.isArray(graph.nodes)||graph.nodes.length>512)throw new Error('Existing authenticated founder graph readback required');
const nowMs=Date.parse(now),served=Date.parse(graph.servedAt);
if(!Number.isFinite(nowMs)||!Number.isFinite(served)||served>nowMs||nowMs-served>3600000)throw new Error('Graph readback must be current within one hour');
const plans=await Promise.all([readPlanningOwner(options['--lumenbar'],'lumenbar'),readPlanningOwner(options['--temperance'],'temperance')]);
const helper=join(dirname(fileURLToPath(import.meta.url)),'read-editorial-kpi-evidence.py');
const editorial=JSON.parse(execFileSync('python3',[helper,resolve(options['--consumer']),resolve(options['--queue']),resolve(options['--approval'])],{encoding:'utf8',timeout:20000,maxBuffer:1000000}));
const sources=await readDepartmentSources({tenantId:'cambium',headDigest:graph.head.graphDigest,observedAt:now,nodes:graph.nodes},bindOwnerReaders(plans,editorial));
const after=await Promise.all([readPlanningOwner(options['--lumenbar'],'lumenbar'),readPlanningOwner(options['--temperance'],'temperance')]);
if(JSON.stringify(plans)!==JSON.stringify(after)||sha(await readFile(options['--queue']))!==editorial.queueDigest||sha(await readFile(options['--approval']))!==editorial.approvalDigest||sha(await readFile(options['--graph'],'utf8'))!==sha(graphText))throw new Error('Source changed during reconciliation');
const output={schema:'cambium.department-owner-reconciliation.v1',observedAt:now,head:graph.head,graphSourceDigest:sha(graphText),plans,editorial,sources,
  readerMode:'manual actual owner file/native-consumer read; not deployed',executionGranted:false,productionChanged:false,requiresHitl:['Accepted product GSD scope and canonical task mapping','Missing cohort measurement sources and any targets','Automatic serving integration/release; keep version93 serving']};
await writeFile(options['--out'],JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:options['--out'],gsd:sources.gsd.map(r=>({product:r.productId,state:r.state})),kpis:sources.kpis.map(r=>({id:r.definitionId,state:r.state,counts:r.observation?[r.observation.numerator,r.observation.denominator]:null})),productionChanged:false}));
