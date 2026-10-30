// 방문 순서 자동 정렬: 첫 장소(숙소·역 등 출발지)는 고정하고,
// 나머지를 직선거리 기준으로 총 이동 거리가 짧아지도록 정렬한다.
// (최근접 이웃으로 초기 순서를 만든 뒤 2-opt 로 교차하는 구간을 풀어 개선)

interface LatLng {
  lat: number;
  lng: number;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pathLength(order: number[], dist: number[][]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) total += dist[order[i]][order[i + 1]];
  return total;
}

function nearestNeighborOrder(dist: number[][]): number[] {
  const n = dist.length;
  const order = [0];
  const visited = new Set([0]);
  while (order.length < n) {
    const last = order[order.length - 1];
    let next = -1;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && (next === -1 || dist[last][j] < dist[last][next])) next = j;
    }
    order.push(next);
    visited.add(next);
  }
  return order;
}

// 열린 경로(마지막 장소는 자유)에 대한 2-opt. 첫 장소(index 0)는 움직이지 않는다.
function improveWithTwoOpt(order: number[], dist: number[][]): number[] {
  const route = [...order];
  const n = route.length;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const before = dist[route[i - 1]][route[i]] + (k + 1 < n ? dist[route[k]][route[k + 1]] : 0);
        const after = dist[route[i - 1]][route[k]] + (k + 1 < n ? dist[route[i]][route[k + 1]] : 0);
        if (after + 1e-6 < before) {
          route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return route;
}

export interface OptimizeResult<T> {
  items: T[];
  changed: boolean;
  savedMeters: number; // 직선거리 기준 줄어든 이동 거리
}

export function optimizeVisitOrder<T extends { place: LatLng }>(items: T[]): OptimizeResult<T> {
  if (items.length < 3) return { items, changed: false, savedMeters: 0 };

  const dist = items.map((a) => items.map((b) => haversineMeters(a.place, b.place)));
  const original = items.map((_, idx) => idx);
  const optimized = improveWithTwoOpt(nearestNeighborOrder(dist), dist);

  const savedMeters = pathLength(original, dist) - pathLength(optimized, dist);
  // 거의 차이가 없으면 사용자가 정한 순서를 존중한다
  if (savedMeters < 50) return { items, changed: false, savedMeters: 0 };

  return { items: optimized.map((idx) => items[idx]), changed: true, savedMeters: Math.round(savedMeters) };
}
