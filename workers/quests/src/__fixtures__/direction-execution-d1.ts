import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { directionExecutionFixture } from '../__fixtures__/direction-execution.ts';
import { buildDirectionExecutionProposal } from '../direction-execution-review.ts';
import { d1GoalGraphStore, goalGraphApprovalDigest } from '../goal-graph-store.ts';
import { compileGoalGraph } from '../goal-graph/compiler.ts';
import { d1SharedDirectionStore } from '../shared-directions-d1.ts';
import { d1DirectionAdmissionStore } from '../direction-execution-d1.ts';
import { d1NativeLaunchStore } from '../native-launch-d1.ts';
import { nativeLaunchRequestDigest, nativeLaunchRequestKey } from '../native-launch.ts';
import { patchDigest } from '../../../../shared/cambium-patch-contract.ts';
export async function directionExecutionD1Fixture(approve=true){
 const f=directionExecutionFixture(),db=new DatabaseSync(':memory:');
 for(const m of ['0007_goal_graph.sql','0009_goal_graph_operational_anchors.sql','0099_native_launch_requests.sql','0102_shared_signals.sql','0103_shared_directions.sql','0104_native_direction_admissions.sql'])db.exec(readFileSync(new URL('../../migrations/'+m,import.meta.url),'utf8'));
 let beforeInsert:(()=>void)|undefined; let beforeDecision:(()=>void)|undefined;
 const d1:any={prepare(sql:string){const statement=db.prepare(sql);let args:any[]=[];const api={bind(...v:any[]){args=v;return api},async first(){return statement.get(...args)??null},async all(){return{results:statement.all(...args)}},async run(){if(sql.includes('INSERT INTO native_direction_admissions'))beforeInsert?.();if(sql.includes('INSERT INTO goal_graph_approvals'))beforeDecision?.();return{meta:{changes:Number(statement.run(...args).changes)}}}};return api},async batch(rows:any[]){db.exec('BEGIN');try{const out=[];for(const row of rows)out.push(await row.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};
 const graph=d1GoalGraphStore(d1);
 async function commit(changeSet:any){const core={tenantId:'cambium',changeDigest:changeSet.changeDigest,intentVersion:1,approverId:f.scope.principal,expiresAt:'2026-11-04T01:00:00.000Z',nonce:'fixture-approval:'+changeSet.changeDigest};const result=await graph.commit({tenantId:'cambium',changeSet,approval:{...core,decision:'approved',approvalDigest:goalGraphApprovalDigest(core)},now:f.now});assert.equal(result.status,'committed');return core;}
 const boot=compileGoalGraph({tenantId:'cambium',expectedHeadDigest:null,actualHead:null,currentNodes:[],proposedNodes:f.nodes,graphVersion:1,sourceRef:f.nodes[0].sourceRef,sourceDigest:f.nodes[0].sourceDigest,now:f.now});assert.equal(boot.status,'compiled');if(boot.status!=='compiled')throw Error();await commit(boot.changeSet);
 assert.equal((await graph.readHead('cambium'))?.graphDigest,f.head.graphDigest);
 await d1SharedDirectionStore(d1).write(f.scope,'create','fixture',f.direction,0);
 db.prepare('INSERT INTO shared_signals VALUES(?,?,?,?,?,?)').run('cambium',f.scope.principal,f.signals[0].id,3,f.now,JSON.stringify(f.signals[0]));
 const proposed=buildDirectionExecutionProposal(f),core={tenantId:'cambium',changeDigest:proposed.changeSet.changeDigest,intentVersion:1,approverId:f.scope.principal,expiresAt:'2026-11-04T01:00:00.000Z',nonce:'fixture-approval:'+proposed.changeSet.changeDigest};
 if(approve)await commit(proposed.changeSet);
 const task={tenantId:'cambium',intentVersion:1,changeDigest:proposed.changeSet.changeDigest,node:proposed.node,changeSet:proposed.changeSet,directionExecution:proposed.review,approvalNonce:core.nonce};
 const scope={tenantId:'cambium',principalId:f.scope.principal},head=await graph.readHead('cambium');
 const args={scope,task,expectedHeadDigest:head!.graphDigest,policyDigest:patchDigest(f.policy),now:f.now,authorize:async()=>true};
 const store=d1DirectionAdmissionStore(d1),launch=d1NativeLaunchStore(d1,{directionPolicyDigest:args.policyDigest});
 return{f,db,d1,store,launch,args,graph,setRace(fn:()=>void){beforeInsert=fn;},setDecisionRace(fn:()=>void){beforeDecision=fn;}};
}
