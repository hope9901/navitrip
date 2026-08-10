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

interface RegionPlaceItem {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  link: string;
  telephone: string;
}

const REGION_DATABASE: Record<string, { center: { lat: number; lng: number }; places: RegionPlaceItem[] }> = {
  제주: {
    center: { lat: 33.4996, lng: 126.5312 },
    places: [
      {
        title: '성산일출봉',
        category: '여행 > 자연명소',
        address: '제주특별자치도 서귀포시 성산읍 성산리 1',
        roadAddress: '제주특별자치도 서귀포시 성산읍 일출로 284-12',
        lat: 33.4581,
        lng: 126.9425,
        link: 'https://search.naver.com/search.naver?query=성산일출봉',
        telephone: '064-783-0959',
      },
      {
        title: '함덕해수욕장',
        category: '여행 > 해수욕장',
        address: '제주특별자치도 제주시 조천읍 함덕리 1004-10',
        roadAddress: '제주특별자치도 제주시 조천읍 조함해안로 525',
        lat: 33.5432,
        lng: 126.6692,
        link: 'https://search.naver.com/search.naver?query=함덕해수욕장',
        telephone: '064-728-3989',
      },
      {
        title: '섭지코지',
        category: '여행 > 명소',
        address: '제주특별자치도 서귀포시 성산읍 고성리 66',
        roadAddress: '제주특별자치도 서귀포시 성산읍 섭지코지로 107',
        lat: 33.4243,
        lng: 126.9289,
        link: 'https://search.naver.com/search.naver?query=섭지코지',
        telephone: '064-740-6000',
      },
      {
        title: '제주동문시장',
        category: '전통시장',
        address: '제주특별자치도 제주시 이도1동 1436-7',
        roadAddress: '제주특별자치도 제주시 관덕로14길 20',
        lat: 33.5126,
        lng: 126.5284,
        link: 'https://search.naver.com/search.naver?query=제주동문시장',
        telephone: '064-752-3001',
      },
      {
        title: '한라산국립공원',
        category: '여행 > 국립공원',
        address: '제주특별자치도 제주시 해안동 1100로 2070-61',
        roadAddress: '제주특별자치도 제주시 1100로 2070-61',
        lat: 33.3617,
        lng: 126.5292,
        link: 'https://search.naver.com/search.naver?query=한라산국립공원',
        telephone: '064-713-9950',
      },
    ],
  },
  속초: {
    center: { lat: 38.2045, lng: 128.5901 },
    places: [
      {
        title: '속초해수욕장',
        category: '여행 > 해수욕장',
        address: '강원특별자치도 속초시 조양동',
        roadAddress: '강원특별자치도 속초시 해오름로 186',
        lat: 38.1906,
        lng: 128.6033,
        link: 'https://search.naver.com/search.naver?query=속초해수욕장',
        telephone: '033-639-2690',
      },
      {
        title: '속초관광수산시장 (중앙시장)',
        category: '전통시장',
        address: '강원특별자치도 속초시 중앙동 471-4',
        roadAddress: '강원특별자치도 속초시 중앙로147번길 16',
        lat: 38.2045,
        lng: 128.5901,
        link: 'https://search.naver.com/search.naver?query=속초관광수산시장',
        telephone: '033-633-5420',
      },
      {
        title: '아바이마을',
        category: '여행 > 명소',
        address: '강원특별자치도 속초시 청호동 1076',
        roadAddress: '강원특별자치도 속초시 아바이마을길 22',
        lat: 38.2012,
        lng: 128.5954,
        link: 'https://search.naver.com/search.naver?query=아바이마을',
        telephone: '033-633-3177',
      },
      {
        title: '영금정',
        category: '여행 > 전망대',
        address: '강원특별자치도 속초시 동명동 1-185',
        roadAddress: '강원특별자치도 속초시 영금정로 43',
        lat: 38.2119,
        lng: 128.6015,
        link: 'https://search.naver.com/search.naver?query=영금정',
        telephone: '033-639-2690',
      },
    ],
  },
  강릉: {
    center: { lat: 37.7519, lng: 128.8760 },
    places: [
      {
        title: '경포해변',
        category: '여행 > 해수욕장',
        address: '강원특별자치도 강릉시 강문동 산1-1',
        roadAddress: '강원특별자치도 강릉시 창해로 514',
        lat: 37.8055,
        lng: 128.9078,
        link: 'https://search.naver.com/search.naver?query=경포해변',
        telephone: '033-640-5129',
      },
      {
        title: '안목해변 커피거리',
        category: '음식점 > 카페거리',
        address: '강원특별자치도 강릉시 견소동 286',
        roadAddress: '강원특별자치도 강릉시 창해로 14',
        lat: 37.7719,
        lng: 128.9486,
        link: 'https://search.naver.com/search.naver?query=안목해변+커피거리',
        telephone: '033-640-4531',
      },
      {
        title: '오죽헌',
        category: '여행 > 유적지',
        address: '강원특별자치도 강릉시 죽헌동 201',
        roadAddress: '강원특별자치도 강릉시 율곡로3139번길 24',
        lat: 37.7791,
        lng: 128.8794,
        link: 'https://search.naver.com/search.naver?query=오죽헌',
        telephone: '033-660-3301',
      },
    ],
  },
  부산: {
    center: { lat: 35.1796, lng: 129.0756 },
    places: [
      {
        title: '해운대해수욕장',
        category: '여행 > 해수욕장',
        address: '부산광역시 해운대구 우동 1015',
        roadAddress: '부산광역시 해운대구 해운대해변로 264',
        lat: 35.1587,
        lng: 129.1604,
        link: 'https://search.naver.com/search.naver?query=해운대해수욕장',
        telephone: '051-749-5700',
      },
      {
        title: '광안리해수욕장',
        category: '여행 > 해수욕장',
        address: '부산광역시 수영구 광안동 192-20',
        roadAddress: '부산광역시 수영구 광안해변로 219',
        lat: 35.1532,
        lng: 129.1189,
        link: 'https://search.naver.com/search.naver?query=광안리해수욕장',
        telephone: '051-610-4216',
      },
      {
        title: '감천문화마을',
        category: '여행 > 체험마을',
        address: '부산광역시 사하구 감천동 2-188',
        roadAddress: '부산광역시 사하구 감내2로 203',
        lat: 35.0975,
        lng: 129.0106,
        link: 'https://search.naver.com/search.naver?query=감천문화마을',
        telephone: '051-204-1444',
      },
    ],
  },
};

