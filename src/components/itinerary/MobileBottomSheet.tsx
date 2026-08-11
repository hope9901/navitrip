'use client';

import React, { useState } from 'react';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, SavedMapView } from '@/types/itinerary';
import ItinerarySidebar from './ItinerarySidebar';
import { ChevronUp, ChevronDown, List, Map } from 'lucide-react';

interface MobileBottomSheetProps {
  planTitle: string;
  setPlanTitle: (title: string) => void;
  days: DayItinerary[];
  setDays: React.Dispatch<React.SetStateAction<DayItinerary[]>>;
  activeDayIndex: number;
  setActiveDayIndex: (idx: number) => void;
  onSelectBlock: (block: ItineraryBlock) => void;
  routes: RouteSegment[];
  planId?: string;
  authorName?: string;
  userName?: string;
  onChangeUserName?: () => void;
  onPlanSaved?: (newId: string) => void;
  onLoadPlan?: (plan: PlanData) => void;
  onNewPlan?: () => void;
  onDeleteCurrentActivePlan?: () => void;
  onRequestMapView?: () => SavedMapView | null;
  onSelectSearchPlace?: (place: Place) => void;
}

export default function MobileBottomSheet(props: MobileBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentDayBlocks = props.days[props.activeDayIndex]?.blocks || [];

  return (
    <div
      aria-expanded={isExpanded}
      className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-all duration-300 ease-in-out flex flex-col bg-slate-950/95 border-t border-slate-800 shadow-2xl rounded-t-3xl safe-pb ${
        isExpanded ? 'h-[85dvh]' : 'h-[140px]'
      }`}
    >
      {/* Touch Handle & Header Bar - Min 44px touch height */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-col items-center justify-center pt-2.5 pb-2 px-4 cursor-pointer select-none border-b border-slate-900 shrink-0 min-h-[48px] active:bg-slate-900/60 transition-colors"
      >
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mb-1.5" />
        <div className="flex items-center justify-between w-full text-xs font-bold text-slate-200">
          <div className="flex items-center gap-2 truncate">
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md text-[11px] font-bold">
              Day {props.activeDayIndex + 1}
            </span>
            <span className="truncate max-w-[170px] text-slate-100 font-semibold">{props.planTitle || '일정 목록'}</span>
            <span className="text-[11px] text-slate-400 font-normal">({currentDayBlocks.length}개 장소)</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              aria-label={isExpanded ? '지도 보기 (목록 접기)' : '일정 보기 (목록 펼치기)'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-semibold transition-all border border-slate-700 min-h-[36px]"
            >
              {isExpanded ? (
                <>
                  <Map className="w-3.5 h-3.5" />
                  <span>지도 보기</span>
                </>
              ) : (
                <>
                  <List className="w-3.5 h-3.5" />
                  <span>일정 보기</span>
                </>
              )}
            </button>

            <button
              type="button"
              aria-label={isExpanded ? '패널 접기' : '패널 펼치기'}
              className="p-1.5 text-slate-400 hover:text-white min-w-[36px] flex items-center justify-center"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-hidden">
        <ItinerarySidebar {...props} />
      </div>
    </div>
  );
}
