/** Resolve a public asset for HTTP dev, preview, or the packaged Cambium protocol. */
export function localAssetUrl(assetPath: string): string {
  const normalized = assetPath.replace(/^\/+/, '');
  if (typeof document === 'undefined') return `/${normalized}`;
  return new URL(normalized, document.baseURI).toString();
}
