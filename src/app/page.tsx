'use client';

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import NaverMap from '@/components/map/NaverMap';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import UserNameModal from '@/components/common/UserNameModal';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData } from '@/types/itinerary';

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function HomePage() {
  const isMounted = useIsMounted();
  const [userName, setUserName] = useState<string>('');
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [isChangeNameMode, setIsChangeNameMode] = useState<boolean>(false);

  const [planTitle, setPlanTitle] = useState('순천만 힐링 여행');
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [authorName, setAuthorName] = useState<string | undefined>(undefined);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Camera Focus Priority State
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState<number>(0);
  const [dayChangeKey, setDayChangeKey] = useState<number>(0);

  const [days, setDays] = useState<DayItinerary[]>([
    { day: 1, blocks: [] },
    { day: 2, blocks: [] },
  ]);

  const [fetchedRoutes, setFetchedRoutes] = useState<RouteSegment[]>([]);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Read stored userName on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('navitrip_user_name');
      if (stored && stored.trim()) {
        const timer = setTimeout(() => {
          setUserName(stored.trim());
        }, 0);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setIsUserModalOpen(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);

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

  const routes = useMemo(() => {
    if (currentBlocks.length < 2) return [];
    return fetchedRoutes;
  }, [currentBlocks.length, fetchedRoutes]);

  // Fetch Directions with AbortController to cancel stale requests when day or itinerary changes
  useEffect(() => {
    if (currentBlocks.length < 2) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

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
          signal: controller.signal,
        });

        const data = await res.json();

        if (controller.signal.aborted) return;

        if (!res.ok || data.ok === false) {
          console.warn('[Directions Route Error]:', data);
          setRouteErrorMessage(data.message || '자동차 경로를 불러오지 못했습니다.');
          if (data.routes && Array.isArray(data.routes)) {
            setFetchedRoutes(data.routes);
          } else {
            setFetchedRoutes([]);
          }

          const hideTimer = setTimeout(() => setRouteErrorMessage(null), 5000);
          return () => clearTimeout(hideTimer);
        }

        if (data.routes && Array.isArray(data.routes)) {
          setFetchedRoutes(data.routes);
          if (data.isFallback) {
            setRouteErrorMessage('자동차 경로를 불러오지 못해 직선거리만 표시합니다.');
            const hideTimer = setTimeout(() => setRouteErrorMessage(null), 5000);
            return () => clearTimeout(hideTimer);
          } else {
            setRouteErrorMessage(null);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch directions:', err);
        setRouteErrorMessage('자동차 경로 요청 중 네트워크 오류가 발생했습니다.');
        const hideTimer = setTimeout(() => setRouteErrorMessage(null), 5000);
        return () => clearTimeout(hideTimer);
      }
    }

    fetchRoutes();

    return () => {
      controller.abort();
    };
  }, [currentBlocks]);

  const handleSelectBlock = (block: ItineraryBlock) => {
    setSelectedPlace(block.place);
    setSelectedBlockId(block.id);
    setFocusRequestId((prev) => prev + 1);
  };

  const handleDayChange = (idx: number) => {
    setActiveDayIndex(idx);
    setSelectedPlace(null);
    setSelectedBlockId(null);
    setFetchedRoutes([]);
    setDayChangeKey((prev) => prev + 1);
  };

  const handleLoadPlan = (plan: PlanData) => {
    setPlanTitle(plan.title || '불러온 여행 일정');
    setPlanId(plan.id);
    setAuthorName(plan.authorName || '익명');
    setSelectedPlace(null);
    setSelectedBlockId(null);
    setFetchedRoutes([]);
    if (plan.days && plan.days.length > 0) {
      setDays(plan.days);
      setActiveDayIndex(0);
    }
    setDayChangeKey((prev) => prev + 1);
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
    setSelectedBlockId(null);
    setFetchedRoutes([]);
    setDayChangeKey((prev) => prev + 1);
  };

  const handleDeleteCurrentActivePlan = () => {
    handleNewPlan();
  };

  const commonProps = {
    planTitle,
    setPlanTitle,
    days,
    setDays,
    activeDayIndex,
    setActiveDayIndex: handleDayChange,
    onSelectBlock: handleSelectBlock,
    routes,
    planId,
    authorName,
    userName: isMounted && userName ? userName : '사용자',
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
    onDeleteCurrentActivePlan: handleDeleteCurrentActivePlan,
    routeErrorMessage,
  };

  return (
    <main className="relative flex w-screen h-screen overflow-hidden bg-slate-950">
      {/* User Name Entry / Change Modal */}
      {isMounted && (
        <UserNameModal
          isOpen={isUserModalOpen}
          currentName={userName}
          isChangeMode={isChangeNameMode}
          onSaveUserName={handleSaveUserName}
          onClose={() => setIsUserModalOpen(false)}
        />
      )}

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
          selectedBlockId={selectedBlockId}
          focusRequestId={focusRequestId}
          dayChangeKey={dayChangeKey}
          onMarkerClick={handleSelectBlock}
          routeErrorMessage={routeErrorMessage}
        />
      </section>

      {/* Mobile Bottom Sheet */}
      <MobileBottomSheet {...commonProps} />
    </main>
  );
}
