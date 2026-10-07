'use client';

import React, { useState } from 'react';
import { Place, DayItinerary } from '@/types/itinerary';
import PlaceSearchCard from './PlaceSearchCard';
import { ArrowLeft } from 'lucide-react';

interface MobileSearchScreenProps {
  isOpen: boolean;
  sessionId: number; // 새로 열 때마다 증가 (검색창 포커스 및 '추가한 장소 수' 초기화 기준)
  days: DayItinerary[];
  activeDayIndex: number;
  onChangeDay: (idx: number) => void;
  onAddPlace: (place: Place) => void;
  onSelectPlace: (place: Place) => void;
  onClose: () => void;
  onShowItinerary: () => void;
}

/**
 * 모바일 전용 전체 화면 장소 검색.
 * 닫혀 있을 때도 언마운트하지 않고 숨기기만 해서 검색어와 결과를 유지한다.
 */
export default function MobileSearchScreen({
  isOpen,
  sessionId,
  days,
  activeDayIndex,
  onChangeDay,
  onAddPlace,
  onSelectPlace,
  onClose,
  onShowItinerary,
}: MobileSearchScreenProps) {
  const [addedInSession, setAddedInSession] = useState({ sessionId: 0, count: 0 });
  const addedCount = addedInSession.sessionId === sessionId ? addedInSession.count : 0;

  const currentDayPlaceIds = (days[activeDayIndex]?.blocks || []).map((b) => b.place.id);

  const handleAddPlace = (place: Place) => {
    onAddPlace(place);
    setAddedInSession((prev) => ({
      sessionId,
      count: (prev.sessionId === sessionId ? prev.count : 0) + 1,
    }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="장소 검색"
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-40 md:hidden flex-col bg-slate-950 text-slate-100 ${isOpen ? 'flex' : 'hidden'}`}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="지도로 돌아가기"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-200 hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold">장소 추가</h2>
      </div>

      {/* Target Day Selector */}
      <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto custom-scrollbar shrink-0">
        <span className="text-xs text-slate-400 shrink-0">추가할 날</span>
        {days.map((_, idx) => {
          const isActive = idx === activeDayIndex;
          return (
            <button
              key={idx}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChangeDay(idx)}
              className={`shrink-0 min-h-[40px] px-3.5 rounded-full text-xs font-bold border transition-all ${
                isActive
                  ? 'bg-emerald-400 border-emerald-400 text-emerald-950'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Day {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Search Input & Results */}
      <div className={`flex-1 min-h-0 overflow-y-auto px-3 ${addedCount > 0 ? 'pb-24' : 'pb-6'}`}>
        <PlaceSearchCard
          onAddPlace={handleAddPlace}
          onSelectPlace={onSelectPlace}
          addedPlaceIds={currentDayPlaceIds}
          containerMode="mobile-sheet"
          focusSignal={isOpen ? sessionId : undefined}
        />
      </div>

      {/* Added-in-this-session Bar */}
      {addedCount > 0 && (
        <div className="absolute inset-x-3 bottom-3 safe-pb">
          <div className="flex items-center gap-3 pl-4 pr-2 py-2 bg-slate-100 text-slate-900 rounded-2xl shadow-2xl animate-fadeIn">
            <span className="flex-1 text-sm font-semibold">
              일정에 {addedCount}곳 추가했어요
            </span>
            <button
              type="button"
              onClick={onShowItinerary}
              className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-sm font-bold active:scale-95 transition-transform"
            >
              일정 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
