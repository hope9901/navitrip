import { NextRequest, NextResponse } from 'next/server';

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

function generateMockPlaces(query: string) {
  const isJeju = query.includes('제주');
  const baseLat = isJeju ? 33.4996 : 37.5665;
  const baseLng = isJeju ? 126.5312 : 126.9780;

  return [
    {
      id: `mock-1-${Date.now()}`,
      title: `${query} 대표 관광 명소`,
      category: '여행 > 관광명소',
      address: isJeju ? '제주특별자치도 제주시 첨단로 242' : '서울특별시 중구 세종대로 110',
      roadAddress: isJeju ? '제주특별자치도 제주시 첨단로 242' : '서울특별시 중구 세종대로 110',
      lat: baseLat,
      lng: baseLng,
      link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 명소')}`,
      telephone: '064-710-1234',
    },
    {
      id: `mock-2-${Date.now()}`,
      title: `${query} 인기 맛집`,
      category: '음식점 > 한식',
      address: isJeju ? '제주특별자치도 제주시 관덕로 14' : '서울특별시 종로구 사직로 161',
      roadAddress: isJeju ? '제주특별자치도 제주시 관덕로 14' : '서울특별시 종로구 사직로 161',
      lat: baseLat + 0.012,
      lng: baseLng + 0.015,
      link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 맛집')}`,
      telephone: '064-750-9876',
    },
    {
      id: `mock-3-${Date.now()}`,
      title: `${query} 뷰 좋은 카페`,
      category: '카페 > 디저트',
      address: isJeju ? '제주특별자치도 제주시 애월읍 애월로 11' : '서울특별시 종로구 인사동길 44',
      roadAddress: isJeju ? '제주특별자치도 제주시 애월읍 애월로 11' : '서울특별시 종로구 인사동길 44',
      lat: baseLat - 0.008,
      lng: baseLng - 0.012,
      link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 카페')}`,
      telephone: '064-799-5555',
    },
    {
      id: `mock-4-${Date.now()}`,
      title: `${query} 힐링 오름/공원`,
      category: '여행 > 자연명소',
      address: isJeju ? '제주특별자치도 제주시 조천읍 교래리 산108' : '서울특별시 성동구 뚝섬로 273',
      roadAddress: isJeju ? '제주특별자치도 제주시 조천읍 교래리 산108' : '서울특별시 성동구 뚝섬로 273',
      lat: baseLat + 0.025,
      lng: baseLng - 0.02,
      link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 공원')}`,
      telephone: '064-710-6000',
    },
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      items: generateMockPlaces(query),
      isMock: true,
      message: '네이버 API 키가 설정되지 않아 임시 추천 데이터가 표시됩니다.',
    });
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Naver Search API response not OK, using mock fallback:', errText);
      return NextResponse.json({
        items: generateMockPlaces(query),
        isMock: true,
      });
    }

    const data: NaverLocalSearchResponse = await res.json();
    const items = (data.items || []).map((item, idx) => {
      const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');

      let lng = parseFloat(item.mapx) / 10000000;
      let lat = parseFloat(item.mapy) / 10000000;

      if (lat < 30 || lat > 45 || lng < 120 || lng > 135) {
        lng = parseFloat(item.mapx) / 1000000;
        lat = parseFloat(item.mapy) / 1000000;
      }
      if (lat < 30 || lat > 45 || lng < 120 || lng > 135) {
        lat = 37.5665;
        lng = 126.9780;
      }

      const naverSearchLink = item.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanTitle + ' ' + (item.roadAddress || item.address))}`;

      return {
        id: `naver_${idx}_${Date.now()}`,
        title: cleanTitle,
        category: item.category,
        address: item.address,
        roadAddress: item.roadAddress,
        lat,
        lng,
        link: naverSearchLink,
        telephone: item.telephone,
        mapx: item.mapx,
        mapy: item.mapy,
      };
    });

    if (items.length === 0) {
      return NextResponse.json({
        items: generateMockPlaces(query),
        isMock: true,
      });
    }

    return NextResponse.json({ items, isMock: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Search Route Error:', message);
    return NextResponse.json({
      items: generateMockPlaces(query),
      isMock: true,
    });
  }
}
