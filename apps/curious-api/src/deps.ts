export interface Deps {
  now(): Date;
  fetch: typeof fetch;
  randomBytes(size: number): Uint8Array;
  db?: import("./db.ts").CuriousDb;
}

export const defaultDeps: Deps = {
  now: () => new Date(),
  fetch: globalThis.fetch.bind(globalThis),
  randomBytes(size) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  },
};
