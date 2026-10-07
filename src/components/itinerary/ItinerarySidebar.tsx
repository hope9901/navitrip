'use client';

import React, { useState, useId } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, SavedMapView, TravelMode } from '@/types/itinerary';
import { estimateWalkingSegment } from '@/lib/travelMode';
import SortableBlockItem from './SortableBlockItem';
import SavedPlansModals from './SavedPlansModals';
import { usePlanActions } from './usePlanActions';
import PlaceSearchCard from '../search/PlaceSearchCard';
import {
  Plus,
  Share2,
  Calendar,
  MapPin,
  Navigation,
  Check,
  Sparkles,
  Save,
  FolderOpen,
  FolderPlus,
  User,
  Edit3,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { LoadedPlanIdentity, PlanSaveResult } from '@/lib/supabase';

interface ItinerarySidebarProps {
  planTitle: string;
  setPlanTitle: (title: string) => void;
  days: DayItinerary[];
  setDays: React.Dispatch<React.SetStateAction<DayItinerary[]>>;
  activeDayIndex: number;
  setActiveDayIndex: (idx: number) => void;
  onSelectBlock: (block: ItineraryBlock) => void;
  routes: RouteSegment[];
  drivingRoutes?: RouteSegment[]; // 이동 수단 선택 반영 전 자동차 경로 (저장 및 차량/도보 비교용)
  planId?: string;
  authorName?: string;
  userName?: string;
  onChangeUserName?: () => void;
  onPlanSaved?: (result: PlanSaveResult) => void;
  onLoadPlan?: (plan: PlanData) => void;
  onNewPlan?: () => void;
  onDeleteCurrentActivePlan?: () => void;
  onRequestMapView?: () => SavedMapView | null;
  onSelectSearchPlace?: (place: Place) => void;
  isMobileMode?: boolean;
  loadedPlanIdentity?: LoadedPlanIdentity | null;
}

export default function ItinerarySidebar({
  planTitle,
  setPlanTitle,
  days,
  setDays,
  activeDayIndex,
  setActiveDayIndex,
  onSelectBlock,
  routes,
  drivingRoutes,
  planId,
  authorName,
  userName = '사용자',
  onChangeUserName,
  onPlanSaved,
  onLoadPlan,
  onNewPlan,
  onDeleteCurrentActivePlan,
  onRequestMapView,
  onSelectSearchPlace,
  isMobileMode = false,
  loadedPlanIdentity,
}: ItinerarySidebarProps) {
  const titleInputId = useId();
  const dndContextId = useId();

  const [pendingDeleteDayIdx, setPendingDeleteDayIdx] = useState<number | null>(null);

  const planActions = usePlanActions({
    planTitle,
    setPlanTitle,
    days,
    setDays,
    activeDayIndex,
    setActiveDayIndex,
    routes,
    drivingRoutes,
    planId,
    authorName,
    userName,
    onPlanSaved,
    onLoadPlan,
    onNewPlan,
    onDeleteCurrentActivePlan,
    onRequestMapView,
    loadedPlanIdentity,
  });
  const {
    isAdmin,
    isSaving,
    copiedShareUrl,
    isJustSaved,
    saveMessage,
    titleError,
    setTitleError,
    isTitleChanged,
    isSharedOriginal,
    saveButtonLabel,
    executeSaveOrShare,
    handleOpenLoadModal,
  } = planActions;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentDay = days[activeDayIndex] || { day: 1, blocks: [] };
  const blocks = currentDay.blocks || [];

  const handleAddPlace = (place: Place) => {
    const newBlock: ItineraryBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      place,
      dayIndex: activeDayIndex,
    };
    setDays((prev) => {
      const next = [...prev];
      const targetDay = next[activeDayIndex] || { day: activeDayIndex + 1, blocks: [] };
      next[activeDayIndex] = {
        ...targetDay,
        blocks: [...(targetDay.blocks || []), newBlock],
      };
      return next;
    });

    onSelectBlock(newBlock);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((item) => item.id === active.id);
    const newIndex = blocks.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(blocks, oldIndex, newIndex);
      setDays((prev) => {
        const next = [...prev];
        next[activeDayIndex] = { ...next[activeDayIndex], blocks: reordered };
        return next;
      });
    }
  };

  const handleRemoveBlock = (blockId: string) => {
    setDays((prev) => {
      const next = [...prev];
      next[activeDayIndex] = {
        ...next[activeDayIndex],
        blocks: next[activeDayIndex].blocks.filter((b) => b.id !== blockId),
      };
      return next;
    });
  };

  const handleChangeTravelMode = (blockId: string, mode: TravelMode) => {
    setDays((prev) => {
      const next = [...prev];
      next[activeDayIndex] = {
        ...next[activeDayIndex],
        blocks: next[activeDayIndex].blocks.map((b) => (b.id === blockId ? { ...b, travelModeToNext: mode } : b)),
      };
      return next;
    });
  };

  const handleAddDay = () => {
    setDays((prev) => [
      ...prev,
      {
        day: prev.length + 1,
        blocks: [],
      },
    ]);
    setActiveDayIndex(days.length);
    setPendingDeleteDayIdx(null);
  };

  const handleRemoveDay = (dayIdx: number) => {
    if (days.length <= 1) return;
    setDays((prev) => {
      const filtered = prev.filter((_, idx) => idx !== dayIdx);
      return filtered.map((d, i) => ({ ...d, day: i + 1 }));
    });
    if (activeDayIndex >= days.length - 1) {
      setActiveDayIndex(Math.max(0, days.length - 2));
    }
    setPendingDeleteDayIdx(null);
  };

  const handleDayTabClick = (idx: number) => {
    if (pendingDeleteDayIdx === idx) {
      handleRemoveDay(idx);
      return;
    }

    if (activeDayIndex === idx && days.length > 1) {
      setPendingDeleteDayIdx(idx);
    } else {
      setActiveDayIndex(idx);
      setPendingDeleteDayIdx(null);
    }
  };

  const totalDayDistance = routes.reduce((acc, r) => acc + (r.distanceMeter || 0), 0);
  const totalDayDurationSec = routes.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);

  return (
    <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border-r border-slate-800 text-slate-100 p-4 gap-3 overflow-hidden relative">
      {/* 1. Plan Toolbar & Title (모바일에서는 상단 바와 ⋯ 메뉴로 대체) */}
      {!isMobileMode && (
        <>
      {/* 1. Top Toolbar Action Buttons Row (가장 상단) */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {/* User Badge (with Admin mode support) */}
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold text-xs shrink-0 ${
              isAdmin
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-md'
                : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            }`}
          >
            {isAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <User className="w-3 h-3 shrink-0 text-emerald-400" />
            )}
            <span className="max-w-[80px] truncate">{isAdmin ? '👑 ADMIN' : userName}</span>
            {onChangeUserName && (
              <button
                type="button"
                onClick={onChangeUserName}
                className="p-0.5 text-slate-400 hover:text-white transition-colors"
                title="사용자 이름 변경"
              >
                <Edit3 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {onNewPlan && (
            <button
              type="button"
              onClick={onNewPlan}
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 transition-all shrink-0 active:scale-95"
              title="새 일정 만들기"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>새 일정</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenLoadModal}
            className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 transition-all shrink-0 active:scale-95"
            title="저장된 일정 불러오기"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>불러오기</span>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => executeSaveOrShare('save')}
            disabled={isSaving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all shrink-0 active:scale-95"
            title={saveButtonLabel}
          >
            {isJustSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{saveButtonLabel}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>{saveButtonLabel}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => executeSaveOrShare('share')}
            disabled={isSaving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 active:scale-95"
            title="공유 링크 생성"
          >
            {copiedShareUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>복사완료</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>공유</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Plan Title Input & Badges */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <div className="relative w-full flex items-center justify-between gap-2">
          <input
            id={titleInputId}
            name="planTitle"
            type="text"
            value={planTitle}
            onChange={(e) => {
              setPlanTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            placeholder="여행 제목 (예: 순천 1박2일 힐링 여행)"
            className={`w-full text-base font-extrabold bg-transparent text-white border-b pb-1 transition-all ${
              titleError
                ? 'border-rose-500 focus:border-rose-500 placeholder-rose-400'
                : 'border-slate-800 hover:border-slate-700 focus:border-emerald-500 focus:outline-none'
            }`}
          />
          {isSharedOriginal ? (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
              공유받은 원본 (작성자: {authorName})
            </span>
          ) : authorName ? (
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
              내 일정 (작성자: {authorName})
            </span>
          ) : null}
        </div>

        {/* Title change or Shared original hint banner */}
        {isSharedOriginal ? (
          <div className="text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <span>💡 공유받은 일정입니다. 저장 시 내 일정으로 새로 저장됩니다.</span>
          </div>
        ) : isTitleChanged ? (
          <div className="text-[11px] font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <span>💡 제목이 변경되어 새 일정으로 저장됩니다.</span>
          </div>
        ) : null}

        {titleError && (
          <div className="text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{titleError}</span>
          </div>
        )}

        {saveMessage && (
          <div className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}
      </div>

        </>
      )}

      {/* Day Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80 custom-scrollbar shrink-0">
        {days.map((dayItem, idx) => {
          const isPendingDelete = pendingDeleteDayIdx === idx;
          const isActive = activeDayIndex === idx;

          return (
            <div key={idx} className="relative group shrink-0">
              <button
                type="button"
                onClick={() => handleDayTabClick(idx)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isPendingDelete
                    ? 'bg-rose-600 text-white border border-rose-500 shadow-md animate-pulse ring-2 ring-rose-500/50'
                    : isActive
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>{isPendingDelete ? `Day ${idx + 1} 삭제` : `Day ${idx + 1}`}</span>
              </button>
              {days.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPendingDelete) {
                      handleRemoveDay(idx);
                    } else {
                      setPendingDeleteDayIdx(idx);
                    }
                  }}
                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center transition-all text-[10px] ${
                    isPendingDelete
                      ? 'bg-rose-500 text-white ring-2 ring-white opacity-100'
                      : 'bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white opacity-80 md:opacity-0 group-hover:opacity-100'
                  }`}
                  title="일차 삭제"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddDay}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/60 hover:bg-slate-800 text-emerald-400 border border-dashed border-emerald-500/40 transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>일차 추가</span>
        </button>
      </div>

      {/* Place Search Card Component - Desktop only (Hidden on Mobile BottomSheet to clearly separate Search vs Itinerary tabs) */}
      {!isMobileMode && (
        <div className="shrink-0">
          <PlaceSearchCard
            onAddPlace={handleAddPlace}
            onSelectPlace={onSelectSearchPlace}
            addedPlaceIds={blocks.map((b) => b.place.id)}
          />
        </div>
      )}

      {/* Day Summary Badge */}
      {blocks.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs shrink-0">
          <span className="text-slate-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>총 {blocks.length}개 장소</span>
          </span>
          {routes.length > 0 && (
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              <span>
                {totalDayDistance >= 1000 ? `${(totalDayDistance / 1000).toFixed(1)}km` : `${totalDayDistance}m`}
                {' / '}
                {Math.floor(totalDayDurationSec / 3600) > 0 ? `${Math.floor(totalDayDurationSec / 3600)}시간 ` : ''}
                {Math.ceil((totalDayDurationSec % 3600) / 60)}분
              </span>
            </span>
          )}
        </div>
      )}

      {/* Sortable Block List */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl p-6 gap-2">
            <MapPin className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-medium">아직 등록된 장소가 없습니다.</p>
            <p className="text-[11px] text-slate-600">
              {isMobileMode
                ? '[장소 추가] 버튼을 눌러 가고 싶은 곳을 검색해 보세요.'
                : '위 검색창에서 가고 싶은 곳을 검색한 후 [일정에 추가] 버튼을 눌러보세요.'}
            </p>
          </div>
        ) : (
          <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1">
                {blocks.map((block, idx) => (
                  <SortableBlockItem
                    key={block.id}
                    block={block}
                    index={idx}
                    drivingToNext={(drivingRoutes ?? routes)[idx]}
                    walkingToNext={blocks[idx + 1] ? estimateWalkingSegment(block, blocks[idx + 1]) : undefined}
                    onChangeTravelMode={handleChangeTravelMode}
                    onRemove={handleRemoveBlock}
                    onSelect={onSelectBlock}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <SavedPlansModals actions={planActions} />
    </div>
  );
}
