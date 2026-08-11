export interface Place {
  id: string;
  type?: 'place' | 'address';
  title: string;
  category?: string;
  address: string;
  roadAddress?: string;
  jibunAddress?: string;
  lat: number;
  lng: number;
  link?: string;
  telephone?: string;
  mapx?: string;
  mapy?: string;
  naverMapUrl?: string;
  naverPlaceUrl?: string;
  naverSearchQuery?: string;
}

export interface ItineraryBlock {
  id: string; // unique block instance id
  place: Place;
  note?: string;
  dayIndex: number;
}

export interface RouteSegment {
  fromBlockId?: string;
  toBlockId?: string;
  distanceMeter: number;
  durationSeconds: number;
  formattedDistance: string;
  formattedDuration: string;
  path?: Array<[number, number]>; // [lat, lng]
  isFallback?: boolean;
  source?: 'live' | 'cache' | 'saved' | 'stale-cache' | 'naver' | 'fallback';
  cacheKey?: string;
  calculatedAt?: string;
  expiresAt?: string;
}

export type SavedRouteSummary = {
  routeSignature: string;
  distanceMeter: number;
  durationSeconds: number;
  calculatedAt: string;
  expiresAt: string;
  source?: 'live' | 'cache' | 'saved' | 'stale-cache' | 'fallback';
  segments: RouteSegment[];
};

export interface DayItinerary {
  day: number;
  blocks: ItineraryBlock[];
  savedRoute?: SavedRouteSummary;
}

export type SavedMapView = {
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  bounds?: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
};

export type MapFocusRequest = {
  requestId: number;
  placeId?: string;
  blockId?: string;
  lat: number;
  lng: number;
  title?: string;
  address?: string;
  source: 'marker' | 'sidebar' | 'search';
};

export interface PlanData {
  id?: string;
  title: string;
  authorName?: string;
  manageToken?: string;
  mapView?: SavedMapView;
  days: DayItinerary[];
  createdAt?: string;
  updatedAt?: string;
}
