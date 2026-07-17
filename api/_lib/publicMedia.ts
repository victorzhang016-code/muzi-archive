function itemMediaUrl(publicId: string, itemId: string) {
  return `/api/img/${encodeURIComponent(publicId)}/${encodeURIComponent(itemId)}`;
}

function matchMediaUrl(publicId: string, matchId: string) {
  return `/api/img/${encodeURIComponent(publicId)}/${encodeURIComponent(matchId)}?c=match`;
}

export function rewritePublicItem(item: any, publicId: string) {
  if (!item || typeof item !== 'object' || !item.id || !item.imageUrl) return item;
  return { ...item, imageUrl: itemMediaUrl(publicId, String(item.id)) };
}

export function rewritePublicWardrobe(data: any, publicId: string) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    items: Array.isArray(data.items)
      ? data.items.map((item: any) => rewritePublicItem(item, publicId))
      : [],
    matches: Array.isArray(data.matches)
      ? data.matches.map((match: any) => rewritePublicMatch(match, publicId))
      : [],
  };
}

export function rewritePublicMatch(data: any, publicId: string) {
  if (!data || typeof data !== 'object') return data;
  const match = data.match && typeof data.match === 'object' && data.match.photoBase64
    ? { ...data.match, photoBase64: matchMediaUrl(publicId, String(data.match.id)) }
    : data.match;
  return {
    ...data,
    match,
    items: Array.isArray(data.items)
      ? data.items.map((item: any) => rewritePublicItem(item, publicId))
      : [],
  };
}
