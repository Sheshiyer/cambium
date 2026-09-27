# Auspex — Expose substrate health and bounded recovery evidence.

Family: Temperance. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Auspex reads signs in the event, notification and routing substrate. It separates reachability, degradation and repeated failure so the operator can respond. Its health assessment concerns infrastructure seams; it cannot certify a business outcome.

## Inputs
Declared health probes, provider evidence, failure classifications and bounded recent heal/incident evidence.

## Outputs
Heal reports, degradation/recovery signals and escalation after defined failures.

## Infrastructure connection
The installed contract describes probes and bounded recovery through owned helpers. This explainer does not invoke those probes or recoveries or claim they are enabled.

## Decision and failure boundary
No indefinite retry loops, direct provider-store mutation, automatic provider promotion or application-success claim. Any current containment/activation hold remains in force.

## A concrete teaching example
Illustrative scenario: A model gateway answers health but a provider request lacks a receipt. Show gateway reachability and unverified provider execution as separate states.

## Neighbours and handoffs
Consumes relevant Nutrix failure signals; produces reports for Circulator and the human operator.

## How to read the visual
The accompanying auspex-concept-reference.png is the exact existing Auspex concept study, canonical asset TSOC-ORG-AUSPEX-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Auspex receives, what it emits, who uses the result and which decision it cannot make. A green infrastructure light is not a successful artifact, an active execution fleet or permission to change the provider.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: cambium-telegram-showcase/src/data/atlas.ts; Temperance installed agent specification Auspex.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.
