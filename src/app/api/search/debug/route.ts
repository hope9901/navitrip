import { NextRequest, NextResponse } from 'next/server';

interface ApiHubErrorResponse {
  error?: {
    errorCode?: string;
    message?: string;
    details?: string;
  };
  errorCode?: string;
  errorMessage?: string;
  items?: unknown[];
}

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
        httpStatus: null,
        code: 'NOT_CONFIGURED',
      });
    }

    const searchUrl = new URL('https://naverapihub.apigw.ntruss.com/search/v1/local');
    searchUrl.searchParams.set('query', query);
    searchUrl.searchParams.set('display', '5');
    searchUrl.searchParams.set('start', '1');
    searchUrl.searchParams.set('sort', 'random');
    searchUrl.searchParams.set('format', 'json');

    try {
      const res = await fetch(searchUrl, {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': searchClientId!,
          'X-NCP-APIGW-API-KEY': searchClientSecret!,
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        let code = 'UPSTREAM_ERROR';
        if (res.status === 401) code = 'AUTH_FAILED';
        if (res.status === 403) code = 'FORBIDDEN';
        if (res.status === 429) code = 'RATE_LIMITED';

        let naverErrorCode = 'UNKNOWN';
        try {
          const errJson = (await res.json()) as ApiHubErrorResponse;
          naverErrorCode = String(
            errJson.error?.errorCode ?? errJson.errorCode ?? 'UNKNOWN'
          );
        } catch {
          // ignore
        }

        return NextResponse.json({
          service: 'localSearch',
          configured: true,
          ok: false,
          httpStatus: res.status,
          code,
          naverErrorCode,
        });
      }

      const data = (await res.json()) as ApiHubErrorResponse;
      return NextResponse.json({
        service: 'localSearch',
        configured: true,
        ok: true,
        httpStatus: 200,
        code: 'OK',
        resultCount: Array.isArray(data.items) ? data.items.length : 0,
      });
    } catch (err: unknown) {
      console.error('[debug:localSearch] Error:', err);
      return NextResponse.json({
        service: 'localSearch',
        configured: true,
        ok: false,
        httpStatus: 500,
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
        httpStatus: null,
        code: 'NOT_CONFIGURED',
      });
    }

    try {
      const res = await fetch(
        `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
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

        let naverErrorCode = 'UNKNOWN';
        try {
          const errJson = await res.json();
          naverErrorCode = String(errJson.error?.errorCode || errJson.errorCode || errJson.code || 'UNKNOWN');
        } catch {
          // ignore
        }

        return NextResponse.json({
          service: 'geocoding',
          configured: true,
          ok: false,
          httpStatus: res.status,
          code,
          naverErrorCode,
        });
      }

      const data = await res.json();
      return NextResponse.json({
        service: 'geocoding',
        configured: true,
        ok: true,
        httpStatus: 200,
        code: 'OK',
        resultCount: Array.isArray(data.addresses) ? data.addresses.length : 0,
      });
    } catch (err: unknown) {
      console.error('[debug:geocoding] Error:', err);
      return NextResponse.json({
        service: 'geocoding',
        configured: true,
        ok: false,
        httpStatus: 500,
        code: 'UPSTREAM_ERROR',
      });
    }
  }
}
