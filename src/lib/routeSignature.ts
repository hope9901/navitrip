export interface PointCoords {
  lat: number;
  lng: number;
}

export interface RouteSignatureInput {
  waypoints: PointCoords[];
  option?: string;
  mode?: string;
  version?: number;
}

/**
 * Rounds coordinate to 5 decimal places for stable caching without tiny precision mismatch
 */
export function normalizeCoord(num: number): string {
  if (!Number.isFinite(num)) return '0.00000';
  return num.toFixed(5);
}

/**
 * Generates a deterministic signature for a day's full route sequence
 */
export function createRouteSignature(input: RouteSignatureInput): string {
  const { waypoints, option = 'trafast', mode = 'driving', version = 1 } = input;
  if (!waypoints || waypoints.length < 2) return '';

  const coordsString = waypoints
    .map((p) => `${normalizeCoord(p.lat)},${normalizeCoord(p.lng)}`)
    .join('_');

  return `sig_v${version}_${mode}_${option}_${coordsString}`;
}

/**
 * Generates a deterministic cache key for a single leg segment (A -> B)
 */
export function createSegmentCacheKey(
  start: PointCoords,
  goal: PointCoords,
  option: string = 'trafast',
  version: number = 1
): string {
  const startStr = `${normalizeCoord(start.lat)},${normalizeCoord(start.lng)}`;
  const goalStr = `${normalizeCoord(goal.lat)},${normalizeCoord(goal.lng)}`;

  return `seg_v${version}_${option}_${startStr}_${goalStr}`;
}
