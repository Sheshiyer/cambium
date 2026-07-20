# Marketing Create Activation ISC Traceability

This map binds every criterion in the activation ISA to redacted evidence. JSON pointers refer to `2026-07-20-marketing-create-secret-activation.json`; operational-code pointers refer to the reviewed PR 261 branch. No credential value is represented here.

| Criterion | Evidence pointer | Result |
|---|---|---|
| ISC-1 | `source`; PR 261; clean activation branch | PASS |
| ISC-2 | `source`; PR 261; clean activation branch | PASS |
| ISC-3 | `source`; PR 261; clean activation branch | PASS |
| ISC-4 | `source`; PR 261; clean activation branch | PASS |
| ISC-5 | `preflight.accountId`; live Wrangler authentication probe | PASS |
| ISC-6 | `preflight.worker`; Wrangler configuration identity probe | PASS |
| ISC-7 | `preflight.productionVersion`; live deployment probe | PASS |
| ISC-8 | `preflight.latestVersion`; numerically sorted live Version list | PASS |
| ISC-9 | `preflight.scriptETag`; live candidate Version view | PASS |
| ISC-10 | `preflight.baselineBindingDigest`; normalized full binding objects | PASS |
| ISC-11 | `preflight.providerBindingPresent`; candidate Version view | PASS |
| ISC-12 | `preflight.activationBindingPresent`; candidate Version view | PASS |
| ISC-13 | `preflight.marketingRenderRows`; remote D1 preflight | PASS |
| ISC-14 | `preflight.marketingApprovalRows`; remote D1 preflight | PASS |
| ISC-15 | `preflight.workersDevHealthStatus`; live HTTPS probe | PASS |
| ISC-16 | `preflight.customDomainHealthStatus`; live HTTPS probe | PASS |
| ISC-17 | `preflight.unauthenticatedPrepareStatus`; unauthenticated HTTPS probe | PASS |
| ISC-18 | `preflight.secretValuesObserved`; `redactionCheck` | PASS |
| ISC-19 | `preflight.providerEndpointCalled`; bounded preflight script audit | PASS |
| ISC-20 | `staging`; `versionLineage.providerSecretStage` | PASS |
| ISC-21 | `staging`; `versionLineage.providerSecretStage` | PASS |
| ISC-22 | `staging`; `versionLineage.providerSecretStage` | PASS |
| ISC-23 | `staging`; `versionLineage.providerSecretStage` | PASS |
| ISC-24 | `versionLineage.providerSecretStage.latestImmediatelyAfter`; live sorted Version list | PASS |
| ISC-25 | `versionLineage.providerSecretStage.scriptETag`; live Version 61 view | PASS |
| ISC-26 | `versionLineage.providerSecretStage.baselineRemainderDigest`; `versionLineage.providerSecretStage.secretBindings` | PASS |
| ISC-27 | `versionLineage.providerSecretStage.activationBindingPresent` | PASS |
| ISC-28 | `staging.repositoryFilesWritten`; clean-diff staging probe | PASS |
| ISC-29 | `versionLineage.providerSecretStage.trafficPercentDuringStaging` | PASS |
| ISC-30 | `versionLineage.providerSecretStage.latestImmediatelyAfter`; immediate pre-prompt guard | PASS |
| ISC-31 | `staging.activationCommand` | PASS |
| ISC-32 | `staging.activationInputChannel` | PASS |
| ISC-33 | `versionLineage.activationSecretStage.id`; `staging.versionUuidProvenance` | PASS |
| ISC-34 | `staging.productionStayedOnCandidateUntilExplicitDeploy` | PASS |
| ISC-35 | `versionLineage.activationSecretStage.latestImmediatelyAfter`; live sorted Version list | PASS |
| ISC-36 | `versionLineage.activationSecretStage.scriptETag`; live Version 62 view | PASS |
| ISC-37 | `versionLineage.activationSecretStage.baselineRemainderDigest`; `versionLineage.activationSecretStage.secretBindings` | PASS |
| ISC-38 | `versionLineage.activationSecretStage.secretBindings`; provider entry | PASS |
| ISC-39 | `versionLineage.activationSecretStage.secretBindings`; activation entry | PASS |
| ISC-40 | `staging.repositoryFilesWritten`; clean-diff staging probe | PASS |
| ISC-41 | `versionLineage.activationSecretStage.trafficPercentDuringStaging` | PASS |
| ISC-42 | `deployment`; live control-plane and health probes | PASS |
| ISC-43 | `deployment`; live control-plane and health probes | PASS |
| ISC-44 | `deployment`; live control-plane and health probes | PASS |
| ISC-45 | `deployment.message`; live control-plane probe | PASS |
| ISC-46 | `deployment`; live control-plane and health probes | PASS |
| ISC-47 | `deployment`; live control-plane and health probes | PASS |
| ISC-48 | `versionLineage.activationSecretStage.secretBindings`; live Version 62 view | PASS |
| ISC-49 | `versionLineage.activationSecretStage.secretBindings`; live Version 62 view | PASS |
| ISC-50 | `deployment.secretValuesObserved`; `redactionCheck` | PASS |
| ISC-51 | `prepareProof.inputClassification`; `prepareProof.factCount`; bounded helper request body | PASS |
| ISC-52 | `prepareProof.requestedTtlSeconds`; `prepareProof.expiresAt` | PASS |
| ISC-53 | `prepareProof.firstPrepare`; `prepareProof.replayPrepare` | PASS |
| ISC-54 | `prepareProof.firstPrepare`; `prepareProof.replayPrepare` | PASS |
| ISC-55 | `prepareProof.firstPrepare`; `prepareProof.replayPrepare` | PASS |
| ISC-56 | `d1Witness`; `prepareProof.idempotencyEvidence` | PASS |
| ISC-57 | `d1Witness`; `prepareProof.idempotencyEvidence` | PASS |
| ISC-58 | `d1Witness`; `prepareProof.idempotencyEvidence` | PASS |
| ISC-59 | `d1Witness`; `prepareProof.idempotencyEvidence` | PASS |
| ISC-60 | `d1Witness`; `prepareProof.idempotencyEvidence` | PASS |
| ISC-61 | `d1Witness`; `prepareProof.idempotencyEvidence` | PASS |
| ISC-62 | `authorityBoundaries`; `redactionCheck` | PASS |
| ISC-63 | `authorityBoundaries`; `redactionCheck` | PASS |
| ISC-64 | `authorityBoundaries`; `redactionCheck`; `releaseGates.standaloneAudit`; reviewed-origin credential guard | PASS |
| ISC-65 | `deployment.rollbackTargetVersionId`; activation runbook rollback acceptance | PASS |
| ISC-66 | `deployment.rollbackTargetVersionId`; activation runbook rollback acceptance | PASS |
| ISC-67 | `deployment.rollbackTargetVersionId`; digest-pinned two-surface rollback probes | PASS |
| ISC-68 | `staging.versionCounts.preStaging`; private staging receipt | PASS |
| ISC-69 | `staging.versionUuidProvenance`; `versionLineage` | PASS |
| ISC-70 | `staging.versionUuidProvenance`; `versionLineage` | PASS |
| ISC-71 | `staging.versionUuidProvenance`; `versionLineage` | PASS |
| ISC-72 | `d1Witness.disposition`; `d1Witness.invokedAt`; `d1Witness.providerUsageTokens`; `d1Witness.claimId`; `d1Witness.terminalAt` | PASS |
| ISC-73 | `staging.latestVersionGuardBeforeEachPut` | PASS |
| ISC-74 | `staging.productionStayedOnCandidateUntilExplicitDeploy` | PASS |
| ISC-75 | numeric ordering guard in `stage-marketing-create-secrets.sh`; Versions 60–62 | PASS |
| ISC-76 | `d1Witness.providerUsageTokens`; remote D1 SELECT provenance | PASS |
| ISC-77 | `d1Witness.terminalAt`; remote D1 SELECT provenance | PASS |
| ISC-78 | `d1Witness.approvalDecisionId`; `d1Witness.claimId`; `d1Witness.claimedAt`; `d1Witness.leaseExpiresAt`; remote D1 SELECT provenance | PASS |
