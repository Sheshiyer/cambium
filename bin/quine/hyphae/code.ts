// Quine hypha · code — structural memory of code we ship, via the CodeGraph index (symbols/call-graph).
// Read-only: codegraph is generated, not authored. Fail-closed if the project has no .codegraph index.

import type { Hypha } from '../types.ts';
import { flag, positional } from '../types.ts';
import { codegraphRecall, cliCodegraphClient } from '../../operator/codegraph-recall.ts';

export const code: Hypha = {
  name: 'code',
  describe: 'structural code memory — CodeGraph symbols/call-graph of what we ship',
  help: 'quine read code "<query>" [--project <path>] [--k 8]',

  async status(ctx) {
    const ok = await cliCodegraphClient().ready(ctx.root);
    return { name: 'code', reachable: ok, detail: ok ? 'codegraph index reachable' : 'no .codegraph index (run: codegraph index)' };
  },

  async read(args, ctx) {
    const query = positional(args);
    const project = flag(args, '--project', ctx.root);
    const k = Number(flag(args, '--k', '8'));
    const recall = await codegraphRecall(cliCodegraphClient({ limit: k }), query, project, k);
    return { hypha: 'code', ...recall };
  },
};
