// Cambium operator · the CodeGraph code-recall lane (M2 / B6, issue #24).
// A SEPARATE memory lane from the semantic cortex (B1–B5): the operator's STRUCTURAL memory of code
// it ships. Queries a venture's CodeGraph (symbols/edges) by projectPath. The CodegraphClient is
// INJECTED — a deterministic stub (tests/offline) or the live `cliCodegraphClient` (shells out to the
// local `codegraph` CLI — offline, no network/MCP). Fail-closed if the venture has no .codegraph index.
//
// This is structural recall (AST), NOT the semantic cosine cortex — codegraph can't do vector kNN,
// and the cortex can't do call-graph traversal. Two lanes, one operator.

import { execFile } from 'node:child_process';

export interface CodeNeighbor {
  name: string;
  kind: string;            // function · class · method · interface · …
  file?: string;
  relation: string;        // how it relates to the query (match · calls · called-by · impacts · …)
}

export interface CodegraphClient {
  ready(projectPath: string): boolean | Promise<boolean>;                                  // is .codegraph present?
  context(query: string, projectPath: string): CodeNeighbor[] | Promise<CodeNeighbor[]>;   // structural neighbors
}

export interface CodeRecall {
  query: string;
  projectPath: string;
  count: number;
  neighbors: CodeNeighbor[];
  note: string;
}

/** Recall structural neighbors of `query` from a venture's CodeGraph. Fail-closed if no index. */
export async function codegraphRecall(
  client: CodegraphClient, query: string, projectPath: string, k = 5,
): Promise<CodeRecall> {
  if (!(await client.ready(projectPath))) {
    throw new Error(`codegraphRecall: no .codegraph index for "${projectPath}" — fail-closed (run: codegraph init -i && codegraph index)`);
  }
  const neighbors = (await client.context(query, projectPath)).slice(0, k);
  return {
    query,
    projectPath,
    count: neighbors.length,
    neighbors,
    note: neighbors.length
      ? `code-recall: ${neighbors.length} structural neighbor${neighbors.length > 1 ? 's' : ''} → ${neighbors[0].kind} ${neighbors[0].name}`
      : 'code-recall: no structural neighbors',
  };
}

/** A deterministic stub client (offline + tests). Seed it with a query→neighbors map. */
export function stubCodegraphClient(graph: Record<string, CodeNeighbor[]> = {}): CodegraphClient {
  return { ready: () => true, context: (query) => graph[query] ?? [] };
}

type ExecResult = { ok: boolean; stdout: string };
type Exec = (args: string[]) => Promise<ExecResult>;

function defaultExec(args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile('codegraph', args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => resolve({ ok: !err, stdout: stdout ?? '' }));
  });
}

function normalize(r: any): CodeNeighbor {
  const n = r?.node ?? r;            // `codegraph query --json` wraps each hit as { node, score }
  return {
    name: String(n?.name ?? n?.symbol ?? n?.title ?? '?'),
    kind: String(n?.kind ?? n?.type ?? 'symbol'),
    file: n?.filePath ?? n?.file ?? n?.path ?? n?.location?.file,
    relation: 'match',
  };
}

/** The live client — shells out to the local `codegraph` CLI (offline). `exec` is injectable for tests. */
export function cliCodegraphClient(opts: { exec?: Exec; limit?: number } = {}): CodegraphClient {
  const exec = opts.exec ?? defaultExec;
  const limit = opts.limit ?? 8;
  return {
    async ready(projectPath) {
      const { ok, stdout } = await exec(['status', projectPath, '--json']);
      if (!ok) return false;
      try { const s = JSON.parse(stdout); return s.initialized === true && Number(s.nodeCount ?? s.fileCount ?? 0) > 0; }
      catch { return false; }
    },
    async context(query, projectPath) {
      const { ok, stdout } = await exec(['query', query, '--path', projectPath, '--json', '--limit', String(limit)]);
      if (!ok) return [];
      let parsed: any;
      try { parsed = JSON.parse(stdout); } catch { return []; }
      const rows: any[] = Array.isArray(parsed) ? parsed : (parsed?.results ?? parsed?.symbols ?? parsed?.nodes ?? parsed?.matches ?? []);
      return rows.map(normalize);
    },
  };
}
