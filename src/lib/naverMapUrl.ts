import { Place } from '@/types/itinerary';

function isValidHttpUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getNaverMapUrl(place?: Partial<Place> | null): string | null {
  if (!place) return null;

  // Priority 1: Official API link or naverPlaceUrl
  if (isValidHttpUrl(place.naverPlaceUrl)) {
    return place.naverPlaceUrl!.trim();
  }
  if (isValidHttpUrl(place.link)) {
    return place.link!.trim();
  }

  // Priority 2: naverMapUrl
  if (isValidHttpUrl(place.naverMapUrl)) {
    return place.naverMapUrl!.trim();
  }

  // Priority 3: Search fallback URL: https://map.naver.com/p/search/{query}
  const cleanTitle = (place.title || '').replace(/<[^>]*>?/gm, '').trim();
  const cleanRoadAddr = (place.roadAddress || '').replace(/<[^>]*>?/gm, '').trim();
  const cleanAddr = (place.address || '').replace(/<[^>]*>?/gm, '').trim();

  let query = '';
  if (cleanTitle && cleanRoadAddr) {
    query = `${cleanTitle} ${cleanRoadAddr}`;
  } else if (cleanTitle && cleanAddr) {
    query = `${cleanTitle} ${cleanAddr}`;
  } else if (cleanRoadAddr) {
    query = cleanRoadAddr;
  } else if (cleanAddr) {
    query = cleanAddr;
  } else if (cleanTitle) {
    query = cleanTitle;
  }

  if (!query) return null;

  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}
