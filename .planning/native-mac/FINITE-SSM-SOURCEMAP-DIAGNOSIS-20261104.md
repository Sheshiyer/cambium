# Stage1 source-map diagnosis and resolution for approval

The 111 source-path changes are expected Wrangler 4.156.1 upload normalization.
The returned map contains the same 111 pinned source files, names and mappings;
every returned byte can be reconstructed. The source-map hold remains active
pending approval of the specific attestation below. No live write was performed.

## Pinned evidence

Candidate `5a9c7565-08c6-4821-b955-e05c0352bacf` is immutable version 106 at 0% traffic.
At `2026-11-04T12:06:27.134274+00:00`, serving `e5bfbc64-45e3-4849-a974-33d7d8f4f491`/v105 remained at 100%.
Both deployment pointers were checked before and after the GET-only readback.
All 54 retained binding identities and values, both pilot values (56 total), module
bytes, runtime, named exports, operational settings, schedules and exposure match.
The latest-uploaded pointer remains the candidate. The content response ETag
matches the candidate's immutable metadata, and the version-specific module API
independently confirms the approved code SHA `bf6780959d3fa36a462f8dfcd910e914ab21ef8ab0435ddcbaa473c35ca98298`.

The [approved packet](FINITE-SSM-ROLLOUT-RECONCILED-20261104.json) and [held Stage1 receipt](FINITE-SSM-STAGE1-RECEIPT-20261104.json)
are preserved byte-for-byte. Their hashes are recorded in the companion JSON.
No runner/SSM command or Worker preview request was made.

## Why the paths and bytes differ

The actual upload used `no_bundle=true` and `upload_source_maps=true` with
Wrangler 4.156.1. Its no-bundle result has no bundler map metadata, so the upload
scans the module's trailing sourceMappingURL. The installed helper sets `file`
to the uploaded module name and removes leading parent segments from source
paths. For example, `../../../workers/quests/src/goal-graph/identity.ts` becomes
`workers/quests/src/goal-graph/identity.ts`. This behavior is explicit in the
[version-pinned upstream implementation](https://github.com/cloudflare/workers-sdk/blob/ca55031d783d1c062c9d2437f3be39addab235ec/packages/wrangler/src/deployment-bundle/source-maps.ts#L173-L225).

The installed CLI SHA is `47fe4b6ddacd2a5861bd5f6957217718a48b106f208b2dc21546bbee51a0cb8b`. The exact installed
helpers were evaluated offline with access only to the two approved build files;
the Wrangler CLI/upload entrypoint was never executed by that check. The helper
retains the absolute build-directory `sourceRoot` in this branch.

Cloudflare's returned JSON has a further representation change: fixed field
ordering, no `sourceRoot` field, a distinct `sourcesRoot:null` field, and escaping
of `<`, `>` and `&`. That escaping accounts for 92,960 extra bytes. The earlier
comparison used a null-default lookup and omitted the additional null-valued
`sourcesRoot` key; this diagnosis checks field presence and the complete key set.
There are no other fields or unexplained differences.

The returned representation was reconstructed from the approved map after the
Wrangler helper, then compared byte-for-byte with the freshly ETag-bound readback:

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Approved build map | 4170146 | `1af713f8a624f89d9bbb49d6d650c9f508c36bb9280c179343c30d556fac635a` |
| Reconstructed Wrangler upload map | 4164293 | `21396c7920512ac005cc8a63562e2b12d37b9609bfd0ba684ba5b7bafb695d75` |
| Reconstructed and observed returned map | 4257118 | `b9c1c3835c4b2e620cdacf532d57c7855b71bc285d925ea5dd068e3a262c0ae3` |

The net increase of 86,972 bytes is fully accounted for: -5,853 for Wrangler's
rewrite and compact JSON, -135 for the returned field shape, and +92,960 for escaping.
The upload multipart was not captured, and Cloudflare's internal implementation
was not inspected. The intermediate hash is a local prediction; the final hash
is both observed and exactly reconstructed. The boundary between server storage
normalization and readback serialization remains unknown. The unusual plural
`sourcesRoot` field is observed here, not claimed as a documented API guarantee.

## Verification and practical limit

All 111 source paths remain unique and resolve to the same files when rebased from
the local build directory to the repository root: 94 under `workers`, 15 under `shared`,
and 2 under `docs`. No returned path is absolute or contains parent traversal.
All 111 embedded contents equal the files in commit `c2bf7775296100214f98c4a503a8d29fcac9b1f5`.
Source indices and order, source-map version 3, the names table and mapping table
are unchanged. All 156,755 mapped segments decode with valid source/name indices
and original/generated coordinates. This establishes offline map equivalence;
Worker preview health and hosted exception symbolication were not invoked or
accepted. The runner was not contacted.

## Exact resolution proposed for approval

1. Accept this version-specific transformation attestation for the existing
   candidate `5a9c7565`; keep the original raw build-map hash and held Stage1
   receipt unchanged as historical evidence.
2. On approval, append a separate accepted-map attestation binding version 106,
   source `c2bf7775`, all three map hashes above, the immutable module hash and the
   ETag-bound readback. Clear only the source-map discrepancy hold in pickup.
   Do not turn the historical raw-byte comparison into a pass.
3. Retain exact, presence-sensitive checks for all fields, source contents,
   mappings and paths. This is an attestation for one immutable candidate;
   an additional difference or later owner drift stops further action.

Approval has **not** been granted. No reupload or runtime change is needed for
this resolution. Preview health remains unperformed, and every migration,
traffic, installation, founder decision, admission, launch, job and ISC-3683 through ISC-3687
gate remains held. Preserve the uploaded version and background runner.

Machine-readable evidence and exact approval scope: [FINITE-SSM-SOURCEMAP-DIAGNOSIS-20261104.json](FINITE-SSM-SOURCEMAP-DIAGNOSIS-20261104.json).
