'use client';

import React, { useState, useId } from 'react';
import { Place } from '@/types/itinerary';
import { getNaverMapSearchUrl } from '@/lib/naverMapUrl';
import { Search, MapPin, ExternalLink, Plus, Loader2, Phone, AlertCircle, X, Navigation } from 'lucide-react';

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
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

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
    resetSearch();
  };

  const handleFocusClick = (e: React.MouseEvent, place: Place) => {
    e.stopPropagation();
    if (onSelectPlace) {
      onSelectPlace(place);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="relative w-full">
        {/* Minimum 16px font size on mobile (text-base) to prevent iOS Safari auto-zoom */}
        <input
          id={searchInputId}
          name="placeSearchQuery"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="장소명 또는 도로명/지번 주소 입력 (예: 순천만국가정원, 성심당 본점)"
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
          className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 shadow-md active:scale-95 min-h-[36px]"
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
        <div className="flex flex-col gap-2 max-h-72 md:max-h-80 overflow-y-auto pr-1 custom-scrollbar">
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
            results.map((place) => {
              const isAddressType = place.type === 'address';
              const naverSearchUrl = getNaverMapSearchUrl(place);

              return (
                <div
                  key={place.id}
                  onClick={(e) => handleFocusClick(e, place)}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all flex flex-col gap-2 group shadow-sm hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Type Badge */}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isAddressType
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isAddressType ? '주소' : '장소'}
                        </span>

                        <h4 className="font-bold text-slate-100 text-xs truncate max-w-[200px]">
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
                          <Phone className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                          <span>{place.telephone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar - Touch friendly 44px min targets */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/50 mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => handleFocusClick(e, place)}
                        className="inline-flex items-center gap-1 min-h-[36px] px-2 py-1 rounded text-xs md:text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="navitrip 지도에서 위치 보기"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>지도에서 보기</span>
                      </button>

                      {naverSearchUrl && (
                        <a
                          href={naverSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 min-h-[36px] px-2 py-1 rounded text-xs md:text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline transition-colors"
                          title="네이버 지도 사진 및 리뷰 검색 새 탭 열기"
                        >
                          <span>네이버에서 사진·리뷰 보기</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAdd(e, place)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white transition-all shadow-sm active:scale-95 min-h-[36px] shrink-0 ml-auto"
                    >
                      <Plus className="w-4 h-4" />
                      <span>일정에 추가</span>
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
