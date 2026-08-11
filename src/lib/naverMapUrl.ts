import { Place } from '@/types/itinerary';

function stripHtml(text?: string): string {
  if (!text) return '';
  return text.replace(/<[^>]*>?/gm, '').trim();
}

export function isNaverMapUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'map.naver.com' ||
      host === 'm.map.naver.com' ||
      host === 'place.naver.com' ||
      host === 'm.place.naver.com'
    );
  } catch {
    return false;
  }
}

export function getNaverMapSearchUrl(place?: Partial<Place> | null): string | null {
  if (!place) return null;

  const cleanTitle = stripHtml(place.title);
  const cleanRoadAddr = stripHtml(place.roadAddress);
  const cleanAddr = stripHtml(place.address);

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

// Helper to sanitize and normalize place links for DB & components
export function normalizePlaceLinks(place: Place): Place {
  const searchUrl = getNaverMapSearchUrl(place) || undefined;

  return {
    ...place,
    title: stripHtml(place.title),
    roadAddress: stripHtml(place.roadAddress),
    address: stripHtml(place.address),
    naverMapUrl: searchUrl,
    naverSearchQuery: searchUrl ? stripHtml(place.title) : undefined,
    // Do NOT preserve non-Naver Map URLs as naverPlaceUrl or link
    link: isNaverMapUrl(place.link) ? place.link : undefined,
    naverPlaceUrl: isNaverMapUrl(place.naverPlaceUrl) ? place.naverPlaceUrl : undefined,
  };
}
