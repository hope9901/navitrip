import { ItineraryBlock, RouteSegment } from '@/types/itinerary';

// 네이버 Directions API는 자동차 경로만 제공한다.
// 도보 경로/시간 API를 연동하기 전까지 도보 구간은 시간·거리 없이 '도보'로만 표시하고 합계에서 제외한다.

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

export function createWalkingSegment(from: ItineraryBlock, to: ItineraryBlock): RouteSegment {
  return {
    fromBlockId: from.id,
    toBlockId: to.id,
    distanceMeter: 0,
    durationSeconds: 0,
    formattedDistance: '',
    formattedDuration: '',
    path: [
      [from.place.lat, from.place.lng],
      [to.place.lat, to.place.lng],
    ],
    travelMode: 'walking',
  };
}

export function countWalkingSegments(routes: RouteSegment[]): number {
  return routes.filter((r) => r.travelMode === 'walking').length;
}

/**
 * 자동차 경로 목록에 각 블록의 이동 수단 선택을 반영한다.
 * 도보 구간은 시간·거리 없는 도보 구간으로 교체되며, 원본 자동차 경로는 저장용으로 그대로 유지된다.
 */
export function applyTravelModes(blocks: ItineraryBlock[], drivingRoutes: RouteSegment[]): RouteSegment[] {
  return drivingRoutes.map((segment, idx) => {
    const from = blocks[idx];
    const to = blocks[idx + 1];
    if (from && to && from.travelModeToNext === 'walking') {
      return createWalkingSegment(from, to);
    }
    return segment;
  });
}
