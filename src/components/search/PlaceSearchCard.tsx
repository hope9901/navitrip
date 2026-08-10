'use client';

import React, { useState, useId } from 'react';
import { Place } from '@/types/itinerary';
import { Search, MapPin, ExternalLink, Plus, Loader2, Phone, AlertCircle } from 'lucide-react';

interface PlaceSearchCardProps {
  onAddPlace: (place: Place) => void;
  onSelectPlace?: (place: Place) => void;
}

export default function PlaceSearchCard({ onAddPlace, onSelectPlace }: PlaceSearchCardProps) {
  const searchInputId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error === 'NAVER_SEARCH_NOT_CONFIGURED') {
          setErrorMsg('검색 API 설정을 확인해 주세요.');
        } else {
          setErrorMsg(data.message || '검색 결과를 불러오지 못했습니다.');
        }
        setResults([]);
        return;
      }

      if (data.items && Array.isArray(data.items)) {
        setResults(data.items);
        if (data.items.length === 0) {
          setErrorMsg(null);
        } else if (onSelectPlace && data.items[0]) {
          // Pan map to first search result
          onSelectPlace(data.items[0]);
        }
      } else {
        setResults([]);
      }
    } catch (err: unknown) {
      console.error('Search request failed:', err);
      setErrorMsg('검색 결과를 불러오지 못했습니다.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (e: React.MouseEvent, place: Place) => {
    e.stopPropagation();
    onAddPlace(place);
    setAddedMap((prev) => ({ ...prev, [place.id]: true }));
    setTimeout(() => {
      setAddedMap((prev) => ({ ...prev, [place.id]: false }));
    }, 1500);
  };

  const handleCardClick = (place: Place) => {
    if (onSelectPlace) {
      onSelectPlace(place);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative w-full">
        <input
          id={searchInputId}
          name="placeSearchQuery"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="장소명 또는 도로명/지번 주소 입력 (예: 순천만국가정원, 속초 중앙시장)"
          autoComplete="off"
          className="w-full pl-10 pr-24 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
        />
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-md active:scale-95"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '검색'}
        </button>
      </form>

      {/* Search Results Drawer / Cards */}
      {hasSearched && (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              <span>네이버 장소 및 주소 검색 중...</span>
            </div>
          ) : errorMsg ? (
            <div className="py-5 px-4 text-center text-xs bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
              일치하는 장소나 주소가 없습니다.
            </div>
          ) : (
            results.map((place) => {
              const isAdded = addedMap[place.id];
              const isAddressType = place.type === 'address';

              return (
                <div
                  key={place.id}
                  onClick={() => handleCardClick(place)}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all flex flex-col gap-2 group shadow-sm hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Type Badge: 주소 vs 장소 */}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isAddressType
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isAddressType ? '주소' : '장소'}
                        </span>

                        <h4 className="font-bold text-slate-100 text-xs truncate max-w-[220px]">
                          {place.title}
                        </h4>

                        {/* Category */}
                        {place.category && place.category !== '주소' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                            {place.category.split('>').pop()?.trim() || place.category}
                          </span>
                        )}
                      </div>

                      {/* Road & Jibun Address */}
                      <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-slate-400">
                        {place.roadAddress && (
                          <p className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-slate-300 font-medium">[도로명] {place.roadAddress}</span>
                          </p>
                        )}
                        {place.address && place.address !== place.roadAddress && (
                          <p className="flex items-center gap-1 truncate text-slate-400 pl-4">
                            <span>[지번] {place.address}</span>
                          </p>
                        )}
                      </div>

                      {place.telephone && (
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 shrink-0" />
                          <span>{place.telephone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700/50 mt-1">
                    {place.link ? (
                      <a
                        href={place.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline"
                      >
                        <span>네이버 상세정보</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-500">네이버 공식 결과</span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleAdd(e, place)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                        isAdded
                          ? 'bg-emerald-500 text-white scale-105'
                          : 'bg-emerald-600/90 hover:bg-emerald-500 text-white active:scale-95'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAdded ? '추가됨!' : '일정에 추가'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
