'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, SavedMapView } from '@/types/itinerary';
import ItinerarySidebar from './ItinerarySidebar';
import SearchPlacePreviewCard from '../search/SearchPlacePreviewCard';
import SharedItineraryView from './SharedItineraryView';
import { ChevronUp, ChevronDown, Plus, Edit3 } from 'lucide-react';
import { formatDistance, formatDuration } from '@/lib/travelMode';

import { LoadedPlanIdentity, PlanSaveResult } from '@/lib/supabase';

export type MobileSheetState = 'peek' | 'half' | 'full';

const SHEET_STATES: MobileSheetState[] = ['peek', 'half', 'full'];
const DRAG_START_THRESHOLD_PX = 6;
const FLICK_VELOCITY_PX_PER_MS = 0.5;

// 아래 높이 클래스(getHeightClass)와 같은 기준의 픽셀 값
function getSnapHeights(): Record<MobileSheetState, number> {
  const vh = window.innerHeight;
  return { peek: 92, half: Math.round(vh * 0.52), full: vh - 80 };
}

function pickSnapState(height: number, velocity: number): MobileSheetState {
  const snaps = getSnapHeights();
  // 빠르게 튕기면 그 방향의 다음 단계로, 아니면 가장 가까운 단계로
  if (velocity < -FLICK_VELOCITY_PX_PER_MS) {
    return SHEET_STATES.find((state) => snaps[state] > height + 1) ?? 'full';
  }
  if (velocity > FLICK_VELOCITY_PX_PER_MS) {
    return [...SHEET_STATES].reverse().find((state) => snaps[state] < height - 1) ?? 'peek';
  }
  return SHEET_STATES.reduce((best, state) =>
    Math.abs(snaps[state] - height) < Math.abs(snaps[best] - height) ? state : best
  );
}

type SheetDrag = {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number; // px/ms, 양수 = 아래로
  moved: boolean;
};

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
  readOnly?: boolean; // 공유받은 일정 보기 모드 (편집 도구 숨김)
  onStartEditing?: () => void;
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

  // Drag-to-resize (헤더 영역을 끌어 높이 조절, 놓으면 가까운 단계로 스냅)
  // 손가락/커서가 헤더 밖으로 나가도 추적되도록 이동·종료 이벤트는 window 에서 받는다.
  const sheetRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  useEffect(() => () => dragCleanupRef.current?.(), []);

  const clampHeight = (height: number) => {
    const snaps = getSnapHeights();
    return Math.min(snaps.full, Math.max(snaps.peek, height));
  };

  const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragCleanupRef.current?.();
    suppressClickRef.current = false;

    const drag: SheetDrag = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: sheetRef.current?.offsetHeight ?? 0,
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
      moved: false,
    };

    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved) {
        // 일정 거리 이상 움직였을 때만 끌기로 판단해서, 단순 탭은 버튼 클릭으로 그대로 동작
        if (Math.abs(dy) < DRAG_START_THRESHOLD_PX) return;
        drag.moved = true;
      }
      const dt = ev.timeStamp - drag.lastTime;
      if (dt > 0) drag.velocity = (ev.clientY - drag.lastY) / dt;
      drag.lastY = ev.clientY;
      drag.lastTime = ev.timeStamp;
      setDragHeight(clampHeight(drag.startHeight - dy));
    };

    const handleEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      cleanup();
      if (!drag.moved) return;
      suppressClickRef.current = true;
      const finalHeight = clampHeight(drag.startHeight - (ev.clientY - drag.startY));
      setSheetState(pickSnapState(finalHeight, drag.velocity));
      setDragHeight(null);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      dragCleanupRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    dragCleanupRef.current = cleanup;
  };

  const handleHeaderClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

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
    if (sheetState === 'full') return 'h-[calc(100dvh-80px)]'; // 상단 바(MobileTopBar) 아래까지
    return 'h-[52dvh]';
  };

  const cycleSheetState = () => {
    if (sheetState === 'peek') setSheetState('half');
    else if (sheetState === 'half') setSheetState('full');
    else setSheetState('peek');
  };

  return (
    <div
      ref={sheetRef}
      style={dragHeight !== null ? { height: dragHeight } : undefined}
      className={`fixed inset-x-0 bottom-0 z-30 md:hidden flex flex-col bg-slate-950 border-t border-slate-800 shadow-2xl rounded-t-3xl safe-pb ${getHeightClass()} ${
        dragHeight !== null ? '' : 'transition-[height] duration-300 ease-in-out'
      }`}
    >
      {/* Handle & Header (drag area) */}
      <div
        onPointerDown={handleDragPointerDown}
        onClickCapture={handleHeaderClickCapture}
        className="shrink-0 px-4 pb-2 border-b border-slate-900 touch-none select-none"
      >
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

          {props.readOnly ? (
            <button
              type="button"
              onClick={props.onStartEditing}
              className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-emerald-400 text-emerald-950 text-sm font-bold shadow-md active:scale-95 transition-transform"
            >
              <Edit3 className="w-4 h-4" />
              <span>내 일정으로 편집</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={props.onOpenSearch}
              className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-emerald-400 text-emerald-950 text-sm font-bold shadow-md active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
              <span>장소 추가</span>
            </button>
          )}
        </div>
      </div>

      {/* Itinerary Panel */}
      <div className={`flex-1 min-h-0 overflow-hidden ${sheetState === 'peek' && dragHeight === null ? 'hidden' : 'block'}`}>
        {props.readOnly ? (
          <SharedItineraryView
            days={props.days}
            activeDayIndex={props.activeDayIndex}
            setActiveDayIndex={props.setActiveDayIndex}
            routes={props.routes}
            onSelectBlock={props.onSelectBlock}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
