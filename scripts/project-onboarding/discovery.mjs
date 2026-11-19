export const STANDARDS = Object.freeze({
  spec: ['GitHub Spec Kit agentic development', 'https://github.github.com/spec-kit/reference/agentic-sdd.html'],
  roadmap: ['GitHub Projects roadmap layout', 'https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout'],
  wcag: ['W3C WCAG 2.2', 'https://www.w3.org/TR/WCAG22/'],
  nativeAccess: ['W3C guidance on mobile accessibility', 'https://www.w3.org/WAI/standards-guidelines/mobile/'],
  asvs: ['OWASP ASVS', 'https://asvs.owasp.org/'],
  masvs: ['OWASP MASVS', 'https://mas.owasp.org/MASVS/'],
  oauth: ['IETF OAuth 2.0 Security BCP (RFC 9700)', 'https://www.rfc-editor.org/info/rfc9700/'],
  api: ['OpenAPI Specification', 'https://spec.openapis.org/oas/latest.html'],
  ssdf: ['NIST SSDF 1.1', 'https://csrc.nist.gov/pubs/sp/800/218/final'],
  slo: ['Google SRE Workbook: Implementing SLOs', 'https://sre.google/workbook/implementing-slos/'],
  otel: ['OpenTelemetry specification', 'https://opentelemetry.io/docs/specs/otel/'],
  apple: ['Apple App Review Guidelines', 'https://developer.apple.com/app-store/review/guidelines/'],
  play: ['Google Play User Data policy', 'https://support.google.com/googleplay/android-developer/answer/10144311'],
})

