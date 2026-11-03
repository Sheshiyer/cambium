#!/usr/bin/env node
/** Manual file-to-file read projection. Never connects to D1, a provider or scheduler. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileDepartmentPilot } from '../shared/department-pilot/pilot.ts';
const args=process.argv.slice(2), options={};
for(let i=0;i<args.length;i+=2) {
  if(!['--graph','--out','--now','--eligibility','--expected-head'].includes(args[i])||!args[i+1]||Object.hasOwn(options,args[i]))throw new Error('Use --graph FILE --out FILE [--now ISO] [--eligibility FILE] [--expected-head DIGEST]');
  options[args[i]]=args[i+1];
}
if(!options['--graph']||!options['--out'])throw new Error('--graph and --out are required');
if(options['--graph']===options['--out'])throw new Error('Output must not overwrite the graph source');
const raw=await readFile(options['--graph'],'utf8');
if(Buffer.byteLength(raw)>2_000_000)throw new Error('Source packet exceeds two megabytes');
const graph=JSON.parse(raw);
if(graph.schema!=='cambium.founder.bookkeeping-graph.v1'||!graph.head||!Array.isArray(graph.nodes))throw new Error('Expected existing founder bookkeeping graph readback');
const eligibility=options['--eligibility']?JSON.parse(await readFile(options['--eligibility'],'utf8')):undefined;
const input={tenantId:graph.tenantId,now:options['--now']??new Date().toISOString(),expectedHeadDigest:options['--expected-head']??graph.head.graphDigest,
  graph:{tenantId:graph.tenantId,headDigest:graph.head.graphDigest,observedAt:graph.servedAt,nodes:graph.nodes},eligibility};
const projection=compileDepartmentPilot(input);
const sourceSha256=createHash('sha256').update(raw).digest('hex');
const output={schema:'cambium.department-pilot-packet.v1',sourceSha256,sourceAuthority:'supplied-dated-readback-not-live-verification',
  replayKey:createHash('sha256').update(JSON.stringify(input)).digest('hex'),input,projection};
await writeFile(options['--out'],JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:options['--out'],products:projection.products.map(p=>({id:p.id,nodes:p.nodes.length,daily:p.daily.length,monthly:p.monthly.length})),executionGranted:false}));
