export function getStorybookAssetPrefix(): string {
  if (typeof window === 'undefined') return '';
  const win = window as Window & { __RITO_ASSET_PREFIX__?: string };
  return win.__RITO_ASSET_PREFIX__ ?? '';
}

export function applyStorybookAssetPrefix(src: string): string {
  const prefix = getStorybookAssetPrefix();
  if (!prefix || !src.startsWith('/')) return src;
  if (src.startsWith(`${prefix}/`)) return src;
  return /^\/(audio|gifs|images)(\/|$)/.test(src) ? `${prefix}${src}` : src;
}
