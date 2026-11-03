import {qualifyFieldAtlasViewport} from './field-atlas-viewport-contract.mjs';
if(process.argv.length>3 || process.argv[2] && process.argv[2]!=='--json')throw new Error('Only --json is supported');
const report=qualifyFieldAtlasViewport();
if(process.argv[2]==='--json')console.log(JSON.stringify(report,null,2));
else{
  console.log(`Current3D source proof: ${report.sourceProofOk ? 'PASS' : 'FAIL'}; ${report.currentSourceFrames} frames.`);
  for(const failure of report.sourceFailures)console.error(failure);
  console.log(`Retained operational qualification: ${report.currentCompleteBehaviorProofs}/${report.retainedRequired}; ${report.held.length} required behavior proofs held. Historical PNGs and partial layouts do not qualify them.`);
  for(const row of report.held)console.log(`HELD ${row.legacyPath}: ${row.behaviorIntent}`);
}
if(!report.ok)process.exitCode=1;
