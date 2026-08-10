import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // Return mock results if API keys are not set, so user can immediately test UI!
    return NextResponse.json({
      items: [
        {
          id: 'mock-1',
          title: `${query} 추천 장소 1`,
          category: '음식점 > 한식',
          address: '서울특별시 중구 세종대로 110',
          roadAddress: '서울특별시 중구 세종대로 110',
          lat: 37.5665,
          lng: 126.9780,
          link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 추천 장소 1')}`,
          telephone: '02-1234-5678',
        },
        {
          id: 'mock-2',
          title: `${query} 인기 관광지 2`,
          category: '여행 > 명소',
          address: '서울특별시 종로구 사직로 161',
          roadAddress: '서울특별시 종로구 사직로 161',
          lat: 37.5796,
          lng: 126.9770,
          link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 인기 관광지 2')}`,
          telephone: '02-9876-5432',
        },
        {
          id: 'mock-3',
          title: `${query} 센트럴 카페 3`,
          category: '카페 > 디저트',
          address: '서울특별시 종로구 인사동길 44',
          roadAddress: '서울특별시 종로구 인사동길 44',
          lat: 37.5742,
          lng: 126.9848,
          link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 센트럴 카페 3')}`,
          telephone: '02-5555-4321',
        },
      ],
      isMock: true,
      message: '네이버 API 키가 설정되지 않아 임시 추천 데이터가 표시됩니다.',
    });
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10&sort=comment`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Naver Search API Error:', errText);
      return NextResponse.json({ error: 'Naver Search API failed', details: errText }, { status: res.status });
    }

    const data = await res.json();
    const items = (data.items || []).map((item: any, idx: number) => {
      // Clean HTML tags from Naver Search API response (<b>, </b>)
      const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');
      
      // Coordinate calculation
      // mapx/mapy in Naver search local API are WGS84 * 10,000,000 (or KATECH in some legacy endpoints)
      let lng = parseFloat(item.mapx) / 10000000;
      let lat = parseFloat(item.mapy) / 10000000;

      // Fallback range check for Korea coordinates (Lat ~33..39, Lng ~124..132)
      if (lat < 30 || lat > 45 || lng < 120 || lng > 135) {
        lng = parseFloat(item.mapx) / 1000000;
        lat = parseFloat(item.mapy) / 1000000;
      }
      if (lat < 30 || lat > 45 || lng < 120 || lng > 135) {
        // Fallback default Seoul coordinate if coordinates invalid
        lat = 37.5665;
        lng = 126.9780;
      }

      // External link for Naver Search / Place review
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

    return NextResponse.json({ items, isMock: false });
  } catch (error: any) {
    console.error('Search Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
