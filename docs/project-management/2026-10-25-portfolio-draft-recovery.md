# Portfolio draft recovery — local follow-up to PR 405

Base: `3e334e85f511f8e6ce4d5828e3a3819b2923b1ee`, verified current main at start. Local proposal for independent review only. No new PR, push, deployment, live storage read/write, dispatch or Gate action. Space Blanket mapping remains unchanged pending the owner's BWSSB answer.

## Reproduced findings

- [r4372134895](https://github.com/Sheshiyer/cambium/pull/405#discussion_r4372134895): selecting then clearing the primary left a component planning flag set. The workspace serializer threw and prevented unrelated draft autosave.
- [r4372134899](https://github.com/Sheshiyer/cambium/pull/405#discussion_r4372134899): an earlier v4 Relovo draft stored unmatched disposition against unverified generated evidence. The reviewed identity overlay resolves that evidence, causing the prior valid draft to fail restore and display an empty paused workspace.

Both failures reproduced before changes using the current-main serializer/parser, with exact exception evidence retained outside the repository in the validation artifacts.

## Bounded fixes

- One draft-selection helper handles selection, clearing and re-selection. It recomputes component planning flags while preserving membership subsets and all identity/role/owner/lifecycle metadata. The serializer also normalizes stale stored flags. Invalid boolean types or changed metadata still fail existing validation.
- Only a recognized unmatched-to-resolved identity upgrade is migrated: previous generated evidence must be unverified with no immutable ID, the same qualified name must now resolve, and the saved planning authority must be null. This does not select an authority or mark reviews complete. Other disposition mismatches still fail.
- Membership fallback uses actual saved planning authority, never a repository candidate alone. Pending restored Relovo drafts remain blocked for intake until explicit review and selection.
- Before normalized old v4 reconciliation data can be replaced by the existing autosave effect, exact original stored text is preserved and read back under a unique recovery key in the existing local-draft namespace. A different existing backup is never overwritten. Normalized reloads do not create repeated backups merely because JSON key order differs.
- Backup failure keeps recovered plans visible but blocks autosave, preserving the original active draft bytes. Truly malformed packets retain the existing fail-closed restore behavior. No live browser storage was accessed in this task.

These are draft-only operations. Worker action validation, identity eligibility, catalog versions, historical receipt parsing and execution authority are unchanged. No new registry, planning authority, tenant or dispatcher is added.

## Verification and limits

- 195 tests pass, one pre-existing skip (196 total): all six reviewed projects through select/clear/save/reload/reselect; preserved unrelated plans and membership; legitimate Relovo recovery; no inferred planning/review approval; exact original backups; collision/quota failure; malformed data and metadata tampering refusal; existing action/route/catalog/v1-v2 receipt regressions.
- App TypeScript passes. Vite build, regenerated standalone bundle and Worker embed, and static artifact audit pass. Post-bundle route tests run separately.
- Focused Worker typecheck is compared with a separate disposable exact-base copy; its existing diagnostics are not repaired by this draft-only patch.
- Browser interaction and live reader/consumer execution remain unverified. Independent review is pending; source availability is not deployment.
