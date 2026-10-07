'use client';

import React, { useState, useEffect, useId, useRef } from 'react';
import { Place } from '@/types/itinerary';
import { getNaverMapSearchUrl } from '@/lib/naverMapUrl';
import { Search, MapPin, Plus, Loader2, AlertCircle, X, Navigation, Check } from 'lucide-react';

interface PlaceSearchCardProps {
  onAddPlace: (place: Place) => void;
  onSelectPlace?: (place: Place) => void;
  addedPlaceIds?: string[];
  containerMode?: 'sidebar' | 'mobile-sheet';
  focusSignal?: number; // 값이 바뀔 때마다 검색창에 포커스
}

export default function PlaceSearchCard({
  onAddPlace,
  onSelectPlace,
  addedPlaceIds = [],
  containerMode = 'sidebar',
  focusSignal,
}: PlaceSearchCardProps) {
  const searchInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[PlaceSearchCard] mounted (mode:', containerMode, ')');
    }
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[PlaceSearchCard] unmounted (mode:', containerMode, ')');
      }
    };
  }, [containerMode]);

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  const resetSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setErrorMsg(null);
    setWarningMsg(null);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setErrorMsg(null);
    setWarningMsg(null);

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        let msg = data.message || '검색 결과를 불러오지 못했습니다.';

        if (data.services) {
          const localCode = data.services.localSearch?.code;
          const geocodeCode = data.services.geocoding?.code;

          if (localCode === 'AUTH_FAILED' && geocodeCode === 'AUTH_FAILED') {
            msg = '장소 검색 키와 Naver Cloud Maps 키 인증에 모두 실패했습니다.';
          } else if (localCode === 'AUTH_FAILED') {
            msg = '네이버 장소 검색 API 인증에 실패했습니다. NAVER API Hub 지역 검색 키를 확인해 주세요.';
          } else if (geocodeCode === 'AUTH_FAILED') {
            msg = '네이버 주소 검색 API 인증에 실패했습니다. Naver Cloud Maps 키를 확인해 주세요.';
          } else if (localCode === 'NOT_CONFIGURED' && geocodeCode === 'NOT_CONFIGURED') {
            msg = '네이버 API 키가 설정되지 않았습니다.';
          } else if (localCode === 'NOT_CONFIGURED') {
            msg = '네이버 장소 검색 API 키가 설정되지 않았습니다. NAVER API Hub 지역 검색 키를 확인해 주세요.';
          } else if (geocodeCode === 'NOT_CONFIGURED') {
            msg = '네이버 주소 검색 API 키가 설정되지 않았습니다. Naver Cloud Maps 키를 확인해 주세요.';
          } else if (localCode === 'FORBIDDEN' || geocodeCode === 'FORBIDDEN') {
            msg = '해당 네이버 API 서비스가 활성화되어 있는지 확인해 주세요.';
          } else if (localCode === 'RATE_LIMITED' || geocodeCode === 'RATE_LIMITED') {
            msg = '네이버 API 호출 한도를 초과했습니다.';
          }
        }

        setErrorMsg(msg);
        setResults([]);
        return;
      }

      if (data.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
        const localWarn = data.warnings.find((w: { service: string }) => w.service === 'localSearch');
        const geocodeWarn = data.warnings.find((w: { service: string }) => w.service === 'geocoding');

        if (localWarn && localWarn.code === 'AUTH_FAILED') {
          setWarningMsg('장소 검색: NAVER API Hub 지역 검색 키 인증에 실패했습니다.');
        } else if (geocodeWarn && geocodeWarn.code === 'AUTH_FAILED') {
          setWarningMsg('주소 검색: Naver Cloud Maps 키 인증에 실패했습니다.');
        } else {
          setWarningMsg('일부 검색 API 연동에 경고가 발생했습니다.');
        }
      }

      if (data.items && Array.isArray(data.items)) {
        const sanitizedItems: Place[] = data.items.map((item: Place) => {
          const searchUrl = getNaverMapSearchUrl(item) || undefined;
          return {
            ...item,
            title: (item.title || '').replace(/<[^>]*>?/gm, '').trim(),
            roadAddress: (item.roadAddress || '').replace(/<[^>]*>?/gm, '').trim(),
            address: (item.address || '').replace(/<[^>]*>?/gm, '').trim(),
            naverMapUrl: searchUrl,
            link: undefined,
            naverPlaceUrl: undefined,
          };
        });
        setResults(sanitizedItems);
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
    // DO NOT call resetSearch() here! Preserve search results & query for continuous adding!
  };

  const handleFocusClick = (e: React.MouseEvent, place: Place) => {
    e.stopPropagation();
    if (onSelectPlace) {
      onSelectPlace(place);
    }
  };

  const isPlaceAdded = (place: Place) => {
    return addedPlaceIds.some(
      (id) =>
        id === place.id ||
        (place.roadAddress && id.includes(place.roadAddress)) ||
        (place.title && id.includes(place.title))
    );
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Search Input Bar - Sticky top in mobile sheet */}
      <form onSubmit={handleSearch} className="relative w-full sticky top-0 z-10 bg-slate-950 pb-1">
        {/* Minimum 16px font size on mobile (text-base) to prevent iOS Safari auto-zoom */}
        <input
          ref={inputRef}
          id={searchInputId}
          name="placeSearchQuery"
          type="text"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="장소명 또는 주소 (예: 순천만국가정원)"
          autoComplete="off"
          className="w-full pl-10 pr-24 py-3 md:py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-400 text-base md:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner min-h-[44px]"
        />
        <Search className="absolute left-3.5 top-3.5 md:top-3 w-4 h-4 text-slate-400" />

        {query && (
          <button
            type="button"
            onClick={resetSearch}
            className="absolute right-16 top-2.5 bottom-2.5 px-2 text-slate-400 hover:text-slate-200 transition-all min-w-[36px] flex items-center justify-center"
            title="검색어 및 결과 초기화"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 shadow-md active:scale-95 min-h-[36px]"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '검색'}
        </button>
      </form>

      {/* Partial Warning Banner */}
      {warningMsg && (
        <div className="px-3 py-1.5 text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>{warningMsg}</span>
        </div>
      )}

      {/* Search Results Drawer / Panel */}
      {hasSearched && (
        <div
          className={`flex flex-col custom-scrollbar ${
            containerMode === 'mobile-sheet'
              ? 'flex-1 min-h-0 overflow-y-auto pr-1 pb-6'
              : 'max-h-72 md:max-h-80 overflow-y-auto pr-1'
          }`}
        >
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              <span>네이버 장소 및 주소 검색 중...</span>
            </div>
          ) : errorMsg ? (
            <div className="py-5 px-4 text-center text-xs bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
              일치하는 장소나 주소가 없습니다.
            </div>
          ) : (
            <>
              <p className="px-1 pb-1 text-xs text-slate-400">
                검색 결과 {results.length}개 · 장소를 누르면 지도에서 위치를 볼 수 있어요
              </p>
              {results.map((place) => {
                const isAddressType = place.type === 'address';
                const added = isPlaceAdded(place);
                const categoryLabel = isAddressType
                  ? '주소'
                  : place.category
                  ? place.category.split('>').pop()?.trim() || place.category
                  : '';

                return (
                  <div key={place.id} className="flex items-center gap-2 border-b border-slate-800/80 last:border-b-0">
                    <button
                      type="button"
                      onClick={(e) => handleFocusClick(e, place)}
                      className="flex-1 min-w-0 min-h-[64px] md:min-h-[56px] flex items-center gap-3 px-1 py-2 text-left rounded-xl hover:bg-slate-900/70 transition-colors"
                    >
                      <span
                        className={`shrink-0 w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center ${
                          isAddressType ? 'text-sky-400' : 'text-emerald-400'
                        }`}
                      >
                        {isAddressType ? <Navigation className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                      </span>
                      <span className="flex flex-col min-w-0 gap-0.5">
                        <span className="text-[15px] md:text-sm font-semibold text-slate-100 truncate">{place.title}</span>
                        <span className="text-xs text-slate-400 truncate">
                          {categoryLabel && `${categoryLabel} · `}
                          {place.roadAddress || place.address}
                        </span>
                      </span>
                    </button>

                    {added ? (
                      <span className="shrink-0 inline-flex items-center gap-1 min-h-[44px] px-2 text-sm md:text-xs font-semibold text-slate-400">
                        <Check className="w-4 h-4 text-emerald-400" />
                        추가됨
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleAdd(e, place)}
                        aria-label={`${place.title} 일정에 추가`}
                        className="shrink-0 inline-flex items-center gap-1 min-h-[44px] px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-sm md:text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        추가
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
