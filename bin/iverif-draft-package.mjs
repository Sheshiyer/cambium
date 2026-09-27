#!/usr/bin/env node
/**
 * Path A draft-only Phase 5/6 package writer for IVerif FR GTM.
 * Offline. Never POSTs to Explee. Never flips admitted.current.
 */
import { fileURLToPath } from 'node:url';
import {
  draftPackageUsage,
  parseDraftPackageArgs,
  writeIverifDraftPackage,
} from './lib/iverif-draft-package.mjs';

async function main(argv) {
  const args = parseDraftPackageArgs(argv);
  if (args.help) {
    console.log(draftPackageUsage());
    return 0;
  }
  if (!args.meristemRoot) {
    throw new Error(`missing required option: --meristem-root\n\n${draftPackageUsage()}`);
  }

  const result = writeIverifDraftPackage({
    meristemRoot: args.meristemRoot,
    brandDir: args.brandDir,
    marketLocale: args.market,
    outRoot: args.outRoot || undefined,
    cambiumRoot: args.cambiumRoot || undefined,
  });

  console.log(JSON.stringify({
    ok: true,
    schema: result.schema,
    outRoot: result.outRoot,
    source: result.source.source,
    fixture_fallback: result.source.fixtureFallback,
    note: result.source.note,
    market: result.market,
    admitted: result.admitted,
    mutation_enabled: result.mutation_enabled,
    do_not_post: result.do_not_post,
    project_id: result.project_id,
    campaign_id: result.campaign_id,
    taste_verdict: result.taste_verdict,
    run_id: result.run_id,
    written: result.written,
    network_calls: result.network_calls,
  }, null, 2));
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`fail-closed: ${error.message}`);
      process.exit(1);
    },
  );
}

export { main };
