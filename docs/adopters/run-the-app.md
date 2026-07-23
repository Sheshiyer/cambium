# Run the App — clean clone to working constellation in <5 minutes

Audience: founder, team member, or consultant setting up Cambium locally.
Prereqs: Node v26+ (`node --version`), npm. No other dependencies, no env vars, no credentials.

## 1. Boot the visual engine (browser)

```bash
npm install --prefix apps/cambium-r3f   # first time only
npm run r3f:dev                          # → http://127.0.0.1:5173/
```

You should see: the **MAP** — five organ glyph clusters (genesis star, taste capsule,
build triangle, ops slab, cortex wheel) in a ring around the cortex spiral, on a
dark topographic field, with the `MAP | SHEETS | WORKFORCE` pill top-center and the
route dock at the bottom.

## 2. Give it a tenant (optional, demo data)

```bash
npm run demo:tenant -- --tenant demo-org --force
npm run demo:quests -- --tenant demo-org
npm run tapestry:snapshot -- --tenant demo-org --out /tmp/demo-org.tapestry.json
```

The demo tenant writes ignored runtime state under `.operator/` — no private data,
no providers. To feed the app's map from a real snapshot, copy the snapshot to
`apps/cambium-r3f/public/tapestry.json` (the app falls back to a built-in fixture
when the file is absent).

## 3. Run the Electron desktop app

The maintained acceptance target is the macOS/laptop shell. The one-command development path starts
Vite and opens the same renderer in Electron:

```bash
npm ci --prefix apps/cambium-r3f
npm run desktop:dev
```

For a local macOS application bundle:

```bash
npm run desktop:dist:mac:dir
# → apps/cambium-r3f/release/mac-arm64/Cambium.app on Apple Silicon
```

The packaged app is local-first and works without a Worker URL. Worker connectivity remains an explicit
in-app setting; no Worker credentials or Meshy keys are bundled. The local shell uses a secure custom
protocol, isolates the renderer, blocks new windows/permissions, and keeps hash routes and localStorage.

## 4. Use it

| Want | Where |
|---|---|
| See the whole venture | **MAP** mode — click any hub to zoom to its island |
| Read detail | **SHEETS** mode — 21 subsections grouped by system; click one to open its sheet (Esc closes) |
| Team/consultant sharing | **WORKFORCE** mode — local founder or invite identity, role ceiling, and principal context; a remote principal directory remains a later C4b surface |
| Change behavior | **settings** (top bar) — reduced motion and default camera apply live and persist; tenant + worker URL wire in C4 |
| Learn the app | **guide** (top bar) — cycles boot, modes, map-reading, settings, docs |
| Dev/milestone screens | append `?dev=1` — design-system board, settings bench, asset QA |

## 5. Verify the install

```bash
npm test            # full suite: operator, worker, quine
npm run r3f:test    # visual engine tests
npm run r3f:build   # typecheck + production build
npm run desktop:test # Electron shell, assets, and packaging contract
```

## Troubleshooting

- **Blank canvas / tsconfig overlay**: restart the dev server (it must start after
  the repo-root `tsconfig.json` exists).
- **Map shows fixture, not your tenant**: `public/tapestry.json` missing or invalid —
  check the browser console for the loader fallback note.
- **Old milestone screens visible**: you have `?dev=1` in the URL — remove it.
- **Electron shows a blank scene**: confirm the window is at least 1280×800 and that the machine supports WebGL; headless screenshot environments may need SwiftShader and are not equivalent to founder-device visual review.
- **macOS blocks the app**: unsigned local builds can trigger quarantine warnings. Distribution requires Developer ID signing and notarization; the repository workflow proves the artifact path without auto-update or release credential assumptions.
