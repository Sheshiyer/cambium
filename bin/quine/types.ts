// Quine Engine · the mycelial CLI — shared types.
//
// A *hypha* is one thread of the mycelium: a connector that reads (and sometimes writes) one
// subsystem we have. The registry in quine.ts wires the hyphae into one network — so a single
// command surface reaches across the cortex, the code graph, the operator, the vault, and GitHub.
// Node v26 native TS, zero-dep — consistent with the cambium operator it sits beside.

/** The running context handed to every hypha. */
export interface QuineCtx {
  root: string;        // the cambium repo root
  vaultRoot: string;   // the Obsidian knowledge vault root
}

export interface HyphaStatus {
  name: string;
  reachable: boolean;
  detail: string;
}

/** One thread of the mycelium — a connector to a subsystem. */
export interface Hypha {
  name: string;                                              // registry key (cortex, code, vault, …)
  describe: string;                                          // one line: what it connects to
  help: string;                                              // usage
  status(ctx: QuineCtx): Promise<HyphaStatus>;               // reachability / health
  read(args: string[], ctx: QuineCtx): Promise<unknown>;     // read from the subsystem
  write?(args: string[], ctx: QuineCtx): Promise<unknown>;   // write to it (optional — some are read-only)
}

/** Tiny arg helpers shared by the hyphae. */
export const flag = (args: string[], name: string, def = ''): string => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
export const positional = (args: string[]): string => args.find((a) => !a.startsWith('--')) ?? '';
