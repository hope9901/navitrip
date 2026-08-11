'use client';

import React from 'react';
import { Place } from '@/types/itinerary';
import { getNaverMapSearchUrl } from '@/lib/naverMapUrl';
import { MapPin, Plus, Check, ExternalLink, ArrowLeft, X, Phone } from 'lucide-react';

interface SearchPlacePreviewCardProps {
  place: Place;
  onAddPlace: (place: Place) => void;
  isAlreadyAdded?: boolean;
  onReturnToSearch?: () => void;
  onClose?: () => void;
}

export default function SearchPlacePreviewCard({
  place,
  onAddPlace,
  isAlreadyAdded = false,
  onReturnToSearch,
  onClose,
}: SearchPlacePreviewCardProps) {
  const naverSearchUrl = getNaverMapSearchUrl(place);

  return (
    <div className="w-full bg-slate-900/98 border-t border-slate-800 p-3.5 flex flex-col gap-2.5 shadow-2xl safe-pb animate-fadeIn">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              선택한 장소
            </span>
            <h4 className="font-bold text-slate-100 text-sm truncate">{place.title}</h4>
            {place.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                {place.category.split('>').pop()?.trim()}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-1 truncate flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{place.roadAddress || place.address}</span>
          </p>

          {place.telephone && (
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
              <span>{place.telephone}</span>
            </p>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="선택한 장소 닫기"
            className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Action Buttons Bar - Touch friendly 44px min targets */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onReturnToSearch && (
            <button
              type="button"
              onClick={onReturnToSearch}
              className="inline-flex items-center gap-1 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all border border-slate-700/80 min-h-[44px] shrink-0 active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>검색 결과로</span>
            </button>
          )}

          {naverSearchUrl && (
            <a
              href={naverSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2.5 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 text-xs font-semibold rounded-xl transition-all border border-sky-800/60 min-h-[44px] truncate active:scale-95"
            >
              <span className="truncate">네이버 사진·리뷰</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAddPlace(place)}
          disabled={isAlreadyAdded}
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md min-h-[44px] shrink-0 active:scale-95 ${
            isAlreadyAdded
              ? 'bg-slate-800 text-slate-400 border border-slate-700/60 cursor-not-allowed opacity-80'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isAlreadyAdded ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>추가됨</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>일정에 추가</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
