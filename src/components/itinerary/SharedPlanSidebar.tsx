'use client';

import React, { useState } from 'react';
import { DayItinerary, ItineraryBlock, RouteSegment } from '@/types/itinerary';
import SharedItineraryView from './SharedItineraryView';
import { Check, Edit3, Link2, User } from 'lucide-react';

interface SharedPlanSidebarProps {
  planTitle: string;
  authorName?: string;
  days: DayItinerary[];
  activeDayIndex: number;
  setActiveDayIndex: (idx: number) => void;
  routes: RouteSegment[];
  onSelectBlock: (block: ItineraryBlock) => void;
  onStartEditing: () => void;
}

/** 데스크톱: 공유받은 일정 읽기 전용 사이드바 (모바일 보기 모드와 같은 타임라인 사용) */
export default function SharedPlanSidebar({
  planTitle,
  authorName,
  days,
  activeDayIndex,
  setActiveDayIndex,
  routes,
  onSelectBlock,
  onStartEditing,
}: SharedPlanSidebarProps) {
  const [copied, setCopied] = useState(false);
  const totalPlaces = days.reduce((acc, d) => acc + (d.blocks?.length || 0), 0);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/95 border-r border-slate-800 text-slate-100 overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-slate-800/80 flex flex-col gap-3">
        <span className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <User className="w-3.5 h-3.5" />
          {authorName || '익명'}님이 공유한 여행
        </span>
        <div>
          <h1 className="text-xl font-extrabold leading-snug">{planTitle}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {days.length}일 · 장소 {totalPlaces}곳
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
            {copied ? '링크 복사됨' : '링크 복사'}
          </button>
          <button
            type="button"
            onClick={onStartEditing}
            className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-emerald-400 text-emerald-950 text-sm font-bold hover:bg-emerald-300 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            내 일정으로 편집
          </button>
        </div>
        <p className="text-[11px] text-slate-500">편집 후 저장하면 원본은 그대로 두고 내 일정으로 새로 저장돼요.</p>
      </div>

      <div className="flex-1 min-h-0">
        <SharedItineraryView
          days={days}
          activeDayIndex={activeDayIndex}
          setActiveDayIndex={setActiveDayIndex}
          routes={routes}
          onSelectBlock={onSelectBlock}
        />
      </div>
    </div>
  );
}
