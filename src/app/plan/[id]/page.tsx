'use client';

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import NaverMap, { NaverMapRefHandle } from '@/components/map/NaverMap';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import UserNameModal from '@/components/common/UserNameModal';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, MapFocusRequest } from '@/types/itinerary';
import { loadPlanFromDB } from '@/lib/supabase';
import { createRouteSignature } from '@/lib/routeSignature';
import RouteSummaryCard from '@/components/itinerary/RouteSummaryCard';
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
  const [routeSource, setRouteSource] = useState<'live' | 'cache' | 'saved' | 'stale-cache' | 'fallback' | null>(null);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);
  const [isRefreshingRoute, setIsRefreshingRoute] = useState<boolean>(false);
  const [refreshCooldownSeconds, setRefreshCooldownSeconds] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cooldown timer effect
  useEffect(() => {
    if (refreshCooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldownSeconds]);

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

  // Fetch or Restore Directions with Caching & 800ms Debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (currentBlocks.length < 2) {
      const timer = setTimeout(() => {
        setFetchedRoutes([]);
        setRouteSource(null);
        setCalculatedAt(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const waypoints = currentBlocks.map((b) => ({
      lat: b.place.lat,
      lng: b.place.lng,
    }));
    const currentSig = createRouteSignature({ waypoints, option: 'trafast', mode: 'driving', version: 1 });

    // Step 1: Check if activeDay has a valid savedRoute summary matching signature
    if (activeDay.savedRoute && activeDay.savedRoute.routeSignature === currentSig && activeDay.savedRoute.segments) {
      const saved = activeDay.savedRoute;
      queueMicrotask(() => {
        setFetchedRoutes(saved.segments);
        setRouteSource(saved.source || 'saved');
        setCalculatedAt(saved.calculatedAt || new Date().toISOString());
        setRouteErrorMessage(null);
      });
      return;
    }

    // Step 2: 800ms Debounced API call to /api/directions
    const controller = new AbortController();
    abortControllerRef.current = controller;

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waypoints, forceRefresh: false }),
          signal: controller.signal,
        });

        const data = await res.json();

        if (controller.signal.aborted) return;

        if (!res.ok || data.ok === false) {
          console.warn('[Directions Route Error]:', data);
          setRouteErrorMessage(data.message || '자동차 경로를 불러오지 못했습니다.');
          if (data.routes && Array.isArray(data.routes)) {
            setFetchedRoutes(data.routes);
            setRouteSource(data.source || 'fallback');
          } else {
            setFetchedRoutes([]);
            setRouteSource(null);
          }

          const hideTimer = setTimeout(() => setRouteErrorMessage(null), 5000);
          return () => clearTimeout(hideTimer);
        }

        if (data.routes && Array.isArray(data.routes)) {
          setFetchedRoutes(data.routes);
          setRouteSource(data.source || 'live');
          setCalculatedAt(data.calculatedAt || new Date().toISOString());

          if (data.source === 'stale-cache') {
            setRouteErrorMessage('최신 경로를 불러오지 못해 이전 계산 결과를 표시합니다.');
            const hideTimer = setTimeout(() => setRouteErrorMessage(null), 5000);
            return () => clearTimeout(hideTimer);
          } else if (data.isFallback) {
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
    }, 800);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      controller.abort();
    };
  }, [currentBlocks, activeDay.savedRoute]);

  // Manual Force Refresh Route Handler
  const handleForceRefreshRoute = useCallback(async () => {
    if (currentBlocks.length < 2 || isRefreshingRoute || refreshCooldownSeconds > 0) return;

    setIsRefreshingRoute(true);
    setRefreshCooldownSeconds(60); // 60s cooldown

    try {
      const waypoints = currentBlocks.map((b) => ({
        lat: b.place.lat,
        lng: b.place.lng,
      }));

      const res = await fetch('/api/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints, forceRefresh: true }),
      });

      const data = await res.json();

      if (data.ok && data.routes && Array.isArray(data.routes)) {
        setFetchedRoutes(data.routes);
        setRouteSource('live');
        setCalculatedAt(data.calculatedAt || new Date().toISOString());
        setRouteErrorMessage(null);

        // Update activeDay's savedRoute
        const totalDist = data.routes.reduce((acc: number, r: RouteSegment) => acc + (r.distanceMeter || 0), 0);
        const totalDur = data.routes.reduce((acc: number, r: RouteSegment) => acc + (r.durationSeconds || 0), 0);
        const currentSig = createRouteSignature({ waypoints, option: 'trafast', mode: 'driving', version: 1 });

        setDays((prevDays) =>
          prevDays.map((d, idx) => {
            if (idx === activeDayIndex) {
              return {
                ...d,
                savedRoute: {
                  routeSignature: currentSig,
                  distanceMeter: totalDist,
                  durationSeconds: totalDur,
                  calculatedAt: data.calculatedAt || new Date().toISOString(),
                  expiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  source: 'live',
                  segments: data.routes,
                },
              };
            }
            return d;
          })
        );
      } else {
        setRouteErrorMessage(data.message || '경로 재계산에 실패했습니다.');
        setTimeout(() => setRouteErrorMessage(null), 4000);
      }
    } catch (err) {
      console.error('Failed to force refresh route:', err);
      setRouteErrorMessage('경로 재계산 중 오류가 발생했습니다.');
      setTimeout(() => setRouteErrorMessage(null), 4000);
    } finally {
      setIsRefreshingRoute(false);
    }
  }, [currentBlocks, isRefreshingRoute, refreshCooldownSeconds, activeDayIndex]);

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

  const handleSelectSearchPlace = (place: Place) => {
    setSelectedPlace(place);
    setSelectedBlockId(null);
    setFocusRequest({
      requestId: Date.now(),
      placeId: place.id,
      lat: place.lat,
      lng: place.lng,
      title: place.title,
      address: place.roadAddress || place.address,
      source: 'search',
    });
  };

  const handleActiveDayChange = (idx: number) => {
    setActiveDayIndex(idx);
    setSelectedPlace(null);
    setSelectedBlockId(null);
    setDayChangeKey(Date.now());
  };

  const handlePlanSaved = (newId: string) => {
    if (newId !== currentPlanId) {
      setCurrentPlanId(newId);
      router.replace(`/plan/${newId}`);
    }
  };

  const handleLoadPlan = (newPlan: PlanData) => {
    if (newPlan.id && newPlan.id !== currentPlanId) {
      setCurrentPlanId(newPlan.id);
      router.push(`/plan/${newPlan.id}`);
    } else {
      if (newPlan.title) setPlanTitle(newPlan.title);
      if (newPlan.authorName) setAuthorName(newPlan.authorName);
      if (newPlan.days && Array.isArray(newPlan.days)) {
        setDays(newPlan.days);
      }
      setActiveDayIndex(0);
      setSelectedPlace(null);
      setSelectedBlockId(null);
      setDayChangeKey(Date.now());
    }
  };

  const handleNewPlan = () => {
    router.push('/');
  };

  const handleDeleteCurrentActivePlan = () => {
    router.push('/');
  };

  if (!isMounted) return null;

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">공유받은 여행 일정을 불러오는 중...</p>
      </div>
    );
  }

  if (error || !loadedPlan) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center text-center gap-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <h3 className="text-lg font-bold text-slate-100">일정을 불러올 수 없습니다</h3>
          <p className="text-xs text-slate-400">{error || '존재하지 않는 일정이거나 삭제되었을 수 있습니다.'}</p>
          <Link
            href="/"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md mt-2"
          >
            새 일정 작성하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] min-h-[100svh] w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Desktop Left Sidebar Panel */}
      <aside className="hidden md:flex w-[420px] lg:w-[460px] flex-col border-r border-slate-800/80 bg-slate-950 z-20 shrink-0 shadow-2xl">
        <ItinerarySidebar
          planTitle={planTitle}
          setPlanTitle={setPlanTitle}
          days={days}
          setDays={setDays}
          activeDayIndex={activeDayIndex}
          setActiveDayIndex={handleActiveDayChange}
          onSelectBlock={handleSelectBlock}
          routes={routes}
          planId={currentPlanId}
          authorName={authorName}
          userName={userName}
          onChangeUserName={() => setIsChangeNameMode(true)}
          onPlanSaved={handlePlanSaved}
          onLoadPlan={handleLoadPlan}
          onNewPlan={handleNewPlan}
          onDeleteCurrentActivePlan={handleDeleteCurrentActivePlan}
          onRequestMapView={() => mapRef.current?.getMapView() || null}
        />
      </aside>

      {/* Mobile Dedicated Route Summary Card (Normal document flow, visible on mobile only) */}
      <div className="shrink-0 md:hidden w-full z-10">
        <RouteSummaryCard
          routes={routes}
          routeSource={routeSource}
          calculatedAt={calculatedAt}
          onForceRefreshRoute={handleForceRefreshRoute}
          isRefreshingRoute={isRefreshingRoute}
          refreshCooldownSeconds={refreshCooldownSeconds}
          variant="mobile"
          blockCount={currentBlocks.length}
        />
      </div>

      {/* Main Map View Area */}
      <main className="flex-1 relative h-full w-full bg-slate-900 overflow-hidden">
        <NaverMap
          ref={mapRef}
          blocks={currentBlocks}
          routes={routes}
          selectedPlace={selectedPlace}
          selectedBlockId={selectedBlockId}
          focusRequest={focusRequest}
          initialMapView={loadedPlan.mapView}
          dayChangeKey={dayChangeKey}
          onMarkerClick={handleSelectBlock}
          routeErrorMessage={routeErrorMessage}
          routeSource={routeSource}
          calculatedAt={calculatedAt}
          onForceRefreshRoute={handleForceRefreshRoute}
          isRefreshingRoute={isRefreshingRoute}
          refreshCooldownSeconds={refreshCooldownSeconds}
        />
      </main>

      {/* Mobile Drawer */}
      <div className="md:hidden">
        <MobileBottomSheet
          planTitle={planTitle}
          setPlanTitle={setPlanTitle}
          days={days}
          setDays={setDays}
          activeDayIndex={activeDayIndex}
          setActiveDayIndex={handleActiveDayChange}
          onSelectBlock={handleSelectBlock}
          routes={routes}
          planId={currentPlanId}
          authorName={authorName}
          userName={userName}
          onChangeUserName={() => setIsChangeNameMode(true)}
          onPlanSaved={handlePlanSaved}
          onLoadPlan={handleLoadPlan}
          onNewPlan={handleNewPlan}
          onDeleteCurrentActivePlan={handleDeleteCurrentActivePlan}
          onRequestMapView={() => mapRef.current?.getMapView() || null}
          onSelectSearchPlace={handleSelectSearchPlace}
        />
      </div>

      {/* User Name Entrance / Edit Modal */}
      <UserNameModal
        isOpen={isUserModalOpen || isChangeNameMode}
        currentName={userName}
        isChangeMode={isChangeNameMode}
        onSaveUserName={handleSaveUserName}
        onClose={isChangeNameMode ? () => setIsChangeNameMode(false) : undefined}
      />
    </div>
  );
}
