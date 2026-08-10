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
}

export interface DayItinerary {
  day: number;
  blocks: ItineraryBlock[];
}

export interface PlanData {
  id?: string;
  title: string;
  days: DayItinerary[];
  createdAt?: string;
  updatedAt?: string;
}
