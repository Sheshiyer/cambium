# TG Mini App viewport proof

`manifest.json` plus exactly the PNG files listed in `manifest.proofs` are the
canonical local browser proof. The manifest binds every capture to the exact
`PAGE` SHA-256.

```bash
npm run proof:tg-mobile-contract
npm run proof:tg-viewport
```

The mobile contract checks containment and real hit-tested interactions at 320,
390, and 430 pixels. Full capture regenerates the canonical manifest and PNGs.
Fixture JSON is served from production-shape source code and is not copied into
this directory. Browser diagnostics and failure receipts go to ignored
`.artifacts/tg-miniapp-viewport/`.

These screenshots prove local browser layout and interaction only. They do not
prove Telegram WebView chrome, safe areas, fresh `initData`, or founder-device
signed actions.
