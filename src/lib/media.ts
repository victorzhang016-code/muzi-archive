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
  return `/api/img/${encodeURIComponent(userId)}/${encodeURIComponent(itemId)}`;
}

export function buildPublicBestMatchMediaUrl(userId: string, matchId: string): string {
  return `/api/img/${encodeURIComponent(userId)}/${encodeURIComponent(matchId)}?c=match`;
}
