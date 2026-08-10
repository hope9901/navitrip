import { NextRequest, NextResponse } from 'next/server';
import { Place } from '@/types/itinerary';

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

interface NaverLocalSearchResponse {
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
}

function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isValidKoreaCoordinate(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
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
  const searchClientId = process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const searchClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;

  if (!searchClientId || !searchClientSecret) {
    console.warn('[searchLocal] NAVER Search API client credentials missing');
    throw new Error('NAVER_SEARCH_NOT_CONFIGURED');
  }

  const res = await fetch(
    `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=random`,
    {
      headers: {
        'X-Naver-Client-Id': searchClientId,
        'X-Naver-Client-Secret': searchClientSecret,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('[searchLocal] Naver Local Search API Error:', res.status, errText);
    throw new Error(`NAVER_SEARCH_API_FAILED_${res.status}`);
  }

  const data: NaverLocalSearchResponse = await res.json();
  const rawItems = data.items || [];

  const places: Place[] = [];

  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');

    const lng = Number(item.mapx) / 1e7;
    const lat = Number(item.mapy) / 1e7;

    if (!isValidKoreaCoordinate(lat, lng)) {
      console.warn(
        `[searchLocal] Invalid coordinates excluded for place '${cleanTitle}': lat=${lat}, lng=${lng}`
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
      lat,
      lng,
      link: item.link && item.link.trim() ? item.link.trim() : undefined,
      telephone: item.telephone && item.telephone.trim() ? item.telephone.trim() : undefined,
      mapx: item.mapx,
      mapy: item.mapy,
    });
  }

  return places;
}

async function geocodeAddress(query: string): Promise<Place[]> {
  const mapClientId = process.env.NAVER_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const mapClientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!mapClientId || !mapClientSecret) {
    console.warn('[geocodeAddress] NAVER Geocoding API client credentials missing');
    throw new Error('NAVER_MAP_NOT_CONFIGURED');
  }

  const res = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
    {
      headers: {
        'x-ncp-apigw-api-key-id': mapClientId,
        'x-ncp-apigw-api-key': mapClientSecret,
        Accept: 'application/json',
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('[geocodeAddress] Naver Geocoding API Error:', res.status, errText);
    throw new Error(`NAVER_GEOCODE_API_FAILED_${res.status}`);
  }

  const data: NaverGeocodeResponse = await res.json();
  const addresses = data.addresses || [];

  const places: Place[] = [];

  for (let idx = 0; idx < addresses.length; idx++) {
    const addr = addresses[idx];
    const lng = Number(addr.x);
    const lat = Number(addr.y);

    if (!isValidKoreaCoordinate(lat, lng)) {
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

  const placesFromLocal: Place[] = localResult.status === 'fulfilled' ? localResult.value : [];
  const placesFromGeocode: Place[] = geocodeResult.status === 'fulfilled' ? geocodeResult.value : [];

  if (localResult.status === 'rejected' && geocodeResult.status === 'rejected') {
    const localErrReason = String(localResult.reason);
    if (localErrReason.includes('NOT_CONFIGURED')) {
      return NextResponse.json({
        items: [],
        error: 'NAVER_SEARCH_NOT_CONFIGURED',
        message: '검색 API 설정을 확인해 주세요.',
      });
    }
    return NextResponse.json({
      items: [],
      error: 'NAVER_SEARCH_API_FAILED',
      message: '장소 및 주소 검색 API 호출에 실패했습니다.',
    });
  }

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

  return NextResponse.json({ items: sortedItems });
}
