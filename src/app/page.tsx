'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/common/Header';
import NaverMap from '@/components/map/NaverMap';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import { DayItinerary, ItineraryBlock, Place, RouteSegment } from '@/types/itinerary';

const INITIAL_DAYS: DayItinerary[] = [
  {
    day: 1,
    blocks: [
      {
        id: 'block_sample_1',
        dayIndex: 0,
        place: {
          id: 'place_sample_1',
          title: '속초해수욕장',
          category: '여행 > 해수욕장',
          address: '강원특별자치도 속초시 조양동',
          roadAddress: '강원특별자치도 속초시 해오름로 186',
          lat: 38.1906,
          lng: 128.6033,
          link: 'https://search.naver.com/search.naver?query=속초해수욕장',
        },
      },
      {
        id: 'block_sample_2',
        dayIndex: 0,
        place: {
          id: 'place_sample_2',
          title: '속초관광수산시장 (중앙시장)',
          category: '전통시장',
          address: '강원특별자치도 속초시 중앙동 471-4',
          roadAddress: '강원특별자치도 속초시 중앙로147번길 16',
          lat: 38.2045,
          lng: 128.5901,
          link: 'https://search.naver.com/search.naver?query=속초관광수산시장',
        },
      },
      {
        id: 'block_sample_3',
        dayIndex: 0,
        place: {
          id: 'place_sample_3',
          title: '아바이마을',
          category: '여행 > 명소',
          address: '강원특별자치도 속초시 청호동 1076',
          roadAddress: '강원특별자치도 속초시 아바이마을길 22',
          lat: 38.2012,
          lng: 128.5954,
          link: 'https://search.naver.com/search.naver?query=속초+아바이마을',
        },
      },
    ],
  },
  {
    day: 2,
    blocks: [
      {
        id: 'block_sample_4',
        dayIndex: 1,
        place: {
          id: 'place_sample_4',
          title: '설악산 자생식물원',
          category: '여행 > 수목원',
          address: '강원특별자치도 속초시 바람꽃마을길 164',
          roadAddress: '강원특별자치도 속초시 바람꽃마을길 164',
          lat: 38.1985,
          lng: 128.5385,
          link: 'https://search.naver.com/search.naver?query=설악산+자생식물원',
        },
      },
    ],
  },
];

export default function PlannerPage({ params }: { params?: { id?: string } }) {
  const [planTitle, setPlanTitle] = useState('속초 힐링 1박 2일 여행');
  const [days, setDays] = useState<DayItinerary[]>(INITIAL_DAYS);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [planId, setPlanId] = useState<string | undefined>(params?.id);
  const [routes, setRoutes] = useState<RouteSegment[]>([]);

  const activeDay = days[activeDayIndex] || { day: 1, blocks: [] };

  const currentBlocks = useMemo(
    () => activeDay.blocks || [],
    [activeDay.blocks]
  );

  useEffect(() => {
    let isCancelled = false;

    async function updateRoutes() {
      if (currentBlocks.length < 2) {
        setRoutes([]);
        return;
      }

      const promises = [];
      for (let i = 0; i < currentBlocks.length - 1; i++) {
        const from = currentBlocks[i];
        const to = currentBlocks[i + 1];
        promises.push(
          fetch('/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start: { lat: from.place.lat, lng: from.place.lng },
              goal: { lat: to.place.lat, lng: to.place.lng },
            }),
          })
            .then((r) => r.json())
            .then((d) => ({
              fromBlockId: from.id,
              toBlockId: to.id,
              distanceMeter: d.distanceMeter || 0,
              durationSeconds: d.durationSeconds || 0,
              formattedDistance: d.formattedDistance || '0km',
              formattedDuration: d.formattedDuration || '0분',
              path: d.path || [],
            }))
            .catch(() => ({
              fromBlockId: from.id,
              toBlockId: to.id,
              distanceMeter: 0,
              durationSeconds: 0,
              formattedDistance: '0km',
              formattedDuration: '0분',
              path: [],
            }))
        );
      }

      const res = await Promise.all(promises);
      if (!isCancelled) setRoutes(res);
    }

    updateRoutes();

    return () => {
      isCancelled = true;
    };
  }, [currentBlocks]);

  const handleSelectBlock = (block: ItineraryBlock) => {
    setSelectedPlace(block.place);
  };

  const commonProps = {
    planTitle,
    setPlanTitle,
    days,
    setDays,
    activeDayIndex,
    setActiveDayIndex,
    onSelectBlock: handleSelectBlock,
    routes,
    planId,
    onPlanSaved: (newId: string) => setPlanId(newId),
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      <Header />

      <div className="relative flex flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden">
        <div className="hidden md:block w-[400px] lg:w-[440px] h-full z-10 shrink-0">
          <ItinerarySidebar {...commonProps} />
        </div>

        <div className="flex-1 h-full w-full relative">
          <NaverMap
            blocks={currentBlocks}
            routes={routes}
            selectedPlace={selectedPlace}
            onMarkerClick={handleSelectBlock}
          />
        </div>

        <MobileBottomSheet {...commonProps} />
      </div>
    </div>
  );
}
