import { NextRequest, NextResponse } from 'next/server';
import { RouteSegment } from '@/types/itinerary';

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

interface Point {
  lat: number;
  lng: number;
}

interface DirectionsRequestBody {
  start?: Point;
  goal?: Point;
  waypoints?: Point[];
}

async function fetchSegmentRoute(
  start: Point,
  goal: Point,
  ncpKeyId?: string,
  ncpKeySecret?: string
): Promise<RouteSegment> {
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
  };

  if (!ncpKeyId || !ncpKeySecret) {
    return fallbackSegment;
  }

  try {
    const url = `https://maps.apigw.ntruss.com/map-direction/v1/driving?start=${start.lng},${start.lat}&goal=${goal.lng},${goal.lat}&option=trafast`;
    const res = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': ncpKeyId,
        'x-ncp-apigw-api-key': ncpKeySecret,
      },
    });

    if (!res.ok) {
      return fallbackSegment;
    }

    const data = await res.json();
    const route = data.route?.trafast?.[0] || data.route?.traoptimal?.[0] || data.route?.summary;

    if (route) {
      const summary = route.summary;
      const path: Array<[number, number]> = (route.path || []).map(([lng, lat]: [number, number]) => [lat, lng]);
      const durationSec = Math.round((summary.duration || 0) / 1000);

      return {
        distanceMeter: summary.distance,
        durationSeconds: durationSec,
        formattedDistance: formatDistance(summary.distance),
        formattedDuration: formatDuration(durationSec),
        path: path.length > 0 ? path : [[start.lat, start.lng], [goal.lat, goal.lng]],
      };
    }

    return fallbackSegment;
  } catch (err) {
    console.warn('[Directions] Failed to fetch segment, using estimation:', err);
    return fallbackSegment;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DirectionsRequestBody = await request.json();
    const { start, goal, waypoints } = body;

    const ncpKeyId = process.env.NAVER_MAP_CLIENT_ID;
    const ncpKeySecret = process.env.NAVER_MAP_CLIENT_SECRET;

    // Case A: Received waypoints array (Leg-by-leg calculation for N places)
    if (waypoints && Array.isArray(waypoints) && waypoints.length >= 2) {
      const segmentPromises: Promise<RouteSegment>[] = [];

      for (let i = 0; i < waypoints.length - 1; i++) {
        segmentPromises.push(
          fetchSegmentRoute(waypoints[i], waypoints[i + 1], ncpKeyId, ncpKeySecret)
        );
      }

      const routes = await Promise.all(segmentPromises);
      return NextResponse.json({ routes });
    }

    // Case B: Received start and goal (Single pair)
    if (start && goal) {
      const segment = await fetchSegmentRoute(start, goal, ncpKeyId, ncpKeySecret);
      return NextResponse.json({
        routes: [segment],
        ...segment,
      });
    }

    return NextResponse.json(
      { error: 'Valid waypoints array or start/goal coordinates required' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Directions API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
