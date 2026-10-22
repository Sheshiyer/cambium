# System atlas portraits

These small WebP derivatives preserve the eleven canonical TSOC organ identities.
The full source PNGs and their review status remain in the Organ Console map.
`PORTRAITS.v1.json` binds each original hash, derivative hash, byte count, format
and canonical ID. Selection for derivation is reference status, not runtime proof.

The pocket atlas bundles these images because the existing Worker has no static
asset route. No external image request or new binding is required. The standalone
guide uses the same bundled module. The transformation fits256px without cropping.

```sh
node scripts/build-system-atlas-portraits.mjs --check
# Rebuild only with cwebp available, then review changed derivative hashes:
node scripts/build-system-atlas-portraits.mjs --write
```

Original images, duplicate lineage and unresolved previews remain unchanged.
This derivative package adds no license grant, live state or founder approval.
