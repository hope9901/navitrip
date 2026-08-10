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
import { Plus, Share2, Calendar, MapPin, Navigation, Check, Sparkles } from 'lucide-react';
import { savePlanToDB } from '@/lib/supabase';

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
}: ItinerarySidebarProps) {
  const titleInputId = useId();
  const dndContextId = useId();

  const [isSaving, setIsSaving] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
  };

  const handleRemoveDay = (dayIdx: number) => {
    if (days.length <= 1) return;
    setDays((prev) => prev.filter((_, idx) => idx !== dayIdx));
    if (activeDayIndex >= days.length - 1) {
      setActiveDayIndex(Math.max(0, days.length - 2));
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
          'Supabase에 저장되지 않아 다른 기기와 공유할 수 없습니다. 로컬에만 저장했습니다.'
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
    <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border-r border-slate-800 text-slate-100 p-4 gap-4 overflow-hidden">
      {/* Title & Share Header */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between gap-2">
          <input
            id={titleInputId}
            name="planTitle"
            type="text"
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            placeholder="여행 제목 (예: 강원도 2박3일 식도락)"
            className="text-base font-extrabold bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none py-1 transition-all flex-1 truncate"
          />

          <button
            type="button"
            onClick={handleSharePlan}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
          >
            {copiedShareUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>복사완료!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>일정 공유</span>
              </>
            )}
          </button>
        </div>

        {saveMessage && (
          <div className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{saveMessage}</span>
          </div>
        )}
      </div>

      {/* Day Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80 custom-scrollbar">
        {days.map((dayItem, idx) => (
          <div key={idx} className="relative group shrink-0">
            <button
              type="button"
              onClick={() => setActiveDayIndex(idx)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeDayIndex === idx
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Day {idx + 1}</span>
            </button>
            {days.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveDay(idx)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[10px]"
                title="일차 삭제"
              >
                ✕
              </button>
            )}
          </div>
        ))}

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
        <PlaceSearchCard onAddPlace={handleAddPlace} />
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
            <p className="text-[11px] text-slate-600">위 검색창에서 가고 싶은 곳을 검색한 후 [매핑하기] 버튼을 눌러보세요.</p>
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
    </div>
  );
}
