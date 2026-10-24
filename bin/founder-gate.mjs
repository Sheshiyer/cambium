#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function reviewFingerprint(row) { return 'sha256:'+createHash('sha256').update(canonical(row)).digest('hex'); }

export function confirmation(row, decision) {
  return `${decision} ${row.changeDigest} version ${row.graphVersion} expires ${row.approvalExpiresAt} nonce ${row.approvalNonce} head ${row.expectedHeadVersion} fence ${row.fence} review ${reviewFingerprint(row)}: ${row.summary} Consequence: ${row.consequence} Reversibility: ${row.reversibility}`;
}
export function createFounderClient({ origin, tenant, accessJwt, fetchImpl = fetch, now = Date.now }) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('origin must be an HTTPS origin');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(tenant)) throw Error('invalid tenant');
  if (typeof accessJwt!=='string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessJwt)) throw Error('an existing founder Access JWT session is required');
  const headers = { cookie: `CF_Authorization=${accessJwt}`, 'x-cambium-founder-web':'1', origin:base.origin, 'content-type':'application/json' };
  async function call(path, body) {
    const response = await fetchImpl(new URL(path, base), { method: body ? 'POST':'GET', headers, redirect:'error', signal:AbortSignal.timeout(10000), ...(body ? {body:JSON.stringify(body)}:{}) });
    if (!response.ok) throw Error(`Founder Gate returned HTTP ${response.status}; no automatic retry`);
    try { return await response.json(); } catch { throw Error('Founder Gate returned invalid JSON'); }
  }
  async function read() {
    const data=await call(`/founder/api/quests/${tenant}`);
    if (data.schema!==1 || data.tenant!==tenant) throw Error('invalid tenant envelope');
    return data;
  }
  async function proposal(digest) {
    const data=await read();
    const row=data.goalGraphIntake?.rows?.find(row=>row.changeDigest===digest);
    if (!row || row.tenantId!==tenant || row.status!=='pending' || row.source!=='telegram-goal-graph-intake@v1'
        || row.founderInspect?.consistent!==true || row.founderInspect?.changeDigest!==digest
        || !Number.isInteger(row.graphVersion) || !Number.isInteger(row.expectedHeadVersion) || !Number.isInteger(row.fence)
        || !row.approvalNonce || !Number.isFinite(Date.parse(row.approvalExpiresAt))) throw Error('verified founder proposal unavailable');
    return row;
  }
  async function status(digest) {
    const data=await read();
    const row=data.goalGraphDecisions?.rows?.find(row=>row.changeDigest===digest);
    // Existing UI history is a projection; it cannot settle an uncertain D1 write.
    return {status:row?.decision ?? (data.goalGraphIntake?.rows?.some(row=>row.changeDigest===digest)?'pending':'unknown'),canonicalReadback:false,projection:row??null};
  }
  async function decide(digest, decision, expected) {
    if (!['approve','reject'].includes(decision)) throw Error('invalid decision');
    const row=await proposal(digest);
    if (row.graphVersion!==expected.version || row.approvalExpiresAt!==expected.expiry || expected.confirmation!==confirmation(row,decision)) throw Error('proposal changed or exact informed confirmation missing');
    if (Date.parse(row.approvalExpiresAt)<=now()) throw Error('proposal expired');
    const kind=decision==='approve'?'approve-goal-graph':'reject-goal-graph';
    try {
      const result=await call(`/founder/api/gate/${tenant}`,{kind,subject:digest,changeDigest:digest,nonce:row.approvalNonce,expiresAt:row.approvalExpiresAt,
        expectedHeadVersion:row.expectedHeadVersion,fence:row.fence,idempotencyKey:`${kind}:${tenant}:${digest}`});
      if (result.ok!==true || result.tenantId!==tenant || result.changeDigest!==digest || (decision==='approve' ? result.committed!==true || result.approvalNonce!==row.approvalNonce : result.rejected!==true || result.approvalNonce!==row.approvalNonce)) return {status:'unknown',retry:'status_only'};
      return {status:decision==='approve'?'approved':'rejected',receipt:result};
    } catch {
      let observed=null; try {observed=await status(digest);} catch { /* keep unknown */ }
      return {status:'unknown',retry:'status_only',observed};
    }
  }
  return {proposal,status,decide};
}
export async function main(argv=process.argv.slice(2),env=process.env) {
  if (argv[0]==='--help' || !argv.length) {
    console.log('founder-gate read|approve|reject|status DIGEST [--version N --expiry ISO --confirm EXACT_TEXT]\nSet CAMBIUM_ORIGIN, CAMBIUM_TENANT and CAMBIUM_ACCESS_JWT from an existing founder session. read prints exact confirmation text. Never pass credentials as arguments. Unknown decisions are not retried.'); return;
  }
  const [command,digest,...rest]=argv;
  if (!['read','approve','reject','status'].includes(command) || !/^(?:sha256:)?[a-f0-9]{64}$/.test(digest??'')) throw Error('invalid command or digest');
  const flags={};for(let i=0;i<rest.length;i+=2){if(!['--version','--expiry','--confirm'].includes(rest[i]) || rest[i+1]===undefined)throw Error('invalid option');flags[rest[i]]=rest[i+1];}
  const client=createFounderClient({origin:env.CAMBIUM_ORIGIN??'https://curious.thoughtseed.space',tenant:env.CAMBIUM_TENANT??'thoughtseed',accessJwt:env.CAMBIUM_ACCESS_JWT});
  let result;
  if(command==='read'){const row=await client.proposal(digest);result={...row,approveConfirmation:confirmation(row,'approve'),rejectConfirmation:confirmation(row,'reject')};}
  else if(command==='status')result=await client.status(digest);
  else result=await client.decide(digest,command,{version:Number(flags['--version']),expiry:flags['--expiry'],confirmation:flags['--confirm']});
  console.log(JSON.stringify(result,null,2));if(result.status==='unknown')process.exitCode=2;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Founder Gate command failed; no credentials or remote error body printed. Check the authenticated founder session and exact proposal.');process.exitCode=1;});
