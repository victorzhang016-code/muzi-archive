export function isRemoteUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

export function isLegacyDataUrl(value?: string | null): boolean {
  return !!value && value.startsWith('data:');
}

export function resolveMediaUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (isLegacyDataUrl(value) || isRemoteUrl(value) || value.startsWith('/')) return value;
  return `/api/media/${encodeURIComponent(value)}`;
}

export function buildPublicItemMediaUrl(userId: string, itemId: string): string {
  return buildPublicItemMediaUrlWithVersion(userId, itemId);
}

export function buildPublicBestMatchMediaUrl(userId: string, matchId: string): string {
  return buildPublicBestMatchMediaUrlWithVersion(userId, matchId);
}

export function buildPublicItemMediaUrlWithVersion(userId: string, itemId: string, version?: string | number): string {
  const base = `/api/img/${encodeURIComponent(userId)}/${encodeURIComponent(itemId)}`;
  return version == null ? base : `${base}?v=${encodeURIComponent(String(version))}`;
}

export function buildPublicBestMatchMediaUrlWithVersion(
  userId: string,
  matchId: string,
  version?: string | number
): string {
  const base = `/api/img/${encodeURIComponent(userId)}/${encodeURIComponent(matchId)}?c=match`;
  return version == null ? base : `${base}&v=${encodeURIComponent(String(version))}`;
}
