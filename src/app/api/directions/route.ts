import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RouteSegment } from '@/types/itinerary';
import { createRouteSignature, createSegmentCacheKey, PointCoords } from '@/lib/routeSignature';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function estimateDrivingTimeSeconds(distanceMeter: number): number {
  const averageSpeedKmH = 35;
  const hours = distanceMeter / 1000 / averageSpeedKmH;
  return Math.round(hours * 3600);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return '1분 미만';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}분`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}시간 ${remMins}분` : `${hrs}시간`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

interface DirectionsRequestBody {
  start?: PointCoords;
  goal?: PointCoords;
  waypoints?: PointCoords[];
  forceRefresh?: boolean;
}

type FetchSegmentResult =
  | { success: true; segment: RouteSegment; isFallback: boolean; source: 'live' | 'cache' | 'stale-cache' | 'fallback' }
  | { success: false; httpStatus: number; code: string; naverErrorCode?: string; message: string };

async function fetchSegmentRouteCached(
  start: PointCoords,
  goal: PointCoords,
  ncpKeyId: string,
  ncpKeySecret: string,
  allowFallback: boolean,
  forceRefresh: boolean
): Promise<FetchSegmentResult> {
  const cacheKey = createSegmentCacheKey(start, goal, 'trafast', 1);

  // 1. Try reading from Supabase route_cache if forceRefresh is false
  if (!forceRefresh && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('route_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single();

      if (!error && data) {
        const expiresAt = new Date(data.expires_at).getTime();
        const isExpired = Date.now() > expiresAt;

        if (!isExpired) {
          const segment: RouteSegment = {
            distanceMeter: data.distance_meter,
            durationSeconds: Math.round(data.duration_ms / 1000),
            formattedDistance: formatDistance(data.distance_meter),
            formattedDuration: formatDuration(Math.round(data.duration_ms / 1000)),
            path: data.path,
            isFallback: false,
            source: 'cache',
            cacheKey,
            calculatedAt: data.calculated_at,
            expiresAt: data.expires_at,
          };
          return { success: true, segment, isFallback: false, source: 'cache' };
        }
      }
    } catch (err) {
      console.warn('[Directions API] Supabase cache read warning:', err);
    }
  }

  const fallbackDistance = calculateHaversineDistance(start.lat, start.lng, goal.lat, goal.lng);
  const fallbackDuration = estimateDrivingTimeSeconds(fallbackDistance);
  const fallbackSegment: RouteSegment = {
    distanceMeter: fallbackDistance,
    durationSeconds: fallbackDuration,
    formattedDistance: formatDistance(fallbackDistance),
    formattedDuration: formatDuration(fallbackDuration),
    path: [
      [start.lat, start.lng],
      [goal.lat, goal.lng],
    ],
    isFallback: true,
    source: 'fallback',
    cacheKey,
  };

  // 2. Fetch live data from Naver Cloud Maps Driving API
  try {
    const url = `https://maps.apigw.ntruss.com/map-direction/v1/driving?start=${start.lng},${start.lat}&goal=${goal.lng},${goal.lat}&option=trafast`;
    const res = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': ncpKeyId,
        'x-ncp-apigw-api-key': ncpKeySecret,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      let naverErrorCode = 'UNKNOWN';
      try {
        const errJson = await res.json();
        naverErrorCode = String(errJson.error?.errorCode || errJson.errorCode || errJson.code || 'UNKNOWN');
      } catch {
        // ignore
      }

      console.warn('[Directions API] Naver API HTTP Error:', { status: res.status, naverErrorCode });

      // If Naver API failed, try loading stale cache from Supabase
      if (supabaseAdmin) {
        try {
          const { data } = await supabaseAdmin
            .from('route_cache')
            .select('*')
            .eq('cache_key', cacheKey)
            .single();

          if (data) {
            const staleSegment: RouteSegment = {
              distanceMeter: data.distance_meter,
              durationSeconds: Math.round(data.duration_ms / 1000),
              formattedDistance: formatDistance(data.distance_meter),
              formattedDuration: formatDuration(Math.round(data.duration_ms / 1000)),
              path: data.path,
              isFallback: false,
              source: 'stale-cache',
              cacheKey,
              calculatedAt: data.calculated_at,
              expiresAt: data.expires_at,
            };
            return { success: true, segment: staleSegment, isFallback: false, source: 'stale-cache' };
          }
        } catch {
          // ignore
        }
      }

      if (allowFallback) {
        return { success: true, segment: fallbackSegment, isFallback: true, source: 'fallback' };
      }

      return {
        success: false,
        httpStatus: res.status,
        code: res.status === 401 || res.status === 403 ? 'AUTH_FAILED' : 'UPSTREAM_ERROR',
        naverErrorCode,
        message: '자동차 경로를 불러오지 못했습니다.',
      };
    }

    const data = await res.json();

    if (data.code !== 0 && data.code !== '0') {
      console.warn('[Directions API] Returned non-zero code:', data.code, data.message);
      if (!allowFallback) {
        return {
          success: false,
          httpStatus: 502,
          code: 'UPSTREAM_ERROR',
          naverErrorCode: String(data.code),
          message: data.message || '자동차 경로를 불러오지 못했습니다.',
        };
      }
    }

    const traObj =
      data.route?.trafast?.[0] ||
      data.route?.traoptimal?.[0] ||
      data.route?.traoption?.[0] ||
      data.route?.tracomfort?.[0];

    if (traObj && traObj.summary && Array.isArray(traObj.path) && traObj.path.length > 0) {
      const summary = traObj.summary;
      const path: Array<[number, number]> = traObj.path.map(([lng, lat]: [number, number]) => [lat, lng]);
      const durationSec = Math.round((summary.duration || 0) / 1000);
      const calculatedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const segment: RouteSegment = {
        distanceMeter: summary.distance,
        durationSeconds: durationSec,
        formattedDistance: formatDistance(summary.distance),
        formattedDuration: formatDuration(durationSec),
        path,
        isFallback: false,
        source: 'live',
        cacheKey,
        calculatedAt,
        expiresAt,
      };

      // Upsert into Supabase route_cache for 24h persistent caching
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('route_cache').upsert({
            cache_key: cacheKey,
            start_lat: start.lat,
            start_lng: start.lng,
            goal_lat: goal.lat,
            goal_lng: goal.lng,
            route_option: 'trafast',
            distance_meter: summary.distance,
            duration_ms: summary.duration || durationSec * 1000,
            path,
            calculated_at: calculatedAt,
            expires_at: expiresAt,
            provider: 'naver',
            source: 'naver',
          });
        } catch (dbErr) {
          console.warn('[Directions API] Supabase cache write warning:', dbErr);
        }
      }

      return { success: true, segment, isFallback: false, source: 'live' };
    }

    if (allowFallback) {
      return { success: true, segment: fallbackSegment, isFallback: true, source: 'fallback' };
    }

    return {
      success: false,
      httpStatus: 502,
      code: 'UPSTREAM_ERROR',
      message: '네이버 경로 데이터가 비어 있습니다.',
    };
  } catch (err) {
    console.error('[Directions API] Network Exception:', err);
    if (allowFallback) {
      return { success: true, segment: fallbackSegment, isFallback: true, source: 'fallback' };
    }
    return {
      success: false,
      httpStatus: 502,
      code: 'UPSTREAM_ERROR',
      message: '자동차 경로 네트워크 요청 중 오류가 발생했습니다.',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DirectionsRequestBody = await request.json();
    const { start, goal, waypoints, forceRefresh = false } = body;

    // Strict Server Environment Variables ONLY
    const ncpKeyId = process.env.NAVER_MAP_CLIENT_ID;
    const ncpKeySecret = process.env.NAVER_MAP_CLIENT_SECRET;
    const allowFallback = process.env.ALLOW_ROUTE_FALLBACK === 'true';

    if (!ncpKeyId || !ncpKeySecret) {
      if (allowFallback && waypoints && waypoints.length >= 2) {
        const fallbackSegments: RouteSegment[] = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
          const d = calculateHaversineDistance(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
          const t = estimateDrivingTimeSeconds(d);
          fallbackSegments.push({
            distanceMeter: d,
            durationSeconds: t,
            formattedDistance: formatDistance(d),
            formattedDuration: formatDuration(t),
            path: [[waypoints[i].lat, waypoints[i].lng], [waypoints[i + 1].lat, waypoints[i + 1].lng]],
            isFallback: true,
            source: 'fallback',
          });
        }
        return NextResponse.json({
          ok: true,
          source: 'fallback',
          isFallback: true,
          routes: fallbackSegments,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          service: 'directions',
          code: 'NOT_CONFIGURED',
          httpStatus: 502,
          message: '자동차 경로를 불러오지 못했습니다. NAVER_MAP_CLIENT_ID 및 NAVER_MAP_CLIENT_SECRET 서버 환경변수가 설정되지 않았습니다.',
        },
        { status: 502 }
      );
    }

    // Waypoints leg-by-leg calculation with Supabase caching
    if (waypoints && Array.isArray(waypoints) && waypoints.length >= 2) {
      const routeSig = createRouteSignature({ waypoints, option: 'trafast', mode: 'driving', version: 1 });
      const segmentResults: FetchSegmentResult[] = [];

      for (let i = 0; i < waypoints.length - 1; i++) {
        const res = await fetchSegmentRouteCached(
          waypoints[i],
          waypoints[i + 1],
          ncpKeyId,
          ncpKeySecret,
          allowFallback,
          forceRefresh
        );
        segmentResults.push(res);
      }

      const failedResult = segmentResults.find((r) => !r.success);
      if (failedResult && !failedResult.success) {
        return NextResponse.json(
          {
            ok: false,
            service: 'directions',
            code: failedResult.code,
            httpStatus: failedResult.httpStatus,
            naverErrorCode: failedResult.naverErrorCode || null,
            message: failedResult.message,
          },
          { status: 502 }
        );
      }

      const routes = segmentResults
        .filter((r): r is Extract<FetchSegmentResult, { success: true }> => r.success)
        .map((r) => r.segment);

      const hasFallback = routes.some((r) => r.isFallback);
      const hasLive = routes.some((r) => r.source === 'live');
      const hasStale = routes.some((r) => r.source === 'stale-cache');

      const overallSource = hasFallback
        ? 'fallback'
        : hasStale
        ? 'stale-cache'
        : hasLive
        ? 'live'
        : 'cache';

      const calculatedAt = routes[0]?.calculatedAt || new Date().toISOString();
      const expiresAt = routes[0]?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Diagnostic logging (No secrets)
      console.log('[Directions API Summary]:', {
        waypointsCount: waypoints.length,
        segmentsCount: routes.length,
        overallSource,
        forceRefresh,
        routeSig: routeSig.substring(0, 40) + '...',
      });

      return NextResponse.json({
        ok: true,
        provider: 'naver',
        source: overallSource,
        isFallback: hasFallback,
        routeSignature: routeSig,
        calculatedAt,
        expiresAt,
        routes,
      });
    }

    // Single start and goal pair
    if (start && goal) {
      const result = await fetchSegmentRouteCached(start, goal, ncpKeyId, ncpKeySecret, allowFallback, forceRefresh);

      if (!result.success) {
        return NextResponse.json(
          {
            ok: false,
            service: 'directions',
            code: result.code,
            httpStatus: result.httpStatus,
            naverErrorCode: result.naverErrorCode || null,
            message: result.message,
          },
          { status: 502 }
        );
      }

      const routeSig = createRouteSignature({ waypoints: [start, goal], option: 'trafast', mode: 'driving', version: 1 });

      return NextResponse.json({
        ok: true,
        provider: 'naver',
        source: result.source,
        isFallback: result.isFallback,
        routeSignature: routeSig,
        calculatedAt: result.segment.calculatedAt || new Date().toISOString(),
        expiresAt: result.segment.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        routes: [result.segment],
        ...result.segment,
      });
    }

    return NextResponse.json(
      { ok: false, service: 'directions', code: 'BAD_REQUEST', httpStatus: 400, message: '경로 계산을 위한 좌표가 유효하지 않습니다.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '서버 내부 오류가 발생했습니다.';
    return NextResponse.json(
      { ok: false, service: 'directions', code: 'SERVER_ERROR', httpStatus: 500, message },
      { status: 500 }
    );
  }
}