function getRegionOrFallback(query: string) {
  const cleanKey = Object.keys(REGION_DATABASE).find((key) => query.includes(key));
  if (cleanKey && REGION_DATABASE[cleanKey]) {
    const regData = REGION_DATABASE[cleanKey];
    return {
      regionCenter: regData.center,
      items: regData.places.map((p, idx) => ({
        id: `reg_${idx}_${Date.now()}`,
        ...p,
      })),
    };
  }

  const baseLat = 37.5665;
  const baseLng = 126.9780;
  return {
    regionCenter: { lat: baseLat, lng: baseLng },
    items: [
      {
        id: `mock-1-${Date.now()}`,
        title: `${query} 명소`,
        category: '여행 > 관광명소',
        address: '서울특별시 중구 세종대로 110',
        roadAddress: '서울특별시 중구 세종대로 110',
        lat: baseLat,
        lng: baseLng,
        link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 명소')}`,
        telephone: '02-1234-5678',
      },
      {
        id: `mock-2-${Date.now()}`,
        title: `${query} 인기 맛집`,
        category: '음식점 > 한식',
        address: '서울특별시 종로구 사직로 161',
        roadAddress: '서울특별시 종로구 사직로 161',
        lat: baseLat + 0.012,
        lng: baseLng + 0.015,
        link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 맛집')}`,
        telephone: '02-750-9876',
      },
      {
        id: `mock-3-${Date.now()}`,
        title: `${query} 뷰 좋은 카페`,
        category: '카페 > 디저트',
        address: '서울특별시 종로구 인사동길 44',
        roadAddress: '서울특별시 종로구 인사동길 44',
        lat: baseLat - 0.008,
        lng: baseLng - 0.012,
        link: `https://search.naver.com/search.naver?query=${encodeURIComponent(query + ' 카페')}`,
        telephone: '02-799-5555',
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  const fallbackData = getRegionOrFallback(query);

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      regionCenter: fallbackData.regionCenter,
      items: fallbackData.items,
      isMock: true,
      message: '네이버 API 키 미설정으로 지역 대표 장소가 표시됩니다.',
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
      return NextResponse.json({
        regionCenter: fallbackData.regionCenter,
        items: fallbackData.items,
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
        lat = fallbackData.regionCenter.lat;
        lng = fallbackData.regionCenter.lng;
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
        regionCenter: fallbackData.regionCenter,
        items: fallbackData.items,
        isMock: true,
      });
    }

    const regionCenter = {
      lat: items[0].lat || fallbackData.regionCenter.lat,
      lng: items[0].lng || fallbackData.regionCenter.lng,
    };

    return NextResponse.json({ regionCenter, items, isMock: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Search Route Error:', message);
    return NextResponse.json({
      regionCenter: fallbackData.regionCenter,
      items: fallbackData.items,
      isMock: true,
    });
  }
}
