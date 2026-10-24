#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Independently bind the exact review displayed by this client. */
export function reviewConfirmation(p, decision) {
  const fingerprint = createHash('sha256').update(canonical(p.review)).digest('hex');
  return `${decision} proposal ${p.proposalId} version ${p.version} digest ${p.changeDigest} expires ${p.expiresAt}: ${p.summary} review sha256:${fingerprint}`;
}

export function createFounderClient({ origin, tenant, accessJwt, fetchImpl = fetch, now = Date.now }) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('origin must be an HTTPS origin');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(tenant)) throw Error('invalid tenant');
  if (typeof accessJwt!=='string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessJwt)) throw Error('an existing founder Access JWT session is required');
  const headers = { cookie: `CF_Authorization=${accessJwt}`, 'x-cambium-founder-web':'1', origin:base.origin, 'content-type':'application/json' };
  async function call(path, body) {
    const response = await fetchImpl(new URL(path, base), { method: body ? 'POST':'GET', headers, redirect:'error', signal:AbortSignal.timeout(10000), ...(body ? {body:JSON.stringify(body)}:{}) });
    if (!response.ok && response.status !== 409) throw Error(`Founder Gate returned HTTP ${response.status}; no automatic retry`);
    try { return await response.json(); } catch { throw Error('Founder Gate returned invalid JSON'); }
  }
  function proposalId(digest) {
    if (!/^(?:sha256:)?[a-f0-9]{64}$/.test(digest ?? '')) throw Error('invalid digest');
    return `${tenant}:${digest}`;
  }
  async function proposal(digest) {
    const id = proposalId(digest);
    const data = await call('/v1/founder/proposal', {proposalId:id});
    const p = data?.proposal;
    if (data?.status !== 'review' || data.writerAuthority !== false || !p
        || p.proposalId !== id || p.tenantId !== tenant || p.changeDigest !== digest
        || !Number.isInteger(p.version) || p.version < 1
        || typeof p.nonce !== 'string' || !p.nonce
        || !Number.isFinite(Date.parse(p.expiresAt)) || typeof p.summary !== 'string'
        || !p.review || p.review.tenantId !== tenant || p.review.changeDigest !== digest
        || p.review.founderInspect?.consistent !== true
        || p.review.founderInspect?.changeDigest !== digest
        || typeof data.approveConfirmation !== 'string' || !data.approveConfirmation
        || typeof data.rejectConfirmation !== 'string' || !data.rejectConfirmation
        || p.review.approvalNonce !== p.nonce || p.review.approvalExpiresAt !== p.expiresAt
        || typeof p.review.consequence !== 'string' || typeof p.review.reversibility !== 'string'
        || p.summary !== `${p.review.summary} Consequence: ${p.review.consequence} Reversibility: ${p.review.reversibility}`
        || !p.review.changeSet || p.review.changeSet.tenantId !== tenant || p.review.changeSet.changeDigest !== digest
        || !['nodesToCreate','nodesToUpdate','nodesToRemove'].every(key => Array.isArray(p.review.changeSet[key]))
        || !Number.isInteger(p.review.graphVersion) || p.review.graphVersion < 1
        || p.review.fence !== p.review.graphVersion || p.review.expectedHeadVersion !== p.review.graphVersion - 1
        || p.review.changeSet.graphVersion !== p.review.graphVersion
        || data.approveConfirmation !== reviewConfirmation(p, 'approved')
        || data.rejectConfirmation !== reviewConfirmation(p, 'rejected')) {
      throw Error('verified founder proposal unavailable');
    }
    return {...p, approveConfirmation:data.approveConfirmation, rejectConfirmation:data.rejectConfirmation};
  }
  function tuple(p, decision, text) {
    return {proposalId:p.proposalId, version:p.version, changeDigest:p.changeDigest,
      nonce:p.nonce, expiresAt:p.expiresAt, decision, confirmation:text};
  }
  function validatedOutcome(data, input) {
    if (!data || data.writerAuthority !== false || data.canonicalReadback !== true) throw Error('invalid canonical readback');
    if (data.status === 'pending' && !data.receipt && !data.receiptDigest) {
      return {...data, canonicalReadback:true};
    }
    const r = data.receipt;
    if (!['approved','rejected','conflict'].includes(data.status) || !r
        || !/^(?:sha256:)?[a-f0-9]{64}$/.test(data.receiptDigest ?? '')
        || r.proposalId !== input.proposalId || r.tenantId !== tenant
        || r.version !== input.version || r.changeDigest !== input.changeDigest
        || r.nonce !== input.nonce || r.expiresAt !== input.expiresAt
        || typeof r.founderId !== 'string' || !r.founderId
        || !['approved','rejected'].includes(r.decision)
        || !Number.isFinite(Date.parse(r.decidedAt))
        || (r.channel !== null && !['curious','telegram','plugin'].includes(r.channel))
        || (data.status !== 'conflict' && data.status !== r.decision)
        || (data.status === 'conflict' && r.decision === input.decision)) {
      throw Error('invalid canonical receipt');
    }
    return {...data, canonicalReadback:true};
  }
  async function readStatus(input) {
    return validatedOutcome(await call('/v1/founder/status', input), input);
  }
  async function status(digest) {
    const p = await proposal(digest);
    return readStatus(tuple(p, 'approved', ''));
  }
  async function decide(digest, decision, expected) {
    if (!['approve','reject'].includes(decision)) throw Error('invalid decision');
    const p = await proposal(digest);
    const text = decision === 'approve' ? p.approveConfirmation : p.rejectConfirmation;
    if (p.version !== expected?.version || p.expiresAt !== expected.expiry || expected.confirmation !== text) {
      throw Error('proposal changed or exact informed confirmation missing');
    }
    if (Date.parse(p.expiresAt) <= now()) throw Error('proposal expired');
    const input = tuple(p, decision === 'approve' ? 'approved':'rejected', text);
    try {
      const result = validatedOutcome(await call('/v1/founder/decision', input), input);
      if (result.status === 'pending') throw Error('decision unconfirmed');
      return result;
    } catch {
      // Read the original tuple once. A changed proposal cannot redirect recovery.
      try {
        const observed = await readStatus(input);
        if (['approved','rejected','conflict'].includes(observed.status)) return observed;
        return {status:'unknown', retry:'status_only', observed};
      } catch { return {status:'unknown', retry:'status_only'}; }
    }
  }
  return {proposal,status,decide};
}
export async function main(argv=process.argv.slice(2),env=process.env) {
  if (argv[0]==='--help' || !argv.length) {
    console.log('founder-gate read|approve|reject|status DIGEST [--version N --expiry ISO --confirm EXACT_TEXT]\nSet CAMBIUM_ORIGIN, CAMBIUM_TENANT and CAMBIUM_ACCESS_JWT from an existing founder session. read prints one reviewed proposal and exact confirmation text. --version uses proposal.version and --expiry uses proposal.expiresAt. Never pass credentials as arguments. Unknown decisions use canonical status readback and are not retried.'); return;
  }
  const [command,digest,...rest]=argv;
  if (!['read','approve','reject','status'].includes(command) || !/^(?:sha256:)?[a-f0-9]{64}$/.test(digest??'')) throw Error('invalid command or digest');
  const flags={};for(let i=0;i<rest.length;i+=2){if(!['--version','--expiry','--confirm'].includes(rest[i]) || rest[i+1]===undefined)throw Error('invalid option');flags[rest[i]]=rest[i+1];}
  const client=createFounderClient({origin:env.CAMBIUM_ORIGIN??'https://curious.thoughtseed.space',tenant:env.CAMBIUM_TENANT??'thoughtseed',accessJwt:env.CAMBIUM_ACCESS_JWT});
  let result;
  if(command==='read')result=await client.proposal(digest);
  else if(command==='status')result=await client.status(digest);
  else result=await client.decide(digest,command,{version:Number(flags['--version']),expiry:flags['--expiry'],confirmation:flags['--confirm']});
  console.log(JSON.stringify(result,null,2));if(result.status==='unknown')process.exitCode=2;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Founder Gate command failed; no credentials or remote error body printed. Check the authenticated founder session and exact proposal.');process.exitCode=1;});
