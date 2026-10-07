import { ItineraryBlock, RouteSegment } from '@/types/itinerary';

// 네이버 Directions API는 자동차 경로만 제공하므로, 도보는 직선거리 기반으로 추정한다.
// 직선거리에 우회 계수를 곱해 실제 보행 경로 길이를 근사하고 평균 보행 속도(약 4km/h)로 시간을 계산.
const WALKING_DETOUR_FACTOR = 1.3;
const WALKING_SPEED_METER_PER_SEC = 4000 / 3600;

export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return '1분 미만';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}분`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}시간 ${remMins}분` : `${hrs}시간`;
}

export function estimateWalkingSegment(from: ItineraryBlock, to: ItineraryBlock): RouteSegment {
  const straight = calculateHaversineDistance(from.place.lat, from.place.lng, to.place.lat, to.place.lng);
  const distanceMeter = Math.round(straight * WALKING_DETOUR_FACTOR);
  const durationSeconds = Math.round(distanceMeter / WALKING_SPEED_METER_PER_SEC);

  return {
    fromBlockId: from.id,
    toBlockId: to.id,
    distanceMeter,
    durationSeconds,
    formattedDistance: formatDistance(distanceMeter),
    formattedDuration: formatDuration(durationSeconds),
    path: [
      [from.place.lat, from.place.lng],
      [to.place.lat, to.place.lng],
    ],
    travelMode: 'walking',
  };
}

/**
 * 자동차 경로 목록에 각 블록의 이동 수단 선택을 반영한다.
 * 도보 구간은 자동차 경로 대신 도보 추정치로 교체되며, 원본 자동차 경로는 저장용으로 그대로 유지된다.
 */
export function applyTravelModes(blocks: ItineraryBlock[], drivingRoutes: RouteSegment[]): RouteSegment[] {
  return drivingRoutes.map((segment, idx) => {
    const from = blocks[idx];
    const to = blocks[idx + 1];
    if (from && to && from.travelModeToNext === 'walking') {
      return estimateWalkingSegment(from, to);
    }
    return segment;
  });
}
