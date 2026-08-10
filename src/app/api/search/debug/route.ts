import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service');
  const query = searchParams.get('query') || '순천만국가정원';

  if (service !== 'localSearch' && service !== 'geocoding') {
    return NextResponse.json(
      { error: 'Invalid service parameter. Use localSearch or geocoding' },
      { status: 400 }
    );
  }

  if (service === 'localSearch') {
    const searchClientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const searchClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
    const configured = Boolean(searchClientId && searchClientSecret);

    if (!configured) {
      return NextResponse.json({
        service: 'localSearch',
        configured: false,
        ok: false,
        status: null,
        code: 'NOT_CONFIGURED',
      });
    }

    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=random`,
        {
          headers: {
            'X-Naver-Client-Id': searchClientId!,
            'X-Naver-Client-Secret': searchClientSecret!,
          },
        }
      );

      if (!res.ok) {
        let code = 'UPSTREAM_ERROR';
        if (res.status === 401) code = 'AUTH_FAILED';
        if (res.status === 403) code = 'FORBIDDEN';
        if (res.status === 429) code = 'RATE_LIMITED';

        return NextResponse.json({
          service: 'localSearch',
          configured: true,
          ok: false,
          status: res.status,
          code,
        });
      }

      return NextResponse.json({
        service: 'localSearch',
        configured: true,
        ok: true,
        status: 200,
        code: 'OK',
      });
    } catch (err: unknown) {
      console.error('[debug:localSearch] Error:', err);
      return NextResponse.json({
        service: 'localSearch',
        configured: true,
        ok: false,
        status: 500,
        code: 'UPSTREAM_ERROR',
      });
    }
  }

  if (service === 'geocoding') {
    const mapClientId = process.env.NAVER_MAP_CLIENT_ID;
    const mapClientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
    const configured = Boolean(mapClientId && mapClientSecret);

    if (!configured) {
      return NextResponse.json({
        service: 'geocoding',
        configured: false,
        ok: false,
        status: null,
        code: 'NOT_CONFIGURED',
      });
    }

    try {
      const res = await fetch(
        `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'x-ncp-apigw-api-key-id': mapClientId!,
            'x-ncp-apigw-api-key': mapClientSecret!,
            Accept: 'application/json',
          },
        }
      );

      if (!res.ok) {
        let code = 'UPSTREAM_ERROR';
        if (res.status === 401) code = 'AUTH_FAILED';
        if (res.status === 403) code = 'FORBIDDEN';
        if (res.status === 429) code = 'RATE_LIMITED';

        return NextResponse.json({
          service: 'geocoding',
          configured: true,
          ok: false,
          status: res.status,
          code,
        });
      }

      return NextResponse.json({
        service: 'geocoding',
        configured: true,
        ok: true,
        status: 200,
        code: 'OK',
      });
    } catch (err: unknown) {
      console.error('[debug:geocoding] Error:', err);
      return NextResponse.json({
        service: 'geocoding',
        configured: true,
        ok: false,
        status: 500,
        code: 'UPSTREAM_ERROR',
      });
    }
  }
}
