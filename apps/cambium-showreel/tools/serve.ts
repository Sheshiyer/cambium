// Local server: the reel page, read-in-place assets, fonts, and the frame sink.
// Nothing is copied — visual-flow assets and GLBs are served from where they live.
import { existsSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';

const APP = resolve(import.meta.dir, '..');
const REPO = resolve(APP, '../..');

const ROOTS: Record<string, string> = {
  '/assets/': join(REPO, 'docs/assets/visual-flow'),
  '/meshy/': join(REPO, 'apps/cambium-r3f/public/assets/meshy'),
  '/mattes/': join(APP, 'out/mattes'),
  '/dist/': join(APP, 'dist'),
};

const DISPLAY_FONT_CANDIDATES = [
  process.env.REEL_DISPLAY_FONT,
  '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf',
  '/Library/Fonts/DIN Condensed Bold.ttf',
].filter(Boolean) as string[];

const MONO = join(APP, 'node_modules/@fontsource/jetbrains-mono/files');

function fontPath(name: string): string | null {
  if (name === 'display.ttf') return DISPLAY_FONT_CANDIDATES.find((p) => existsSync(p)) ?? null;
  const m = name.match(/^mono-(\d{3})\.woff2$/);
  if (m) return join(MONO, `jetbrains-mono-latin-${m[1]}-normal.woff2`);
  return null;
}

function safeJoin(root: string, rel: string) {
  const p = normalize(join(root, decodeURIComponent(rel)));
  return p.startsWith(root) ? p : null;
}

export interface SinkHandlers {
  onFrame?: (f: number, data: Uint8Array) => Promise<void> | void;
  onDone?: () => void;
  onError?: (msg: string) => void;
  onLog?: (msg: string) => void;
  /** frame list for render mode (too long for a URL on full-length cuts) */
  frames?: number[];
}

export function startServer(h: SinkHandlers = {}, port = 0) {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    maxRequestBodySize: 64 * 1024 * 1024,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      if (req.method === 'POST') {
        if (path === '/frame') {
          const f = Number(url.searchParams.get('f'));
          const data = new Uint8Array(await req.arrayBuffer());
          await h.onFrame?.(f, data);
          return new Response('ok');
        }
        const body = await req.text();
        if (path === '/done') h.onDone?.();
        else if (path === '/error') h.onError?.(body);
        else if (path === '/log') h.onLog?.(body);
        return new Response('ok');
      }
      if (path === '/' || path === '/index.html') return new Response(Bun.file(join(APP, 'index.html')));
      if (path === '/frames') return Response.json(h.frames ?? []);
      if (path.startsWith('/fonts/')) {
        const p = fontPath(path.slice(7));
        if (p && existsSync(p)) return new Response(Bun.file(p));
        return new Response('font missing', { status: 404 });
      }
      for (const [prefix, root] of Object.entries(ROOTS)) {
        if (path.startsWith(prefix)) {
          const p = safeJoin(root, path.slice(prefix.length));
          if (p && existsSync(p)) return new Response(Bun.file(p));
          return new Response('not found', { status: 404 });
        }
      }
      return new Response('not found', { status: 404 });
    },
  });
  return server;
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 4789);
  const s = startServer({ onLog: (m) => console.log('[page]', m), onError: (m) => console.error('[page error]', m) }, port);
  console.log(`showreel dev server: http://127.0.0.1:${s.port}/?dev`);
}
