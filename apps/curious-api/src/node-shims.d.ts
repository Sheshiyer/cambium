declare module "node:fs/promises" {
  export function mkdir(target: string, options?: { recursive?: boolean }): Promise<void>;
  export function readFile(target: string, encoding: "utf8"): Promise<string>;
  export function writeFile(target: string, data: string, options?: { flag?: string }): Promise<void>;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
  export function dirname(target: string): string;
  const path: { join(...parts: string[]): string; dirname(target: string): string };
  export default path;
}
