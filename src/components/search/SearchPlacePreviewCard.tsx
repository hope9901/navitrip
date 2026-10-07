'use client';

import React from 'react';
import { Place } from '@/types/itinerary';
import { getNaverMapSearchUrl } from '@/lib/naverMapUrl';
import { Plus, Check, ExternalLink, ArrowLeft, X, Phone } from 'lucide-react';

interface SearchPlacePreviewCardProps {
  place: Place;
  onAddPlace: (place: Place) => void;
  isAlreadyAdded?: boolean;
  targetDayLabel?: string; // 예: 'Day 2' → "Day 2에 추가"
  onReturnToSearch?: () => void;
  onClose?: () => void;
}

/** 검색 결과를 지도에서 확인할 때 하단에 뜨는 장소 카드 */
export default function SearchPlacePreviewCard({
  place,
  onAddPlace,
  isAlreadyAdded = false,
  targetDayLabel,
  onReturnToSearch,
  onClose,
}: SearchPlacePreviewCardProps) {
  const naverSearchUrl = getNaverMapSearchUrl(place);
  const categoryLabel = place.category?.split('>').pop()?.trim();

  return (
    <div className="w-full bg-slate-950 px-4 pt-4 pb-4 flex flex-col gap-3 shadow-2xl safe-pb animate-fadeIn">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {categoryLabel && <div className="text-xs font-semibold text-emerald-400">{categoryLabel}</div>}
          <h4 className="text-lg font-bold text-slate-100 truncate">{place.title}</h4>
          <p className="text-sm text-slate-400 truncate">{place.roadAddress || place.address}</p>
          {place.telephone && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{place.telephone}</span>
            </p>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="선택한 장소 닫기"
            className="-mr-2 -mt-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {naverSearchUrl && (
        <a
          href={naverSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start inline-flex items-center gap-1 min-h-[32px] text-xs font-semibold text-sky-400 hover:text-sky-300"
        >
          네이버 사진·리뷰 보기
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      <div className="flex items-center gap-2">
        {onReturnToSearch && (
          <button
            type="button"
            onClick={onReturnToSearch}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[48px] px-4 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            검색 결과
          </button>
        )}

        <button
          type="button"
          onClick={() => onAddPlace(place)}
          disabled={isAlreadyAdded}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
            isAlreadyAdded
              ? 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
          }`}
        >
          {isAlreadyAdded ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              이미 추가됨
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {targetDayLabel ? `${targetDayLabel}에 추가` : '일정에 추가'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
