#!/usr/bin/env bun
// Explicit one-shot adapter to the existing acceptance owner. No key creation,
// provider mutation, resident process, implicit submission or product promotion.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { CLAIM_ACCEPTANCE_PINS, CLAIM_ARTIFACT_INPUT_PATH, CLAIM_FOUNDER_INPUT_PATH, CLAIM_POLICY, CLAIM_POLICY_DIGEST, claimAcceptancePolicyHash, claimDigest, canonicalClaimJson, parseClaimProofInput, validateClaimArtifact } from '../../../shared/iverif-claim-proof.ts';

const root=fs.realpathSync(fileURLToPath(new URL('../../../',import.meta.url)));
const args=process.argv.slice(2),options={};
let stage='arguments';
try {
  for(let i=0;i<args.length;i++) {
    const arg=args[i];if(['--prepare','--accept'].includes(arg))options[arg]=true;
    else if(['--packet','--store','--expected-key-id','--owner-module'].includes(arg)&&args[i+1])options[arg]=args[++i];
    else throw new Error('arguments');
  }
  if(!options['--packet']||Boolean(options['--prepare'])===Boolean(options['--accept']))throw new Error('arguments');
  stage='verifier-pins';
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(!Object.keys(CLAIM_ACCEPTANCE_PINS.files).length)throw new Error('unreviewed-pins');
  for(const [file,digest] of Object.entries(CLAIM_ACCEPTANCE_PINS.files))if(hash(fs.readFileSync(path.join(root,file)))!==digest)throw new Error('verifier-drift');
  stage='packet';
  const packet=JSON.parse(fs.readFileSync(options['--packet'],'utf8')),input=parseClaimProofInput(packet.input),artifact=packet.artifact,proof=packet.proof;
  if(!input||!validateClaimArtifact(artifact,input)||!proof||proof.schema!=='cambium.iverif.founder-acceptance-proof.v1'||proof.decision!=='approved'
      ||proof.taskId!==input.taskId||proof.goalId!==input.goalId||proof.inputDigest!==claimDigest(input)||proof.artifactDigest!==claimDigest(artifact)||proof.policyDigest!==CLAIM_POLICY_DIGEST)throw new Error('packet-mismatch');
  const directory=path.join(root,'.local/iverif-acceptance');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  if(fs.realpathSync(directory)!==directory)throw new Error('output-containment');
  for(const [name,value] of [['claim-artifact.json',artifact],['founder-decision.json',proof],['input.json',input]]) {
    const file=path.join(directory,name);if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw new Error('output-containment');
    fs.writeFileSync(file,canonicalClaimJson(value),{mode:0o600});
  }
  const sourcePath='shared/iverif-claim-proof.ts',testFile='scripts/iverif-claim-acceptance.test.mjs';
  const files=[...Object.keys(CLAIM_ACCEPTANCE_PINS.files),'docs/project-management/iverif-claim-acceptance-verifier.v1.json',CLAIM_ARTIFACT_INPUT_PATH,CLAIM_FOUNDER_INPUT_PATH,'.local/iverif-acceptance/input.json'];
  const source=fs.readFileSync(path.join(root,sourcePath),'utf8');
  const criteria=['parseClaimProofInput','inventoryClaimSource','validateClaimArtifact'].map(symbol=>({criterionId:'claim-proof:'+symbol,symbol}));
  const audit={schema:'cambium.iverif.claim-owner-audit.v1',claims:criteria.map(criterion=>({criterionId:criterion.criterionId,path:sourcePath,symbol:criterion.symbol,
    quote:source.split('\n').find(line=>line.startsWith('export function '+criterion.symbol+'('))}))};
  const approvedHashes=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
  const policy={policyId:'cambium.iverif.claim-proof.acceptance.v1',repoIdentity:'Sheshiyer/cambium',workObjectId:'sapling:iverif',loadoutId:CLAIM_POLICY.loadoutId,clusterId:CLAIM_POLICY.clusterId,
    sourcePath,artifactSchema:audit.schema,criteria,inputFiles:files,runnerFiles:[],approvedHashes,
    allowedImports:{[sourcePath]:['../docs/project-management/iverif-claim-proof-source.v1.json','../docs/project-management/iverif-claim-acceptance-verifier.v1.json'],
      [testFile]:['../shared/iverif-claim-proof.ts'],['bin/operator/quests/iverif-claim-acceptance.mjs']:['../../../shared/iverif-claim-proof.ts']},
    dataFiles:files.filter(file=>file.endsWith('.json')),
    testSelection:{dir:'scripts',suffix:'.test.mjs',includes:'iverif-claim-acceptance',expected:path.basename(testFile)},
    runner:{kind:'node-tap',args:['--test','--test-reporter=tap',testFile],env:{},minTests:5,timeoutMs:10000,maxBytes:1000000},
    policyHash:claimAcceptancePolicyHash(claimDigest(artifact),claimDigest(proof))};
  fs.writeFileSync(path.join(directory,'policy.json'),JSON.stringify(policy,null,2)+'\n',{mode:0o600});
  fs.writeFileSync(path.join(directory,'owner-audit.json'),canonicalClaimJson(audit),{mode:0o600});
  if(options['--prepare']) { process.stdout.write(JSON.stringify({status:'prepared',taskId:input.taskId,artifactDigest:claimDigest(artifact),founderDecisionDigest:claimDigest(proof),policyHash:policy.policyHash,signed:false,submitted:false})+'\n'); }
  else {
    stage='existing-owner-runtime';
    if(!process.versions.bun)throw new Error('existing-owner-requires-bun');
    stage='existing-owner';
    if(!options['--store']||!/^ed25519:[a-f0-9]{64}$/.test(options['--expected-key-id']??''))throw new Error('owner-required');
    const modulePath=fs.realpathSync(options['--owner-module']??path.join(homedir(),'.temperance_engine/router/wtfmedia-accepted-work-unit.v1.ts'));
    for(const [name,digest] of Object.entries(CLAIM_ACCEPTANCE_PINS.ownerModules))if(hash(fs.readFileSync(path.join(path.dirname(modulePath),name)))!==digest)throw new Error('owner-drift');
    const storeRoot=fs.realpathSync(options['--store']);
    for(const name of ['owner.key','owner.ed25519']) {const stat=fs.lstatSync(path.join(storeRoot,name));if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw new Error('existing-private-owner-required');}
    const library=await import(pathToFileURL(modulePath).href);
    const owner=library.createAcceptanceOwner({policy,repoRoot:root,storeRoot});
    if(owner.attestationPublicKey().keyId!==options['--expected-key-id'])throw new Error('owner-scope-mismatch');
    stage='owner-verification';
    const contract=await owner.admit({taskId:input.taskId,goalId:input.goalId,workObjectId:'sapling:iverif',executionInputDigest:claimDigest(input)});
    await owner.accept(contract.contractId,canonicalClaimJson(audit));
    const envelope=await owner.attest(input.taskId);
    fs.writeFileSync(path.join(directory,'owner-attestation.json'),canonicalClaimJson(envelope),{mode:0o600});
    process.stdout.write(JSON.stringify({status:'owner-verified',taskId:input.taskId,receiptDigest:envelope.receiptDigest,artifactDigest:claimDigest(artifact),signed:true,submitted:false})+'\n');
  }
}catch {process.stderr.write(JSON.stringify({status:'held',stage,signed:false,submitted:false})+'\n');process.exitCode=1;}
