'use client';

import React, { useState } from 'react';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, SavedMapView } from '@/types/itinerary';
import ItinerarySidebar from './ItinerarySidebar';
import SearchPlacePreviewCard from '../search/SearchPlacePreviewCard';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { formatDistance, formatDuration } from '@/lib/travelMode';

import { LoadedPlanIdentity, PlanSaveResult } from '@/lib/supabase';

export type MobileSheetState = 'peek' | 'half' | 'full';

interface MobileBottomSheetProps {
  planTitle: string;
  setPlanTitle: (title: string) => void;
  days: DayItinerary[];
  setDays: React.Dispatch<React.SetStateAction<DayItinerary[]>>;
  activeDayIndex: number;
  setActiveDayIndex: (idx: number) => void;
  onSelectBlock: (block: ItineraryBlock) => void;
  routes: RouteSegment[];
  drivingRoutes?: RouteSegment[];
  planId?: string;
  authorName?: string;
  userName?: string;
  onChangeUserName?: () => void;
  onPlanSaved?: (result: PlanSaveResult) => void;
  onLoadPlan?: (plan: PlanData) => void;
  onNewPlan?: () => void;
  onDeleteCurrentActivePlan?: () => void;
  onRequestMapView?: () => SavedMapView | null;
  onOpenSearch: () => void;
  onReturnToSearch: () => void;
  selectedSearchPlace?: Place | null;
  onClearSelectedSearchPlace?: () => void;
  onAddPlaceFromSearch?: (place: Place) => void;
  mobileSheetState?: MobileSheetState;
  setMobileSheetState?: (state: MobileSheetState) => void;
  loadedPlanIdentity?: LoadedPlanIdentity | null;
}

/**
 * 모바일 하단 시트: 일정 보기/편집 전용.
 * 장소 검색은 전체 화면(MobileSearchScreen)으로 분리되어 있고,
 * 검색 결과를 지도에서 확인하는 동안에는 시트 대신 미리보기 카드를 보여준다.
 */
export default function MobileBottomSheet(props: MobileBottomSheetProps) {
  const [internalState, setInternalState] = useState<MobileSheetState>('half');

  const sheetState = props.mobileSheetState !== undefined ? props.mobileSheetState : internalState;
  const setSheetState = props.setMobileSheetState || setInternalState;

  const currentDayBlocks = props.days[props.activeDayIndex]?.blocks || [];
  const currentDayPlaceIds = currentDayBlocks.map((b) => b.place.id);

  const totalDistance = props.routes.reduce((acc, r) => acc + (r.distanceMeter || 0), 0);
  const totalDuration = props.routes.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
  const summary =
    currentDayBlocks.length === 0
      ? '아직 장소가 없어요'
      : props.routes.length > 0
      ? `${currentDayBlocks.length}곳 · ${formatDistance(totalDistance)} · ${formatDuration(Math.ceil(totalDuration / 60) * 60)}`
      : `${currentDayBlocks.length}곳`;

  // Search result preview mode (map focused on a search result)
  if (props.selectedSearchPlace) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 md:hidden rounded-t-3xl overflow-hidden border-t border-slate-800 shadow-2xl">
        <SearchPlacePreviewCard
          place={props.selectedSearchPlace}
          onAddPlace={(place) => props.onAddPlaceFromSearch?.(place)}
          isAlreadyAdded={currentDayPlaceIds.includes(props.selectedSearchPlace.id)}
          onReturnToSearch={props.onReturnToSearch}
          onClose={props.onClearSelectedSearchPlace}
        />
      </div>
    );
  }

  const getHeightClass = () => {
    if (sheetState === 'peek') return 'h-[92px]';
    if (sheetState === 'full') return 'h-[calc(100dvh-54px)]';
    return 'h-[52dvh]';
  };

  const cycleSheetState = () => {
    if (sheetState === 'peek') setSheetState('half');
    else if (sheetState === 'half') setSheetState('full');
    else setSheetState('peek');
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-[height] duration-300 ease-in-out flex flex-col bg-slate-950 border-t border-slate-800 shadow-2xl rounded-t-3xl safe-pb ${getHeightClass()}`}
    >
      {/* Handle & Header */}
      <div className="shrink-0 px-4 pb-2 border-b border-slate-900">
        <button
          type="button"
          onClick={() => setSheetState(sheetState === 'peek' ? 'half' : 'peek')}
          aria-label={sheetState === 'peek' ? '일정 목록 펼치기' : '일정 목록 접기'}
          aria-expanded={sheetState !== 'peek'}
          className="w-full h-6 flex items-center justify-center"
        >
          <span className="w-10 h-1.5 bg-slate-700 rounded-full" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleSheetState}
            aria-label={sheetState === 'full' ? '일정 목록 접기' : '일정 목록 더 펼치기'}
            className="flex-1 min-w-0 min-h-[48px] flex items-center gap-2 text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-100">Day {props.activeDayIndex + 1} 일정</div>
              <div className="text-xs text-slate-400 truncate">{summary}</div>
            </div>
            {sheetState === 'full' ? (
              <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
            ) : (
              <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={props.onOpenSearch}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-emerald-400 text-emerald-950 text-sm font-bold shadow-md active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>장소 추가</span>
          </button>
        </div>
      </div>

      {/* Itinerary Panel */}
      <div className={`flex-1 min-h-0 overflow-hidden ${sheetState === 'peek' ? 'hidden' : 'block'}`}>
        <ItinerarySidebar
          planTitle={props.planTitle}
          setPlanTitle={props.setPlanTitle}
          days={props.days}
          setDays={props.setDays}
          activeDayIndex={props.activeDayIndex}
          setActiveDayIndex={props.setActiveDayIndex}
          onSelectBlock={props.onSelectBlock}
          routes={props.routes}
          drivingRoutes={props.drivingRoutes}
          planId={props.planId}
          authorName={props.authorName}
          userName={props.userName}
          onChangeUserName={props.onChangeUserName}
          onPlanSaved={props.onPlanSaved}
          onLoadPlan={props.onLoadPlan}
          onNewPlan={props.onNewPlan}
          onDeleteCurrentActivePlan={props.onDeleteCurrentActivePlan}
          onRequestMapView={props.onRequestMapView}
          isMobileMode={true}
          loadedPlanIdentity={props.loadedPlanIdentity}
        />
      </div>
    </div>
  );
}
