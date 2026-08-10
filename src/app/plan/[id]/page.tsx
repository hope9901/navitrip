'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import ItinerarySidebar from '@/components/itinerary/ItinerarySidebar';
import NaverMap from '@/components/map/NaverMap';
import MobileBottomSheet from '@/components/itinerary/MobileBottomSheet';
import UserNameModal from '@/components/common/UserNameModal';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData } from '@/types/itinerary';
import { loadPlanFromDB } from '@/lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

interface PlanPageProps {
  params: Promise<{ id: string }>;
}

export default function SharedPlanPage({ params }: PlanPageProps) {
  const resolvedParams = use(params);
  const planId = resolvedParams.id;

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planTitle, setPlanTitle] = useState('공유받은 여행 일정');
  const [authorName, setAuthorName] = useState<string | undefined>(undefined);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const [days, setDays] = useState<DayItinerary[]>([
    { day: 1, blocks: [] },
  ]);

  const [fetchedRoutes, setFetchedRoutes] = useState<RouteSegment[]>([]);

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
      if (!planId) return;
      setLoading(true);
      try {
        const fetchedPlan = await loadPlanFromDB(planId);
        if (fetchedPlan) {
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
  }, [planId]);

  const activeDay = days[activeDayIndex] || { day: 1, blocks: [] };
  const currentBlocks = useMemo(() => activeDay.blocks || [], [activeDay.blocks]);

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
    setAuthorName(plan.authorName || '익명');
    if (plan.days && plan.days.length > 0) {
      setDays(plan.days);
      setActiveDayIndex(0);
    }
  };

  const handleNewPlan = () => {
    setPlanTitle('새 여행 일정');
    setAuthorName(userName);
    setDays([
      { day: 1, blocks: [] },
      { day: 2, blocks: [] },
    ]);
    setActiveDayIndex(0);
    setSelectedPlace(null);
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
