# Cambium Electron shell

This directory contains the native boundary around the Vite-built R3F renderer.

- `main.cjs` owns the macOS-first `BrowserWindow`, secure `cambium://app/` protocol, navigation and permission policy.
- `preload.cjs` exposes only `window.cambiumDesktop.isDesktop` through `contextBridge`.
- `run-dev.mjs` starts Vite and Electron together for local development.
- `packaging.test.mjs` checks the shell contract and required renderer payload.

The packaged application contains only `main.cjs`, `preload.cjs`, `package.json`, and `dist/**`.
Development helpers and tests are intentionally excluded. The Worker remains an optional remote URL
configured by the user; credentials and provider environment files never enter the bundle.

Electron and electron-builder are owned by this package and pinned in its `package-lock.json`; the
repository root exposes wrapper scripts but does not duplicate desktop dependencies.
