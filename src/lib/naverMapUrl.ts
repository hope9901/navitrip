import { Place, TravelMode } from '@/types/itinerary';

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

// 네이버 지도 앱 길찾기 URL Scheme (NCP 문서: nmap://route/{car|walk}?slat&slng&sname&dlat&dlng&dname&appname)
export function getNaverMapRouteAppUrl(from: Place, to: Place, mode: TravelMode): string {
  const params = new URLSearchParams({
    slat: String(from.lat),
    slng: String(from.lng),
    sname: stripHtml(from.title),
    dlat: String(to.lat),
    dlng: String(to.lng),
    dname: stripHtml(to.title),
    appname: typeof window !== 'undefined' ? window.location.hostname : 'navitrip',
  });
  return `nmap://route/${mode === 'walking' ? 'walk' : 'car'}?${params.toString()}`;
}

const APP_OPEN_FALLBACK_DELAY_MS = 1500;

/**
 * 길찾기 열기: 모바일에서는 네이버 지도 앱을 먼저 시도하고, 앱이 열리지 않으면(설치 안 됨)
 * 도착지의 네이버 지도 웹 검색으로 이동한다. 데스크톱은 바로 웹 검색을 새 탭으로 연다.
 * (네이버 지도 웹 길찾기 URL 형식은 공식 문서화되어 있지 않아 사용하지 않음)
 */
export function openNaverMapRoute(from: Place, to: Place, mode: TravelMode) {
  const webFallbackUrl = getNaverMapSearchUrl(to);
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

  if (!isTouchDevice) {
    if (webFallbackUrl) window.open(webFallbackUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const fallbackTimer = setTimeout(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (!document.hidden && webFallbackUrl) window.location.href = webFallbackUrl;
  }, APP_OPEN_FALLBACK_DELAY_MS);

  function handleVisibilityChange() {
    if (document.hidden) {
      clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.location.href = getNaverMapRouteAppUrl(from, to, mode);
}
