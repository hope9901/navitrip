'use client';

import React from 'react';
import { DayItinerary, ItineraryBlock, RouteSegment, TravelMode } from '@/types/itinerary';
import { openNaverMapRoute } from '@/lib/naverMapUrl';
import { Car, Footprints, Navigation, MapPin } from 'lucide-react';

interface SharedItineraryViewProps {
  days: DayItinerary[];
  activeDayIndex: number;
  setActiveDayIndex: (idx: number) => void;
  routes: RouteSegment[];
  onSelectBlock: (block: ItineraryBlock) => void;
}

/**
 * 공유 링크를 받은 사람을 위한 읽기 전용 일정 타임라인.
 * 편집 도구 없이 장소 순서와 구간별 이동 정보, 네이버 지도 길찾기만 보여준다.
 */
export default function SharedItineraryView({
  days,
  activeDayIndex,
  setActiveDayIndex,
  routes,
  onSelectBlock,
}: SharedItineraryViewProps) {
  const blocks = days[activeDayIndex]?.blocks || [];

  return (
    <div className="flex flex-col h-full text-slate-100">
      {/* Day Tabs */}
      <div role="tablist" aria-label="여행 날짜" className="flex items-center gap-2 px-4 pt-3 pb-2 overflow-x-auto custom-scrollbar shrink-0">
        {days.map((_, idx) => {
          const isActive = idx === activeDayIndex;
          return (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveDayIndex(idx)}
              className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-bold border transition-all ${
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

      {/* Timeline */}
      <ol className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 pt-2 custom-scrollbar">
        {blocks.length === 0 && (
          <li className="py-12 text-center text-sm text-slate-500">이 날에는 등록된 장소가 없어요.</li>
        )}
        {blocks.map((block, idx) => {
          const next = blocks[idx + 1];
          const segment = next ? routes[idx] : undefined;
          const mode: TravelMode = block.travelModeToNext ?? 'driving';
          const ModeIcon = mode === 'walking' ? Footprints : Car;

          return (
            <li key={block.id}>
              <button
                type="button"
                onClick={() => onSelectBlock(block)}
                className="w-full min-h-[60px] flex items-center gap-3 text-left rounded-xl hover:bg-slate-900/60 transition-colors"
              >
                <span className="shrink-0 w-8 h-8 rounded-full bg-emerald-400 text-emerald-950 text-sm font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold truncate">{block.place.title}</span>
                  <span className="text-xs text-slate-400 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {block.place.category ? `${block.place.category.split('>').pop()?.trim()} · ` : ''}
                    {block.place.roadAddress || block.place.address}
                  </span>
                </span>
              </button>

              {next && (
                <div className="ml-4 pl-7 py-1.5 border-l-2 border-dashed border-slate-700 flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-xs text-slate-400 flex items-center gap-1.5">
                    <ModeIcon className={`w-3.5 h-3.5 shrink-0 ${mode === 'walking' ? 'text-sky-400' : 'text-emerald-400'}`} />
                    <span className="truncate">
                      {mode === 'walking'
                        ? '도보'
                        : segment
                        ? `${segment.formattedDuration} · ${segment.formattedDistance}`
                        : '이동 정보 계산 중'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openNaverMapRoute(block.place, next.place, mode)}
                    aria-label={`${block.place.title}에서 ${next.place.title}까지 네이버 지도 길찾기`}
                    className="shrink-0 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-400 hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    길찾기
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
