// Explicit source-only pinning. Reads public Git blobs; executes no wiki code.
import fs from'node:fs';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{CLAIM_SOURCE,CLAIM_POLICY,inventoryClaimSource,claimDigest}from'../shared/iverif-claim-proof.ts';
const [mode,repo]=process.argv.slice(2);if(!['--check','--write'].includes(mode)||!repo)throw new Error('usage: node scripts/pin-iverif-claim-source.mjs --check|--write PINNED_WIKI_CLONE');
const commit='1cc03e62fbfb32ba21c98ba81ac5a6883d676d2a',git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:2*1024*1024});
if(!/^https:\/\/github.com\/Sheshiyer\/iverif-wiki(?:\.git)?$/.test(git('remote','get-url','origin').toString().trim())||git('rev-parse','HEAD').toString().trim()!==commit)throw new Error('wrong_source_snapshot');
const paths=git('ls-tree','-r','--name-only','-z',commit).toString().split('\0').filter(path=>path==='README.md'||/^src\/.*\.(?:mdx?|json|astro)$/.test(path)||path==='src/i18n.ts'||/^public\/notebooklm\/.*\.(?:md|json)$/.test(path)).sort();
const manifest={schema:'cambium.iverif.claim-source-manifest.v1',repository:'Sheshiyer/iverif-wiki',commit,
 coverage:{includes:['README','public NotebookLM text','all src Markdown/JSON/Astro','localized src/i18n.ts copy'],excludes:['binary assets','CSS and executable example bodies','non-source provider or private evidence'],inventory:'conservative line-linked candidates; semantic completeness requires founder review'},
 files:paths.map(path=>{const bytes=git('show',commit+':'+path),rows=inventoryClaimSource(path,new TextDecoder('utf8',{fatal:true}).decode(bytes));return{path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,inventoryDigest:claimDigest(rows),inventoryCount:rows.length};})};
if(manifest.files.reduce((n,f)=>n+f.bytes,0)>CLAIM_POLICY.maxSourceBytes||manifest.files.reduce((n,f)=>n+f.inventoryCount,0)>CLAIM_POLICY.maxClaims)throw new Error('corpus_exceeds_reviewed_limits');
const target='docs/project-management/iverif-claim-proof-source.v1.json',text=JSON.stringify(manifest,null,2)+'\n';
if(mode==='--write')fs.writeFileSync(target,text);else if(fs.readFileSync(target,'utf8')!==text)throw new Error('manifest_drift');
console.log(JSON.stringify({mode,files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),claims:manifest.files.reduce((n,f)=>n+f.inventoryCount,0),sourceDigest:claimDigest(manifest)}));
