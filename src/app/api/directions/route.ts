import { NextRequest, NextResponse } from 'next/server';

// Haversine formula distance calculation helper (in meters)
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
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

// Fallback estimation (driving ~35km/h in city + traffic factor)
function estimateDrivingTimeSeconds(distanceMeter: number): number {
  const averageSpeedKmH = 35;
  const hours = (distanceMeter / 1000) / averageSpeedKmH;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { start, goal, waypoints } = body; // start: { lat, lng }, goal: { lat, lng }

    if (!start || !goal) {
      return NextResponse.json({ error: 'Start and goal coordinates required' }, { status: 400 });
    }

    const ncpKeyId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || process.env.NAVER_CLIENT_ID;
    const ncpKeySecret = process.env.NAVER_CLIENT_SECRET;

    // Check if NCP API credentials available
    if (!ncpKeyId || !ncpKeySecret) {
      const dist = calculateHaversineDistance(start.lat, start.lng, goal.lat, goal.lng);
      const durationSec = estimateDrivingTimeSeconds(dist);

      return NextResponse.json({
        distanceMeter: dist,
        durationSeconds: durationSec,
        formattedDistance: formatDistance(dist),
        formattedDuration: formatDuration(durationSec),
        path: [
          [start.lat, start.lng],
          [goal.lat, goal.lng],
        ],
        isFallback: true,
        message: '네이버 NCP API 키 설정 전이므로 예상 자동차 시간이 표시됩니다.',
      });
    }

    // Call Naver Directions 5 API with correct option=trafast (실시간 빠른길)
    let url = `https://naveropenapi.apigw.ntruss.com/map-direction/v5/finddriving?start=${start.lng},${start.lat}&goal=${goal.lng},${goal.lat}&option=trafast`;

    if (waypoints && Array.isArray(waypoints) && waypoints.length > 0) {
      const wpStr = waypoints.map((wp: { lat: number; lng: number }) => `${wp.lng},${wp.lat}`).join('|');
      url += `&waypoints=${wpStr}`;
    }

    const res = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': ncpKeyId,
        'X-NCP-APIGW-API-KEY': ncpKeySecret,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Naver Directions 5 API response not OK, using estimation fallback:', errText);
      const dist = calculateHaversineDistance(start.lat, start.lng, goal.lat, goal.lng);
      const durationSec = estimateDrivingTimeSeconds(dist);

      return NextResponse.json({
        distanceMeter: dist,
        durationSeconds: durationSec,
        formattedDistance: formatDistance(dist),
        formattedDuration: formatDuration(durationSec),
        path: [
          [start.lat, start.lng],
          [goal.lat, goal.lng],
        ],
        isFallback: true,
      });
    }

    const data = await res.json();
    const route = data.route?.trafast?.[0] || data.route?.traoptimal?.[0] || data.route?.summary;

    if (route) {
      const summary = route.summary;
      const path: Array<[number, number]> = (route.path || []).map(([lng, lat]: [number, number]) => [lat, lng]);
      const durationSec = Math.round((summary.duration || 0) / 1000); // ms to sec

      return NextResponse.json({
        distanceMeter: summary.distance,
        durationSeconds: durationSec,
        formattedDistance: formatDistance(summary.distance),
        formattedDuration: formatDuration(durationSec),
        path,
        isFallback: false,
      });
    }

    // Fallback if route summary not found
    const dist = calculateHaversineDistance(start.lat, start.lng, goal.lat, goal.lng);
    const durationSec = estimateDrivingTimeSeconds(dist);
    return NextResponse.json({
      distanceMeter: dist,
      durationSeconds: durationSec,
      formattedDistance: formatDistance(dist),
      formattedDuration: formatDuration(durationSec),
      path: [
        [start.lat, start.lng],
        [goal.lat, goal.lng],
      ],
      isFallback: true,
    });
  } catch (error: any) {
    console.error('Directions API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
