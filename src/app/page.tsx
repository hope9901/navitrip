'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import NaverMap from '@/components/map/NaverMap';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import { Place, ItineraryBlock, DayItinerary, RouteSegment } from '@/types/itinerary';

export default function HomePage() {
  const [planTitle, setPlanTitle] = useState('제주도 2박3일 힐링 여행');
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const [days, setDays] = useState<DayItinerary[]>([
    {
      day: 1,
      blocks: [
        {
          id: 'b1',
          place: {
            id: 'p1',
            title: '제주국제공항',
            category: '공항',
            address: '제주특별자치도 제주시 공항로 2',
            roadAddress: '제주특별자치도 제주시 공항로 2',
            lat: 33.5066,
            lng: 126.4928,
          },
          dayIndex: 0,
        },
        {
          id: 'b2',
          place: {
            id: 'p2',
            title: '함덕해수욕장',
            category: '해수욕장',
            address: '제주특별자치도 제주시 조천읍 함덕리 1004-10',
            roadAddress: '제주특별자치도 제주시 조천읍 조함해안로 525',
            lat: 33.5432,
            lng: 126.6692,
          },
          dayIndex: 0,
        },
      ],
    },
    {
      day: 2,
      blocks: [],
    },
    {
      day: 3,
      blocks: [],
    },
  ]);

  const activeDay = days[activeDayIndex] || { day: 1, blocks: [] };
  const currentBlocks = useMemo(() => activeDay.blocks || [], [activeDay.blocks]);

  const [fetchedRoutes, setFetchedRoutes] = useState<RouteSegment[]>([]);

  const routes = useMemo(() => {
    if (currentBlocks.length < 2) return [];
    return fetchedRoutes;
  }, [currentBlocks.length, fetchedRoutes]);

  useEffect(() => {
    if (currentBlocks.length < 2) return;

    let isSubscribed = true;
    async function fetchRoutes() {
      try {
        const waypoints = currentBlocks.map((b) => ({
          lat: b.place.lat,
          lng: b.place.lng,
        }));

        const res = await fetch('/api/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waypoints }),
        });

        const data = await res.json();
        if (isSubscribed && data.routes) {
          setFetchedRoutes(data.routes);
        }
      } catch (err: unknown) {
        console.error('Failed to fetch directions:', err);
      }
    }

    fetchRoutes();

    return () => {
      isSubscribed = false;
    };
  }, [currentBlocks]);

  const handleSelectBlock = (block: ItineraryBlock) => {
    setSelectedPlace(block.place);
  };

  const handleRegionFound = (center: { lat: number; lng: number }) => {
    setSelectedPlace({
      id: `region_${Date.now()}`,
      title: '검색 위치',
      address: '',
      lat: center.lat,
      lng: center.lng,
    });
  };

  const commonProps = {
    planTitle,
    setPlanTitle,
    days,
    setDays,
    activeDayIndex,
    setActiveDayIndex,
    onSelectBlock: handleSelectBlock,
    onRegionFound: handleRegionFound,
    routes,
    planId,
    onPlanSaved: (newId: string) => setPlanId(newId),
  };

  return (
    <main className="relative flex w-screen h-screen overflow-hidden bg-slate-950">
      {/* Desktop Sidebar Left */}
      <aside className="hidden md:block w-96 lg:w-[420px] h-full shrink-0 z-20 shadow-2xl">
        <ItinerarySidebar {...commonProps} />
      </aside>

      {/* Main Naver Map Section */}
      <section className="flex-1 h-full relative z-10">
        <NaverMap
          blocks={currentBlocks}
          routes={routes}
          selectedPlace={selectedPlace}
          onMarkerClick={handleSelectBlock}
        />
      </section>

      {/* Mobile Bottom Sheet */}
      <MobileBottomSheet {...commonProps} />
    </main>
  );
}
