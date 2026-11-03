#!/usr/bin/env node
// Finite transport for the existing member bridge; no signer or credential store.
import fs from 'node:fs';
import resourceMap from '../../../docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json' with {type:'json'};
import {CLAIM_POLICY_DIGEST,claimDigest,parseClaimProofInput,validateClaimArtifact,canonicalClaimJson} from '../../../shared/iverif-claim-proof.ts';
const [action,proposalId]=process.argv.slice(2),directory='.local/iverif-acceptance',root=fs.realpathSync('.');
try{
 if(!['fetch','submit'].includes(action)||!/^cambium:(?:sha256:)?[a-f0-9]{64}$/.test(proposalId??''))throw new Error('arguments');
 const token=process.env.HERMES_RUNNER_MEMBER_TOKEN;if(!token?.trim())throw new Error('existing_member_credential_required');
 const headers={authorization:'Bearer '+token,'content-type':'application/json'};
 const credential=(direct,file)=>process.env[direct]?.trim()||(process.env[file]?fs.readFileSync(process.env[file],'utf8').trim():undefined);
 const client=credential('HERMES_RUNNER_CF_ACCESS_CLIENT_ID','HERMES_RUNNER_CF_ACCESS_CLIENT_ID_FILE'),secret=credential('HERMES_RUNNER_CF_ACCESS_CLIENT_SECRET','HERMES_RUNNER_CF_ACCESS_CLIENT_SECRET_FILE');
 if(Boolean(client)!==Boolean(secret))throw new Error('paired_access_required');
 if(client){headers['CF-Access-Client-Id']=client;headers['CF-Access-Client-Secret']=secret;}
 const request=async(path,body)=>{const response=await fetch('https://'+resourceMap.production.worker.custom_domain+path,{method:body?'POST':'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw new Error('owner_read_or_write_held');return response.json();};
 const packet=action==='fetch'?await request('/v1/bridge/claim-proof/acceptance-request/'+encodeURIComponent(proposalId)):JSON.parse(fs.readFileSync(directory+'/packet.json','utf8'));
 const input=parseClaimProofInput(packet.input),proof=packet.proof;
 if(!input||!validateClaimArtifact(packet.artifact,input)||proof?.proposalId!==proposalId||proof?.decision!=='approved'||proof?.inputDigest!==claimDigest(input)||proof?.artifactDigest!==claimDigest(packet.artifact)||proof?.policyDigest!==CLAIM_POLICY_DIGEST)throw new Error('packet_mismatch');
 if(action==='fetch'){
  for(const folder of ['.local',directory]){if(fs.existsSync(folder)&&fs.lstatSync(folder).isSymbolicLink())throw new Error('output_containment');if(!fs.existsSync(folder))fs.mkdirSync(folder,{mode:0o700});if(fs.realpathSync(folder)!==root+'/'+folder)throw new Error('output_containment');}
  const file=directory+'/packet.json';if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw new Error('output_containment');
  fs.writeFileSync(file,canonicalClaimJson(packet),{mode:0o600});console.log(JSON.stringify({status:'fetched',proposalId,artifactDigest:proof.artifactDigest,signed:false,submitted:false}));
 }else{
  const envelope=JSON.parse(fs.readFileSync(directory+'/owner-attestation.json','utf8'));
  const result=await request('/v1/bridge/claim-proof/acceptance',{proposalId,envelope});
  if(result.accepted!==true||result.artifactDigest!==proof.artifactDigest||typeof result.receiptDigest!=='string')throw new Error('readback_unconfirmed');
  console.log(JSON.stringify({status:'accepted',...result}));
 }
}catch{console.error(JSON.stringify({status:'held',action:action??'invalid',retry:action==='submit'?'recover_or_resubmit_same_envelope_only':'read_only'}));process.exitCode=1;}
