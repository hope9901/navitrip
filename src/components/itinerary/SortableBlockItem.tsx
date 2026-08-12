'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ItineraryBlock, RouteSegment } from '@/types/itinerary';
import { getNaverMapSearchUrl } from '@/lib/naverMapUrl';
import { GripVertical, X, MapPin, Car, ExternalLink } from 'lucide-react';

interface SortableBlockItemProps {
  block: ItineraryBlock;
  index: number;
  routeToNext?: RouteSegment;
  onRemove: (id: string) => void;
  onSelect: (block: ItineraryBlock) => void;
}

export default function SortableBlockItem({
  block,
  index,
  routeToNext,
  onRemove,
  onSelect,
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const naverSearchUrl = getNaverMapSearchUrl(block.place);

  return (
    <div ref={setNodeRef} style={style} className="relative flex flex-col w-full group">
      {/* Block Card */}
      <div
        onClick={() => onSelect(block)}
        className="relative flex items-center gap-2 p-3 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/60 rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer overflow-hidden group/card min-h-[52px]"
      >
        {/* Drag Handle - Min 44px touch target on mobile */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label="순서 변경 드래그"
          className="p-2 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0 min-h-[44px] min-w-[36px] flex items-center justify-center"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Index Badge */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs shrink-0 border border-emerald-500/30">
          {index + 1}
        </div>

        {/* Place Info */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-bold text-slate-100 truncate">
              {block.place.title}
            </h4>
            {block.place.category && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {block.place.category.split('>').pop()?.trim()}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
            <span>{block.place.roadAddress || block.place.address}</span>
          </p>
        </div>

        {/* Action Buttons: Naver Search Link & Delete X (Min 44px touch targets) */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {naverSearchUrl && (
            <a
              href={naverSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="네이버 지도 사진·리뷰 보기 (새 탭)"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            type="button"
            onClick={() => onRemove(block.id)}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="장소 제거"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Route Badge to Next Place */}
      {routeToNext && (
        <div className="flex items-center justify-center my-1.5 relative">
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-700" />
          <div className="relative z-10 px-2.5 py-1 bg-slate-950 border border-emerald-500/30 rounded-full text-[10px] text-emerald-400 font-medium flex items-center gap-1.5 shadow-sm">
            <Car className="w-3 h-3 text-emerald-400" />
            <span>{routeToNext.formattedDuration}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{routeToNext.formattedDistance}</span>
          </div>
        </div>
      )}
    </div>
  );
}
