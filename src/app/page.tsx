'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import NaverMap from '@/components/map/NaverMap';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import UserNameModal from '@/components/common/UserNameModal';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData } from '@/types/itinerary';

export default function HomePage() {
  const [userName, setUserName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('navitrip_user_name')?.trim() || '';
    }
    return '';
  });

  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('navitrip_user_name')?.trim();
    }
    return false;
  });

  const [isChangeNameMode, setIsChangeNameMode] = useState<boolean>(false);

  const [planTitle, setPlanTitle] = useState('순천만 힐링 여행');
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [authorName, setAuthorName] = useState<string | undefined>(undefined);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const [days, setDays] = useState<DayItinerary[]>([
    {
      day: 1,
      blocks: [],
    },
    {
      day: 2,
      blocks: [],
    },
  ]);

  const handleSaveUserName = (name: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('navitrip_user_name', name);
    }
    setUserName(name);
    setIsUserModalOpen(false);
    setIsChangeNameMode(false);
  };

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

  const handleLoadPlan = (plan: PlanData) => {
    setPlanTitle(plan.title || '불러온 여행 일정');
    setPlanId(plan.id);
    setAuthorName(plan.authorName || '익명');
    if (plan.days && plan.days.length > 0) {
      setDays(plan.days);
      setActiveDayIndex(0);
    }
  };

  const handleNewPlan = () => {
    setPlanTitle('새 여행 일정');
    setPlanId(undefined);
    setAuthorName(userName);
    setDays([
      { day: 1, blocks: [] },
      { day: 2, blocks: [] },
    ]);
    setActiveDayIndex(0);
    setSelectedPlace(null);
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
    authorName,
    userName: userName || '사용자',
    onChangeUserName: () => {
      setIsChangeNameMode(true);
      setIsUserModalOpen(true);
    },
    onPlanSaved: (newId: string) => {
      setPlanId(newId);
      setAuthorName(userName);
    },
    onLoadPlan: handleLoadPlan,
    onNewPlan: handleNewPlan,
  };

  return (
    <main className="relative flex w-screen h-screen overflow-hidden bg-slate-950">
      {/* User Name Entry / Change Modal */}
      <UserNameModal
        isOpen={isUserModalOpen}
        currentName={userName}
        isChangeMode={isChangeNameMode}
        onSaveUserName={handleSaveUserName}
        onClose={() => setIsUserModalOpen(false)}
      />

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
