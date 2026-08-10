'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/common/Header';
import NaverMap from '@/components/map/NaverMap';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import { DayItinerary, ItineraryBlock, Place, RouteSegment } from '@/types/itinerary';
import { loadPlanFromDB } from '@/lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

export default function SharedPlanPage() {
  const params = useParams();
  const planId = (params?.id as string) || '';

  const [planTitle, setPlanTitle] = useState('공유받은 여행 일정');
  const [days, setDays] = useState<DayItinerary[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;

    async function fetchPlan() {
      setLoading(true);
      try {
        const plan = await loadPlanFromDB(planId);
        if (plan) {
          setPlanTitle(plan.title || '공유받은 여행 일정');
          setDays(plan.days || [{ day: 1, blocks: [] }]);
        } else {
          setErrorMsg('해당 일정을 찾을 수 없거나 삭제되었습니다.');
          setDays([{ day: 1, blocks: [] }]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '일정을 불러오는 중 오류가 발생했습니다.';
        console.error('Failed to load plan:', msg);
        setErrorMsg('일정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, [planId]);

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
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-white gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm font-medium text-slate-300">공유받은 여행 일정을 로드하는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      <Header />

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs px-4 py-2 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

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
