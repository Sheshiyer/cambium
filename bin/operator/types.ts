// Cambium — the infinite-game operator · shared types.
// Contract: ../../INFINITE-GAME.md   Onboarding: ../../ONBOARDING-OCTALYSIS.md
//
// Node v26 runs this .ts natively (type-stripping) — zero build, zero deps. Type
// syntax only (no enums/namespaces) so it stays erasable.

/** Octalysis core drives (1..8). The vertical axis (1,8) is the mid-brain → noesis. */
export type Drive = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** The three control lanes (the micro/meso/macro Venn). */
export type Lane = 'micro' | 'meso' | 'macro';

/** A routing class: a lane, the mid-brain bypass (→ noesis), or a heartbeat sweep. */
export type RouteClass = Lane | 'midbrain' | 'heartbeat';

export type EventKind =
  | 'calling'      // mid-brain (drive 1) — Epic Meaning
  | 'drift'        // mid-brain (drive 8) — Loss / leaving viability
  | 'tweak'        // micro — a reversible fine-tune
  | 'redirect'     // meso — a founder redirect (error-or-intent?)
  | 'objection'    // meso — an ICP objection surfaced
  | 'metric'       // meso — a real-world signal
  | 'reposition'   // macro — a proposed setpoint move
  | 'probe';       // a scheduled heartbeat (viability sweep)

/** One move in the infinite game — the unit the operator wakes on. */
export interface GameEvent {
  id: string;
  kind: EventKind;
  drives?: Drive[];          // Octalysis drives this fires (routes the mid-brain bypass)
  intent?: boolean;          // founder flagged it intentional (meso error-vs-intent)
  evidence?: boolean;        // real-player evidence present (gates every macro setpoint move)
  direction?: number[];      // a proposed setpoint step g (for reposition / meso-approved intent)
  artifact?: { id: string; text: string };  // payload for ingest / micro tweak
  note?: string;
}

/** The brand-DNA setpoint x* — here a low-dim stub; real = the 1024-dim NIM point. */
export interface BrandDNA {
  setpoint: number[];        // x*
  label: string;             // human positioning label
  trustRegion: number;       // α — max setpoint motion per wake (allostasis bound)
  coherence: number;         // 0..1 — mission-coherence proxy (a viability margin source)
}

/** The typed, event-sourced world-state. The embedding is one derived field, not the state. */
export interface WorldState {
  tenant: string;
  version: number;           // = number of events folded in (event sourcing)
  vision: string;            // the Just Cause — the near-invariant anchor
  mission: string;           // evolves allostatically
  goals: string[];           // current finite games
  brand: BrandDNA;
  artifacts: Record<string, string>;  // id → on-brand artifact text (micro targets)
  business: { runwayDays: number };    // fuels the solvency viability bound
  log: string[];             // short human audit trail (the replay log is external)
}

export interface Margin { name: string; value: number; warn: boolean; }   // value ≥ 0 = inside the bound; warn = close to it
export interface ViabilityReport { margins: Margin[]; ok: boolean; warnings: string[]; }

export interface IcpReading {
  simulated: true;
  source: 'llm' | 'stub';        // llm = a real model answered; stub = the offline deterministic fallback
  via?: string;                  // provider:model when source === 'llm' (e.g. nvidia-nim:meta/llama-3.1-70b-instruct)
  pains: string[];
  direction: number[];           // a step g in brand-space (stub vector until the NIM wires in)
  directionLabel?: string;       // the model's words for the direction (real even when the vector is stubbed)
  resonance: number;             // 0..1
}
export interface FounderReading { simulated: true; intentBit: 'error' | 'intent'; confidence: number; }

export interface Routing {
  class: RouteClass;
  lane: Lane | null;         // null for the mid-brain bypass
  noesis: boolean;           // mid-brain → invoke noesis
  gated: boolean;            // macro + mid-brain are gated
  why: string;
}

export interface GateVerdict { allowed: boolean; reason: string; }

/** The decision produced by one wake — what the operator did and why (the audit unit). */
export interface Decision {
  event: string;
  routing: Routing;
  action: string;
  setpointMoved: boolean;
  noesis: boolean;
  gate?: GateVerdict;
  npc?: { icp?: IcpReading; founder?: FounderReading };
  viability: ViabilityReport;
  emergency: boolean;
}

/** Injected dependencies — keeps `wake` pure & testable (no disk, no spawn). */
export interface WakeDeps {
  record: (line: string) => void;                 // the ledger write (cortex.writeDeviation)
  icp?: (positioning: string) => IcpReading;
  founder?: (event: GameEvent) => FounderReading;
  alpha?: number;                                 // trust-region override
}
