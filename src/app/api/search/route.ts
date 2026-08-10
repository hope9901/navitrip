import { NextRequest, NextResponse } from 'next/server';
import { Place } from '@/types/itinerary';

type ApiServiceType = 'localSearch' | 'geocoding';
type ApiErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH_FAILED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR';

class NaverApiError extends Error {
  constructor(
    public service: ApiServiceType,
    public code: ApiErrorCode,
    public status?: number,
    public naverErrorCode?: string,
    public naverErrorMessage?: string
  ) {
    super(`${service}:${code}`);
    this.name = 'NaverApiError';
  }
}

interface NaverLocalSearchItem {
  title: string;
  category?: string;
  address: string;
  roadAddress?: string;
  link?: string;
  telephone?: string;
  mapx: string;
  mapy: string;
}

interface ApiHubErrorResponse {
  error?: {
    errorCode?: string;
    message?: string;
    details?: string;
  };
  errorCode?: string;
  errorMessage?: string;
  items?: NaverLocalSearchItem[];
}

interface NaverGeocodeAddressElement {
  types: string[];
  longName: string;
  shortName: string;
  code: string;
}

interface NaverGeocodeAddress {
  roadAddress?: string;
  jibunAddress?: string;
  englishAddress?: string;
  x: string; // Longitude
  y: string; // Latitude
  addressElements?: NaverGeocodeAddressElement[];
}

interface NaverGeocodeResponse {
  status: string;
  addresses?: NaverGeocodeAddress[];
  errorMessage?: string;
  error?: {
    errorCode?: string;
    message?: string;
    details?: string;
  };
}

function mapHttpStatusToErrorCode(status?: number): ApiErrorCode {
  if (status === 401) return 'AUTH_FAILED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 429) return 'RATE_LIMITED';
  return 'UPSTREAM_ERROR';
}

function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseLocalCoordinate(mapx: string, mapy: string): { lat: number; lng: number } | null {
  let lng = Number(mapx);
  let lat = Number(mapy);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (Math.abs(lng) > 1000) {
    lng /= 1e7;
  }

  if (Math.abs(lat) > 1000) {
    lat /= 1e7;
  }

  const valid = lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
  return valid ? { lat, lng } : null;
}

function isDuplicate(a: Place, b: Place): boolean {
  const roadA = normalizeStr(a.roadAddress);
  const roadB = normalizeStr(b.roadAddress);
  if (roadA && roadB && roadA === roadB) return true;

  const addrA = normalizeStr(a.address);
  const addrB = normalizeStr(b.address);
  if (addrA && addrB && addrA === addrB) return true;

  const titleA = normalizeStr(a.title);
  const titleB = normalizeStr(b.title);
  const latDiff = Math.abs(a.lat - b.lat);
  const lngDiff = Math.abs(a.lng - b.lng);
  if (latDiff < 0.0001 && lngDiff < 0.0001 && titleA === titleB) return true;

  return false;
}

async function searchLocal(query: string): Promise<Place[]> {
  const searchClientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const searchClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!searchClientId || !searchClientSecret) {
    throw new NaverApiError('localSearch', 'NOT_CONFIGURED');
  }

  const searchUrl = new URL('https://naverapihub.apigw.ntruss.com/search/v1/local');
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('display', '5');
  searchUrl.searchParams.set('start', '1');
  searchUrl.searchParams.set('sort', 'random');
  searchUrl.searchParams.set('format', 'json');

  let res: Response;
  try {
    res = await fetch(searchUrl, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': searchClientId,
        'X-NCP-APIGW-API-KEY': searchClientSecret,
      },
      cache: 'no-store',
    });
  } catch (err) {
    console.error('[localSearch] Network fetch error:', err);
    throw new NaverApiError('localSearch', 'UPSTREAM_ERROR');
  }

  if (!res.ok) {
    let naverCode = 'UNKNOWN';
    let naverMsg = 'UNKNOWN';
    try {
      const errorBody = (await res.json()) as ApiHubErrorResponse;
      naverCode = errorBody.error?.errorCode ?? errorBody.errorCode ?? 'UNKNOWN';
      naverMsg = errorBody.error?.message ?? errorBody.error?.details ?? errorBody.errorMessage ?? 'UNKNOWN';
    } catch {
      // ignore json parse error
    }

    console.error('[localSearch]', {
      status: res.status,
      errorCode: naverCode,
      errorMessage: naverMsg,
    });

    const code = mapHttpStatusToErrorCode(res.status);
    throw new NaverApiError('localSearch', code, res.status, naverCode, naverMsg);
  }

  const data: ApiHubErrorResponse = await res.json();
  const rawItems = data.items || [];
  const places: Place[] = [];

  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');

    const coords = parseLocalCoordinate(item.mapx, item.mapy);
    if (!coords) {
      console.warn(
        `[searchLocal] Invalid coordinates excluded for place '${cleanTitle}': mapx=${item.mapx}, mapy=${item.mapy}`
      );
      continue;
    }

    places.push({
      id: `place_${idx}_${Date.now()}`,
      type: 'place',
      title: cleanTitle,
      category: item.category || '장소',
      address: item.address,
      roadAddress: item.roadAddress || undefined,
      lat: coords.lat,
      lng: coords.lng,
      link: item.link && item.link.trim() ? item.link.trim() : undefined,
      telephone: item.telephone && item.telephone.trim() ? item.telephone.trim() : undefined,
      mapx: item.mapx,
      mapy: item.mapy,
    });
  }

  return places;
}

