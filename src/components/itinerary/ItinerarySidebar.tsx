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
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData } from '@/types/itinerary';
import SortableBlockItem from './SortableBlockItem';
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
  Loader2,
  X,
  Clock,
} from 'lucide-react';
import { savePlanToDB, loadPlanFromDB, listSavedPlansFromDB, SavedPlanSummary } from '@/lib/supabase';

interface ItinerarySidebarProps {
  planTitle: string;
  setPlanTitle: (title: string) => void;
  days: DayItinerary[];
  setDays: React.Dispatch<React.SetStateAction<DayItinerary[]>>;
  activeDayIndex: number;
  setActiveDayIndex: (idx: number) => void;
  onSelectBlock: (block: ItineraryBlock) => void;
  routes: RouteSegment[];
  planId?: string;
  onPlanSaved?: (newId: string) => void;
  onLoadPlan?: (plan: PlanData) => void;
  onNewPlan?: () => void;
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
  planId,
  onPlanSaved,
  onLoadPlan,
  onNewPlan,
}: ItinerarySidebarProps) {
  const titleInputId = useId();
  const dndContextId = useId();

  const [isSaving, setIsSaving] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pendingDeleteDayIdx, setPendingDeleteDayIdx] = useState<number | null>(null);

  // Load Saved Plans Modal State
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [savedPlansList, setSavedPlansList] = useState<SavedPlanSummary[]>([]);
  const [loadingPlansList, setLoadingPlansList] = useState(false);

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
      id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      place,
      dayIndex: activeDayIndex,
    };

    setDays((prevDays) => {
      const newDays = [...prevDays];
      if (!newDays[activeDayIndex]) {
        newDays[activeDayIndex] = { day: activeDayIndex + 1, blocks: [] };
      }
      newDays[activeDayIndex] = {
        ...newDays[activeDayIndex],
        blocks: [...newDays[activeDayIndex].blocks, newBlock],
      };
      return newDays;
    });

    onSelectBlock(newBlock);
  };

  const handleRemoveBlock = (blockId: string) => {
    setDays((prevDays) => {
      const newDays = [...prevDays];
      newDays[activeDayIndex] = {
        ...newDays[activeDayIndex],
        blocks: newDays[activeDayIndex].blocks.filter((b) => b.id !== blockId),
      };
      return newDays;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDays((prevDays) => {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);

      const newDays = [...prevDays];
      newDays[activeDayIndex] = {
        ...newDays[activeDayIndex],
        blocks: reorderedBlocks,
      };
      return newDays;
    });
  };

  const handleAddDay = () => {
    setDays((prev) => [
      ...prev,
      { day: prev.length + 1, blocks: [] },
    ]);
    setActiveDayIndex(days.length);
    setPendingDeleteDayIdx(null);
  };

  const handleRemoveDay = (dayIdx: number) => {
    if (days.length <= 1) return;
    setDays((prev) => prev.filter((_, idx) => idx !== dayIdx));
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

  const handleOpenLoadModal = async () => {
    setIsLoadModalOpen(true);
    setLoadingPlansList(true);
    try {
      const list = await listSavedPlansFromDB();
      setSavedPlansList(list);
    } catch (err) {
      console.error('Failed to list saved plans:', err);
    } finally {
      setLoadingPlansList(false);
    }
  };

  const handleSelectSavedPlan = async (selectedId: string) => {
    setLoadingPlansList(true);
    try {
      const plan = await loadPlanFromDB(selectedId);
      if (plan) {
        if (onLoadPlan) {
          onLoadPlan(plan);
        } else {
          setPlanTitle(plan.title || '불러온 여행 일정');
          if (plan.days && plan.days.length > 0) {
            setDays(plan.days);
            setActiveDayIndex(0);
          }
        }
        setIsLoadModalOpen(false);
        setSaveMessage(`'${plan.title}' 일정을 성공적으로 불러왔습니다!`);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to load selected plan:', err);
    } finally {
      setLoadingPlansList(false);
    }
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    try {
      const planData: PlanData = {
        id: planId,
        title: planTitle || '나의 여행 일정',
        days,
      };

      const result = await savePlanToDB(planData);

      if (onPlanSaved && result.id !== planId) {
        onPlanSaved(result.id);
      }

      setIsJustSaved(true);
      setSaveMessage(
        result.isLocalFallback
          ? '로컬 기기에 일정이 안전하게 저장되었습니다.'
          : 'Supabase 데이터베이스에 일정이 저장되었습니다.'
      );

      setTimeout(() => {
        setIsJustSaved(false);
        setSaveMessage(null);
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.';
      console.error('Failed to save plan:', msg);
      setSaveMessage('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSharePlan = async () => {
    setIsSaving(true);
    try {
      const planData: PlanData = {
        id: planId,
        title: planTitle || '나의 여행 일정',
        days,
      };

      const result = await savePlanToDB(planData);

      if (result.isLocalFallback) {
        setSaveMessage(
          'Supabase 설정 전이므로 공유 링크 생성이 제한됩니다. (로컬 저장 완료)'
        );
        return;
      }

      const shareUrl = `${window.location.origin}/plan/${result.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      setSaveMessage('공유 링크가 클립보드에 복사되었습니다!');

      if (onPlanSaved && result.id !== planId) {
        onPlanSaved(result.id);
      }

      setTimeout(() => {
        setCopiedShareUrl(false);
        setSaveMessage(null);
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.';
      console.error('Failed to save plan:', msg);
      setSaveMessage('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalDayDistance = routes.reduce((acc, r) => acc + r.distanceMeter, 0);
  const totalDayDurationSec = routes.reduce((acc, r) => acc + r.durationSeconds, 0);

  return (
    <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border-r border-slate-800 text-slate-100 p-4 gap-3 overflow-hidden relative">
      {/* 1. Top Toolbar Action Buttons Row (가장 상단) */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {onNewPlan && (
            <button
              type="button"
              onClick={onNewPlan}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 transition-all shrink-0 active:scale-95"
              title="새 일정 만들기"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>새 일정</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenLoadModal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 transition-all shrink-0 active:scale-95"
            title="저장된 일정 불러오기"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>불러오기</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleSaveOnly}
            disabled={isSaving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all shrink-0 active:scale-95"
            title="일정 저장"
          >
            {isJustSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>저장완료</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>저장하기</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSharePlan}
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
                <span>공유하기</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Plan Title & Save Alert Message (그 밑에) */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <div className="relative w-full">
          <input
            id={titleInputId}
            name="planTitle"
            type="text"
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            placeholder="여행 제목 (예: 순천 1박2일 힐링 여행)"
            className="w-full text-base font-extrabold bg-transparent text-white border-b border-slate-800 hover:border-slate-700 focus:border-emerald-500 focus:outline-none pb-1 transition-all"
          />
        </div>

        {saveMessage && (
          <div className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}
      </div>

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

      {/* Place Search Card Component */}
      <div className="shrink-0">
        <PlaceSearchCard
          onAddPlace={handleAddPlace}
          onSelectPlace={(p) => {
            onSelectBlock({ id: '', place: p, dayIndex: activeDayIndex });
          }}
        />
      </div>

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
            <p className="text-[11px] text-slate-600">위 검색창에서 가고 싶은 곳을 검색한 후 [일정에 추가] 버튼을 눌러보세요.</p>
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
                    routeToNext={routes[idx]}
                    onRemove={handleRemoveBlock}
                    onSelect={onSelectBlock}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Load Saved Plans Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FolderOpen className="w-4 h-4 text-sky-400" />
                <span>저장된 여행 일정 불러오기</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLoadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto custom-scrollbar">
              {loadingPlansList ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
                  <span>저장된 일정을 조회하는 중입니다...</span>
                </div>
              ) : savedPlansList.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                  저장된 여행 일정이 없습니다.
                </div>
              ) : (
                savedPlansList.map((planItem) => (
                  <div
                    key={planItem.id}
                    onClick={() => handleSelectSavedPlan(planItem.id)}
                    className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm hover:shadow-md"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-sky-400 transition-colors truncate">
                        {planItem.title}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>장소 {planItem.placeCount}개</span>
                        </span>
                        {planItem.updatedAt && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(planItem.updatedAt).toLocaleDateString('ko-KR')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 bg-sky-600/90 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95"
                    >
                      불러오기
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
