// Runtime builtin subset used by the existing owner's private service entrypoint.
// Cloudflare supplies the implementation; this declares no local runtime fallback.
declare module 'cloudflare:workers' {
  export class WorkerEntrypoint<Env = unknown> {
    protected env: Env;
  }
}