async function geocodeAddress(query: string): Promise<Place[]> {
  const mapClientId = process.env.NAVER_MAP_CLIENT_ID;
  const mapClientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!mapClientId || !mapClientSecret) {
    throw new NaverApiError('geocoding', 'NOT_CONFIGURED');
  }

  let res: Response;
  try {
    res = await fetch(
      `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'x-ncp-apigw-api-key-id': mapClientId,
          'x-ncp-apigw-api-key': mapClientSecret,
          Accept: 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('[geocodeAddress] Network fetch error:', err);
    throw new NaverApiError('geocoding', 'UPSTREAM_ERROR');
  }

  if (!res.ok) {
    let naverCode = 'UNKNOWN';
    let naverMsg = 'UNKNOWN';
    try {
      const errJson = await res.json();
      naverCode = String(errJson.error?.errorCode || errJson.errorCode || errJson.code || 'UNKNOWN');
      naverMsg = String(errJson.error?.message || errJson.error?.details || errJson.errorMessage || 'UNKNOWN');
    } catch {
      // ignore json parse error
    }

    console.error('[geocodeAddress]', {
      status: res.status,
      errorCode: naverCode,
      errorMessage: naverMsg,
    });

    const code = mapHttpStatusToErrorCode(res.status);
    throw new NaverApiError('geocoding', code, res.status, naverCode, naverMsg);
  }

  const data: NaverGeocodeResponse = await res.json();
  const addresses = data.addresses || [];
  const places: Place[] = [];

  for (let idx = 0; idx < addresses.length; idx++) {
    const addr = addresses[idx];
    const lng = Number(addr.x);
    const lat = Number(addr.y);

    const valid = lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
    if (!valid) {
      console.warn(
        `[geocodeAddress] Invalid coordinates excluded for address '${addr.roadAddress || addr.jibunAddress}': lat=${lat}, lng=${lng}`
      );
      continue;
    }

    const title = addr.roadAddress || addr.jibunAddress || query;

    places.push({
      id: `addr_${idx}_${Date.now()}`,
      type: 'address',
      title,
      category: '주소',
      address: addr.jibunAddress || addr.roadAddress || query,
      roadAddress: addr.roadAddress || undefined,
      jibunAddress: addr.jibunAddress || undefined,
      lat,
      lng,
    });
  }

  return places;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('query');

  if (!rawQuery || !rawQuery.trim()) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const query = rawQuery.trim();

  const [localResult, geocodeResult] = await Promise.allSettled([
    searchLocal(query),
    geocodeAddress(query),
  ]);

  const localSuccess = localResult.status === 'fulfilled';
  const geocodeSuccess = geocodeResult.status === 'fulfilled';

  const localError = !localSuccess
    ? (localResult.reason instanceof NaverApiError
        ? localResult.reason
        : new NaverApiError('localSearch', 'UPSTREAM_ERROR'))
    : null;

  const geocodeError = !geocodeSuccess
    ? (geocodeResult.reason instanceof NaverApiError
        ? geocodeResult.reason
        : new NaverApiError('geocoding', 'UPSTREAM_ERROR'))
    : null;

  // Case 1: Both APIs failed
  if (!localSuccess && !geocodeSuccess) {
    const isAnyNotConfigured =
      localError?.code === 'NOT_CONFIGURED' || geocodeError?.code === 'NOT_CONFIGURED';
    const httpStatus = isAnyNotConfigured ? 503 : 502;

    return NextResponse.json(
      {
        items: [],
        error: 'NAVER_APIS_FAILED',
        message: '장소 검색과 주소 검색에 모두 실패했습니다.',
        services: {
          localSearch: {
            ok: false,
            code: localError?.code || 'UPSTREAM_ERROR',
            status: localError?.status || null,
            naverErrorCode: localError?.naverErrorCode || null,
          },
          geocoding: {
            ok: false,
            code: geocodeError?.code || 'UPSTREAM_ERROR',
            status: geocodeError?.status || null,
            naverErrorCode: geocodeError?.naverErrorCode || null,
          },
        },
      },
      { status: httpStatus }
    );
  }

  // Case 2: At least one API succeeded
  const placesFromLocal: Place[] = localSuccess ? localResult.value : [];
  const placesFromGeocode: Place[] = geocodeSuccess ? geocodeResult.value : [];

  const combinedRaw = [...placesFromGeocode, ...placesFromLocal];

  // Deduplication
  const deduplicated: Place[] = [];
  for (const item of combinedRaw) {
    const isDup = deduplicated.some((existing) => isDuplicate(existing, item));
    if (!isDup) {
      deduplicated.push(item);
    }
  }

  // Ranking / Sorting Rule:
  // 1. Places where clean title exactly equals user query
  // 2. Places where clean title includes user query
  // 3. Geocoding address results
  // 4. Remaining place results
  const normQuery = normalizeStr(query);

  const exactMatchPlaces: Place[] = [];
  const includesPlaces: Place[] = [];
  const geocodeAddresses: Place[] = [];
  const remainingPlaces: Place[] = [];

  for (const item of deduplicated) {
    if (item.type === 'address') {
      geocodeAddresses.push(item);
    } else {
      const normTitle = normalizeStr(item.title);
      if (normTitle === normQuery) {
        exactMatchPlaces.push(item);
      } else if (normTitle.includes(normQuery)) {
        includesPlaces.push(item);
      } else {
        remainingPlaces.push(item);
      }
    }
  }

  const sortedItems = [
    ...exactMatchPlaces,
    ...includesPlaces,
    ...geocodeAddresses,
    ...remainingPlaces,
  ];

  const warnings: Array<{ service: string; code: string; naverErrorCode?: string }> = [];
  if (localError) {
    warnings.push({ service: 'localSearch', code: localError.code, naverErrorCode: localError.naverErrorCode });
  }
  if (geocodeError) {
    warnings.push({ service: 'geocoding', code: geocodeError.code, naverErrorCode: geocodeError.naverErrorCode });
  }

  return NextResponse.json({
    items: sortedItems,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
