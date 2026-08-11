# Fitcheck loop pack v1

Schema: `cambium.fitcheck-loop-pack.v1`  
Implementation: [`shared/fitcheck-loop-pack.ts`](../../../shared/fitcheck-loop-pack.ts)  
Doctrine: [`loops-to-graphs.md`](../loops-to-graphs.md)

## Purpose

One **L4 loop** per Fitcheck golden-path stage, each with ISA-style probes (`FIT-ISC-*`).
Loops **evaluate and report**. They do **not** write the D1 Goal Graph.

## Stages

| Loop id | Stage | Held? |
|---|---|---|
| `fitcheck-loop-identified` | IDENTIFIED | no |
| `fitcheck-loop-systems-bound` | SYSTEMS BOUND | no |
| `fitcheck-loop-mapping-verified` | MAPPING VERIFIED | no (receipt readback proved) |
| `fitcheck-loop-planned` | PLANNED | no |
| `fitcheck-loop-d1-eligible` | D1 ELIGIBLE | yes (proposal only) |
| `fitcheck-loop-admitted` | ADMITTED | yes until CAS readback |
| `fitcheck-loop-pinned` | PINNED | yes until loadout pin |
| `fitcheck-loop-executed` | EXECUTED | yes until Hermes receipt |
| `fitcheck-loop-learned` | LEARNED | yes until foldback proposal |

## Usage

```ts
import { runFitcheckLoop, runAllFitcheckLoops } from '../../../shared/fitcheck-loop-pack.ts';

runFitcheckLoop('fitcheck-loop-admitted', { d1TaskReadback: true });
runAllFitcheckLoops();
```

## Authority

- Static truth: `shared/fitcheck-golden-path.ts`
- Live evidence flags are optional and fail-soft (`held` not `pass` when absent)
- Admission / pin / execute remain founder Gate + CAS / Hermes paths
