'use client';

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import NaverMap, { NaverMapRefHandle } from '@/components/map/NaverMap';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import UserNameModal from '@/components/common/UserNameModal';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, MapFocusRequest } from '@/types/itinerary';
import { loadPlanFromDB } from '@/lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

interface PlanPageProps {
  params: Promise<{ id: string }>;
}

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function SharedPlanPage({ params }: PlanPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const initialPlanId = resolvedParams.id;
  const isMounted = useIsMounted();
  const mapRef = useRef<NaverMapRefHandle>(null);

  const [currentPlanId, setCurrentPlanId] = useState<string>(initialPlanId);
  const [loadedPlan, setLoadedPlan] = useState<PlanData | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [isChangeNameMode, setIsChangeNameMode] = useState<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planTitle, setPlanTitle] = useState('공유받은 여행 일정');
  const [authorName, setAuthorName] = useState<string | undefined>(undefined);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Camera Focus Priority State
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  const [dayChangeKey, setDayChangeKey] = useState<number>(0);

  const [days, setDays] = useState<DayItinerary[]>([
    { day: 1, blocks: [] },
  ]);

  const [fetchedRoutes, setFetchedRoutes] = useState<RouteSegment[]>([]);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Check user identification on client mount
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

  useEffect(() => {
    async function loadPlan() {
      if (!currentPlanId) return;
      setLoading(true);
      try {
        const fetchedPlan = await loadPlanFromDB(currentPlanId);
        if (fetchedPlan) {
          setLoadedPlan(fetchedPlan);
          setPlanTitle(fetchedPlan.title || '공유받은 여행 일정');
          setAuthorName(fetchedPlan.authorName || '익명');
          if (fetchedPlan.days && fetchedPlan.days.length > 0) {
            setDays(fetchedPlan.days);
          }
        } else {
          setError('해당 일정을 찾을 수 없습니다.');
        }
      } catch (err: unknown) {
        console.error('Failed to load plan:', err);
        setError('일정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, [currentPlanId]);

  const activeDay = days[activeDayIndex] || { day: 1, blocks: [] };
  const currentBlocks = useMemo(() => activeDay.blocks || [], [activeDay.blocks]);

  const routes = useMemo(() => {
    if (currentBlocks.length < 2) return [];
    return fetchedRoutes;
  }, [currentBlocks.length, fetchedRoutes]);

  // Fetch Directions with AbortController
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
    setFocusRequest({
      requestId: Date.now(),
      placeId: block.place.id,
      blockId: block.id,
      lat: block.place.lat,
      lng: block.place.lng,
      title: block.place.title,
      address: block.place.roadAddress || block.place.address,
      source: 'sidebar',
    });
  };

  const handleDayChange = (idx: number) => {
    setActiveDayIndex(idx);
    setSelectedPlace(null);
    setSelectedBlockId(null);
    setFocusRequest(null);
    setFetchedRoutes([]);
    setDayChangeKey((prev) => prev + 1);
  };

  const handleLoadPlan = (plan: PlanData) => {
    setLoadedPlan(plan);
    setPlanTitle(plan.title || '불러온 여행 일정');
    if (plan.id) setCurrentPlanId(plan.id);
    setAuthorName(plan.authorName || '익명');
    setSelectedPlace(null);
    setSelectedBlockId(null);
    setFocusRequest(null);
    setFetchedRoutes([]);
    if (plan.days && plan.days.length > 0) {
      setDays(plan.days);
      setActiveDayIndex(0);
    }
    setDayChangeKey((prev) => prev + 1);
  };

  const handleNewPlan = () => {
    router.push('/');
  };

  const handlePlanSaved = (newId: string) => {
    setCurrentPlanId(newId);
    setAuthorName(userName);
    router.replace(`/plan/${newId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-slate-950 text-white gap-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-medium text-slate-300">여행 일정을 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-slate-950 text-white p-4 text-center gap-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <span className="text-sm text-rose-200">{error}</span>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
        >
          새 일정 만들러 가기 ➔
        </Link>
      </div>
    );
  }

  const commonProps = {
    planTitle,
    setPlanTitle,
    days,
    setDays,
    activeDayIndex,
    setActiveDayIndex: handleDayChange,
    onSelectBlock: handleSelectBlock,
    routes,
    planId: currentPlanId,
    authorName,
    userName: isMounted && userName ? userName : '사용자',
    onChangeUserName: () => {
      setIsChangeNameMode(true);
      setIsUserModalOpen(true);
    },
    onPlanSaved: handlePlanSaved,
    onLoadPlan: handleLoadPlan,
    onNewPlan: handleNewPlan,
    onDeleteCurrentActivePlan: () => router.push('/'),
    onRequestMapView: () => mapRef.current?.getMapView() || null,
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
          ref={mapRef}
          blocks={currentBlocks}
          routes={routes}
          selectedPlace={selectedPlace}
          selectedBlockId={selectedBlockId}
          focusRequest={focusRequest}
          initialMapView={loadedPlan?.mapView || null}
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