// An unreviewed row is a proposal, never a finding about a particular client.
// The review overlay can replace the wording, recommendation and source anchors.
const bank = [
  ['Authority and scope', 'Who can approve scope, milestones, spending, release and final acceptance?', 'Name an approver and a deputy for each decision. Record where written approval belongs and who resolves differences.', 'Client profile, proposal/ISA and actual delegation.'],
  [null, 'Which contract, schedules and amendments are in effect, and which copies are still drafts?', 'Pin the executed revision and its attachments. Record superseded versions, proof of execution and any conflict separately; leave missing signature or baseline evidence open.', 'Contract register, original signed copy, dated change record.'],
  [null, 'Which work belongs to this engagement, and which is an adjacent product, pilot or optional add-on?', 'Map explicit inclusions, exclusions and dependencies to a WorkObject and a repository. Record additions only through the agreed change process.', 'Vault/Workbench mapping, scope clauses and release decision.', 'spec'],
  [null, 'Which client inputs could block a deadline, and what happens if they arrive late?', 'List each dependency, its owner, due date, fallback and effect on the milestone. Confirm dates before placing them on the published timeline.', 'Kickoff notes, dependency clauses and the current milestone plan.', 'roadmap'],
  [null, 'Who approves changes to scope, cost, dates, providers and acceptance criteria?', 'Use a written change request with the original baseline, impact, approver, conditions and links to the updated spec and plan.', 'Change register and governing agreement.', 'spec'],
  [null, 'What evidence is needed at review, handover and commercial sign-off?', 'Keep source, engineering result, deployment, observed runtime, human acceptance and commercial sign-off as different states, with an owner and receipt for each.', 'Acceptance clauses, ISA and release checklist.'],

  ['Product and experience', 'Which user and journey must the first release serve, and what real problem does it solve?', 'Choose one end-to-end journey and its failure or manual fallback. Tie the success measure to a specific user and release decision.', 'Product brief, journey evidence, constitution and feature spec.', 'spec'],
  [null, 'How will the client know the product changed the outcome they care about?', 'Give each outcome a baseline, target, population/window and owner. Collect the baseline first when no trustworthy number exists.', 'Current analytics, user interviews, spec success criteria.', 'spec'],
  [null, 'Which roles, locales and surfaces must have parity at launch?', 'Build a role × journey × language × surface matrix. Have a native speaker verify critical copy and state any accepted exceptions.', 'Market and language requirements, role matrix and scope.'],
  [null, 'Which accessibility target, assistive technology and devices do we need to test?', 'Propose WCAG 2.2 AA for the web and an explicit native accessibility matrix. Verify keyboard, screen reader, focus, text scaling and critical error recovery.', 'Client accessibility requirement, design system and manual results.', 'wcag', 'nativeAccess'],
  [null, 'Who owns the approved copy, brand assets, translations and rights?', 'Record rights and approvals at asset set or campaign level. Preview with placeholder assets when the live rights or consent are unresolved.', 'Brand pack, client review, rights register.'],
  [null, 'What is deliberately outside the first milestone, and what would move it in?', 'Maintain an exclusions list and a measurable change trigger. Keep each selected slice independently testable before expanding scope.', 'Roadmap, open issues and agreed acceptance matrix.', 'spec'],

  ['Architecture, access and data', 'Which repository and branch own planning, and which repos own each component?', 'Choose a current reviewed planning repository and immutable GitHub ID. Record repo roles, default branch, pinned commit, dependencies and an exact board binding.', 'GitHub, local workspace map, Workbench and vault.', 'roadmap'],
  [null, 'What is the source of truth for each API, state transition and data set?', 'Version the API contract and key state transitions. Choose an owner for each shared object and add consumer checks for compatibility and retry behavior.', 'Data model, API contracts, migrations and their consumers.', 'api'],
  [null, 'What identities and roles exist for customers, staff, owners, devices and services?', 'Extend an approved IdP before adding another one. Document session and role boundaries, separate staff privileges, and verify cross-account and cross-tenant denial.', 'Repo auth config and role matrix, client identity policy.', 'asvs', 'oauth'],
  [null, 'How should sign-in, recovery, revocation and privileged access work on web and mobile?', 'For OAuth public clients use authorization code with PKCE and controlled redirect URIs; keep secrets server-side. Verify sign-out, expired/revoked sessions and account recovery, and choose staff MFA with the owner.', 'IdP configuration by reference, device flow and acceptance matrix.', 'oauth', 'masvs'],
  [null, 'Which personal or sensitive data can be collected, where may it go and when must it be deleted?', 'Review controller/processor roles, purpose, region, access, retention and deletion before connecting real data. Test deletion, exports and log redaction with representative fixtures.', 'Data inventory, contract privacy terms and provider agreements.', 'asvs', 'apple', 'play'],
  [null, 'What happens when a provider, webhook or shared dependency fails?', 'Separate sandbox and live, use idempotency and limited retries with reconciliation, show a safe fallback, and give a named owner the cutover decision.', 'Provider capabilities, observable failure paths and recovery evidence.', 'api', 'asvs'],

  ['Delivery, infrastructure and mobile', 'Which environments and accounts are required, and who holds operational access?', 'Map dev, staging and prod to scoped accounts and approval owners. Track names or ownership references for secrets, with environment isolation and a recovery path.', 'Existing environment inventory, CI identities and provider ownership.', 'ssdf'],
  [null, 'Which reliability thresholds would make the release safe to operate?', 'Set user-facing availability or latency and recovery targets. Verify dashboards, a useful alert, backup restore and one rollback rehearsal.', 'Traffic shapes, health signals, agreed risk and incident ownership.', 'slo', 'otel'],
  [null, 'How will a clean checkout reproduce, test and release a candidate?', 'Pin the toolchain and lockfile; use existing repo checks and CI; record the exact commits, build profiles, artifact hashes and reviewer evidence.', 'README/CI workflows, release notes and artifact provenance.', 'ssdf'],
  [null, 'Which iOS and Android versions, devices and store accounts are in scope?', 'Use a minimum and reference device on each platform. Separate emulator, signed build, beta acceptance and store submission; pin account owners and app identifiers.', 'Native agreement, build config, store roles and device evidence.', 'apple', 'play'],
  [null, 'Which mobile behaviors need device testing and a fallback?', 'Exercise permissions, cold start and resume, poor connectivity, deep links, notifications and any critical media flows in the supported locales.', 'Mobile spec, dependency map and device acceptance sheet.', 'masvs', 'nativeAccess'],
  [null, 'Which verification evidence is required for cross-component changes?', 'Follow a named scenario across UI, API and data on the same source pins. Check accessibility, role boundaries, regression risk and independent review before changing release state.', 'Spec scenarios, ISA criteria and CI/QA evidence.', 'spec', 'ssdf', 'asvs'],

  ['Operations, measurement and continuity', 'Which analytics events will prove the outcome, and may we collect them?', 'Define actor, trigger, schema, deduplication key and allowed properties. Measure a complete funnel with one synthetic journey and document consent and retention first.', 'Event taxonomy, product measures and privacy decisions.', 'otel'],
  [null, 'Who owns the first live action, spend limits, rollback and the decision to stop?', 'Record the exact release or first-use evidence, accountable approver, cost ceiling, stop conditions and independently verified result.', 'Release runbook, provider budget and commercial or client authority.', 'slo', 'ssdf'],
  [null, 'Who owns incidents, security maintenance, accessibility regressions and support after handover?', 'Agree service hours, severity targets, escalation, dependency maintenance, data requests and who pays for ongoing operations.', 'Support agreement, incident history and handoff checklist.', 'slo', 'ssdf'],
  [null, 'Which work needs a durable pillar chat, and where does a cross-pillar decision land?', 'Keep one governor and one chat per genuinely active pillar. Give each a repo/pin, scope, interface owner, evidence requirement and a shared handoff pointer.', 'Current chat ownership, GSD wave, repo map and existing handoffs.'],
  [null, 'What should recurring review check, what can it advance, and when should it alert the owner?', 'Use one supported recurring review per governor to collect material drift and actionable blockers. A proposed next wave goes through its existing admission; choose cadence and stop conditions.', 'Automation surface, signed work contract, dashboard and owner decision.'],
  [null, 'What must survive before a child chat can be archived?', 'Keep the accepted result or explicit disposition, verification receipt, clean committed handover, and successor for any open work. Archive through the owning client; preserve the governor and active work.', 'Child handoff, worktree status, owner acceptance and pending runs.'],
]

export const QUESTIONS = Object.freeze(bank.map(([section, question, recommendation, inspect, ...standards], i) => ({
  id: `Q${String(i + 1).padStart(2, '0')}`, section, question, recommendation, inspect, standards,
})))

export const DEFAULT_PRIORITY = ['Q01', 'Q02', 'Q03', 'Q06', 'Q07', 'Q13', 'Q26']
