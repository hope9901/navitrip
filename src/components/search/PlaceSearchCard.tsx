'use client';

import React, { useState } from 'react';
import { Place } from '@/types/itinerary';
import { Search, MapPin, ExternalLink, Plus, Loader2, Phone } from 'lucide-react';

interface PlaceSearchCardProps {
  onAddPlace: (place: Place) => void;
}

export default function PlaceSearchCard({ onAddPlace }: PlaceSearchCardProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.items) {
        setResults(data.items);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (place: Place) => {
    onAddPlace(place);
    setAddedMap((prev) => ({ ...prev, [place.id]: true }));
    setTimeout(() => {
      setAddedMap((prev) => ({ ...prev, [place.id]: false }));
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative w-full">
        <input
          id="place-search-input"
          name="placeSearchQuery"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="방문하고 싶은 장소/식당 검색 (예: 속초 중앙시장)"
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
              <span>네이버 장소 검색 중...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
              검색 결과가 없습니다. 다른 검색어를 입력해 보세요.
            </div>
          ) : (
            results.map((place) => {
              const isAdded = addedMap[place.id];
              return (
                <div
                  key={place.id}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all flex flex-col gap-2 group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-slate-100 text-xs truncate max-w-[200px]">
                          {place.title}
                        </h4>
                        {place.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {place.category.split('>').pop()?.trim() || place.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{place.roadAddress || place.address}</span>
                      </p>
                      {place.telephone && (
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
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
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline"
                      >
                        <span>네이버 상세/리뷰</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-500">네이버 검색 연동</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAdd(place)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                        isAdded
                          ? 'bg-emerald-500 text-white scale-105'
                          : 'bg-emerald-600/90 hover:bg-emerald-500 text-white active:scale-95'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAdded ? '추가됨!' : '매핑하기'}</span>
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
