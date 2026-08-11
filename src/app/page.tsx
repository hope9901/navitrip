'use client';

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore, useCallback } from 'react';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import NaverMap, { NaverMapRefHandle } from '@/components/map/NaverMap';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import UserNameModal from '@/components/common/UserNameModal';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, MapFocusRequest } from '@/types/itinerary';
import { createRouteSignature } from '@/lib/routeSignature';

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
  const mapRef = useRef<NaverMapRefHandle>(null);

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
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  const [dayChangeKey, setDayChangeKey] = useState<number>(0);

  const [days, setDays] = useState<DayItinerary[]>([
    { day: 1, blocks: [] },
    { day: 2, blocks: [] },
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
    setPlanId(newId);
  };

  const handleLoadPlan = (loadedPlan: PlanData) => {
    if (loadedPlan.id) setPlanId(loadedPlan.id);
    if (loadedPlan.title) setPlanTitle(loadedPlan.title);
    if (loadedPlan.authorName) setAuthorName(loadedPlan.authorName);
    if (loadedPlan.days && Array.isArray(loadedPlan.days)) {
      setDays(loadedPlan.days);
    }
    setActiveDayIndex(0);
    setSelectedPlace(null);
    setSelectedBlockId(null);
    setDayChangeKey(Date.now());
  };

  const handleNewPlan = () => {
    setPlanId(undefined);
    setAuthorName(userName);
    setPlanTitle('새 여행 일정');
    setDays([
      { day: 1, blocks: [] },
      { day: 2, blocks: [] },
    ]);
    setActiveDayIndex(0);
    setSelectedPlace(null);
    setSelectedBlockId(null);
    setDayChangeKey(Date.now());
  };

  const handleDeleteCurrentActivePlan = () => {
    handleNewPlan();
  };

  if (!isMounted) return null;

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
          planId={planId}
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

      {/* Main Map View Area */}
      <main className="flex-1 relative h-full w-full bg-slate-900 overflow-hidden">
        <NaverMap
          ref={mapRef}
          blocks={currentBlocks}
          routes={routes}
          selectedPlace={selectedPlace}
          selectedBlockId={selectedBlockId}
          focusRequest={focusRequest}
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
          planId={planId}
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
