'use client';

import React, { useState } from 'react';
import { ItineraryBlock, DayItinerary, RouteSegment } from '@/types/itinerary';
import ItinerarySidebar from './ItinerarySidebar';
import { ChevronUp, ChevronDown } from 'lucide-react';

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
  onPlanSaved?: (newId: string) => void;
}

export default function MobileBottomSheet(props: MobileBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentDayBlocks = props.days[props.activeDayIndex]?.blocks || [];

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-all duration-300 ease-in-out flex flex-col bg-slate-950/95 border-t border-slate-800 shadow-2xl rounded-t-3xl ${
        isExpanded ? 'h-[85vh]' : 'h-[140px]'
      }`}
    >
      {/* Touch Handle & Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-col items-center justify-center pt-2 pb-2 px-4 cursor-pointer select-none border-b border-slate-900 shrink-0"
      >
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mb-1.5" />
        <div className="flex items-center justify-between w-full text-xs font-bold text-slate-200">
          <div className="flex items-center gap-2 truncate">
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md text-[11px]">
              Day {props.activeDayIndex + 1}
            </span>
            <span className="truncate max-w-[180px]">{props.planTitle || '일정 목록'}</span>
            <span className="text-[11px] text-slate-400">({currentDayBlocks.length}개 장소)</span>
          </div>
          <button type="button" className="p-1 text-slate-400 hover:text-white">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-hidden">
        <ItinerarySidebar {...props} />
      </div>
    </div>
  );
}
