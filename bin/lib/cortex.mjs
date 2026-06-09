// Cambium — the unified cortex client (I3). ONE interface to the shared aesthetic-memory NIM Worker:
//   embed / search (1024-dim NIM)  ·  variable-contract read/write  ·  the why-handler deviation ledger.
//
// The transport is INJECTED. Today a working LOCAL transport (the deviation jsonl + a local
// variable-contract store). The real Cloudflare Worker — unifying taste-nim + DESIGN_MEMORY_WORKER —
// swaps in as a transport with ZERO call-site changes. That is the whole point of I3: one interface,
// one shared memory, so the why-handler's learning + the variable contracts are shared across organs.

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** The cortex client — a thin façade over an injected transport. */
export function makeCortex(transport) {
  return {
    embed: (text) => transport.embed(text),
    search: (vec, k = 5) => transport.search(vec, k),
    readContract: (brand, group) => transport.readContract(brand, group),
    writeContract: (brand, group, data) => transport.writeContract(brand, group, data),
    writeDeviation: (record) => transport.writeDeviation(record),
  };
}

/**
 * The LOCAL transport (today): the deviation ledger (jsonl) + a local variable-contract store (fs).
 * embed / search need the NIM — they throw until I3's Cloudflare Worker provides them. fs is injectable.
 */
export function localTransport({ root, fs = { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } }) {
  const contractDir = join(root, 'cortex', 'contracts');
  const contractPath = (brand, group) => join(contractDir, `${brand}.${group}.json`);
  const needsWorker = (op) => () => {
    throw new Error(`cortex.${op}: needs the NIM Worker transport (I3 follow-up — taste-nim)`);
  };
  return {
    embed: needsWorker('embed'),
    search: needsWorker('search'),
    writeContract: (brand, group, data) => {
      fs.mkdirSync(contractDir, { recursive: true });
      fs.writeFileSync(contractPath(brand, group), JSON.stringify(data));
    },
    readContract: (brand, group) => {
      const p = contractPath(brand, group);
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    },
    writeDeviation: (line) => {
      // `line` is the recordDeviation() jsonl string — whyhandler serializes, the cortex persists
      fs.appendFileSync(join(root, 'deviations.jsonl'), line + '\n');
    },
  };
}

/** Convenience: the default cortex (local transport) rooted at the cambium repo. */
export function defaultCortex(root) {
  return makeCortex(localTransport({ root }));
}
