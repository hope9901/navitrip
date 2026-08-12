'use client';

import React, { useState } from 'react';
import { Place, ItineraryBlock, DayItinerary, RouteSegment, PlanData, SavedMapView } from '@/types/itinerary';
import ItinerarySidebar from './ItinerarySidebar';
import PlaceSearchCard from '../search/PlaceSearchCard';
import SearchPlacePreviewCard from '../search/SearchPlacePreviewCard';
import { ChevronUp, ChevronDown, List, Search, Calendar, Map } from 'lucide-react';

export type MobilePanelTab = 'search' | 'itinerary';
export type MobileSheetState = 'peek' | 'half' | 'full';

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
  authorName?: string;
  userName?: string;
  onChangeUserName?: () => void;
  onPlanSaved?: (newId: string) => void;
  onLoadPlan?: (plan: PlanData) => void;
  onNewPlan?: () => void;
  onDeleteCurrentActivePlan?: () => void;
  onRequestMapView?: () => SavedMapView | null;
  onSelectSearchPlace?: (place: Place) => void;
  selectedSearchPlace?: Place | null;
  onClearSelectedSearchPlace?: () => void;
  onAddPlaceFromSearch?: (place: Place) => void;
  mobilePanelTab?: MobilePanelTab;
  setMobilePanelTab?: (tab: MobilePanelTab) => void;
  mobileSheetState?: MobileSheetState;
  setMobileSheetState?: (state: MobileSheetState) => void;
}

export default function MobileBottomSheet(props: MobileBottomSheetProps) {
  const [internalTab, setInternalTab] = useState<MobilePanelTab>('search');
  const [internalState, setInternalState] = useState<MobileSheetState>('half');

  const activeTab = props.mobilePanelTab !== undefined ? props.mobilePanelTab : internalTab;
  const setActiveTab = props.setMobilePanelTab || setInternalTab;

  const sheetState = props.mobileSheetState !== undefined ? props.mobileSheetState : internalState;
  const setSheetState = props.setMobileSheetState || setInternalState;

  const currentDayBlocks = props.days[props.activeDayIndex]?.blocks || [];
  const currentDayPlaceIds = currentDayBlocks.map((b) => b.place.id);

  // Height class mapping
  const getHeightClass = () => {
    if (sheetState === 'peek') return 'h-[110px]';
    if (sheetState === 'full') return 'h-[calc(100dvh-54px)]';
    return 'h-[48dvh]'; // half state
  };

  const handleAddPlace = (place: Place) => {
    if (props.onAddPlaceFromSearch) {
      props.onAddPlaceFromSearch(place);
    }
  };

  const handleSelectSearchPlaceOnMobile = (place: Place) => {
    if (props.onSelectSearchPlace) {
      props.onSelectSearchPlace(place);
    }
    // When "지도에서 보기" is clicked, collapse sheet to peek state so map is fully visible
    setSheetState('peek');
  };

  const handleReturnToSearchResults = () => {
    if (props.onClearSelectedSearchPlace) {
      props.onClearSelectedSearchPlace();
    }
    setActiveTab('search');
    setSheetState('half');
  };

  return (
    <div
      aria-expanded={sheetState !== 'peek'}
      className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-all duration-300 ease-in-out flex flex-col bg-slate-950/98 border-t border-slate-800 shadow-2xl rounded-t-3xl safe-pb ${getHeightClass()}`}
    >
      {/* Touch Handle & Quick Action Header */}
      <div className="flex flex-col items-center justify-center pt-2 pb-1 px-4 cursor-pointer select-none border-b border-slate-900 shrink-0 min-h-[44px] bg-slate-950 rounded-t-3xl">
        <div
          onClick={() => setSheetState(sheetState === 'peek' ? 'half' : 'peek')}
          className="w-12 h-1.5 bg-slate-700 hover:bg-slate-500 rounded-full mb-1 transition-colors"
          title="패널 높이 조절"
        />

        {/* Tab & View Mode Control Bar */}
        <div className="flex items-center justify-between w-full text-xs font-bold text-slate-200">
          {/* Tabs: Search vs Itinerary */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'search'}
              onClick={() => {
                setActiveTab('search');
                if (sheetState === 'peek') setSheetState('half');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                activeTab === 'search'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>장소 검색</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'itinerary'}
              onClick={() => {
                if (props.onClearSelectedSearchPlace) {
                  props.onClearSelectedSearchPlace();
                }
                setActiveTab('itinerary');
                if (sheetState === 'peek') setSheetState('half');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                activeTab === 'itinerary'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>일정 ({currentDayBlocks.length})</span>
            </button>
          </div>

          {/* Sheet State Quick Toggle Buttons */}
          <div className="flex items-center gap-1">
            {sheetState === 'peek' ? (
              <button
                type="button"
                onClick={() => setSheetState('half')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-all border border-slate-700 min-h-[36px]"
              >
                <List className="w-3.5 h-3.5" />
                <span>목록 펼치기</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSheetState('peek')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition-all border border-slate-700 min-h-[36px]"
              >
                <Map className="w-3.5 h-3.5" />
                <span>지도 크게보기</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (sheetState === 'peek') setSheetState('half');
                else if (sheetState === 'half') setSheetState('full');
                else setSheetState('peek');
              }}
              aria-label={sheetState === 'full' ? '패널 축소' : '패널 확대'}
              className="p-1.5 text-slate-400 hover:text-white min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              {sheetState === 'full' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 relative">
        {/* Search Tab Panel (SINGLE MOUNT PlaceSearchCard to preserve query & results permanently) */}
        <div
          className={`flex-1 flex-col min-h-0 overflow-y-auto p-3.5 ${
            activeTab === 'search' && !(sheetState === 'peek' && props.selectedSearchPlace)
              ? 'flex'
              : 'hidden'
          }`}
        >
          <PlaceSearchCard
            onAddPlace={handleAddPlace}
            onSelectPlace={handleSelectSearchPlaceOnMobile}
            addedPlaceIds={currentDayPlaceIds}
            containerMode="mobile-sheet"
          />
        </div>

        {/* Selected Search Place Preview Card (Shown in peek mode when a search place is active) */}
        {activeTab === 'search' && sheetState === 'peek' && props.selectedSearchPlace && (
          <SearchPlacePreviewCard
            place={props.selectedSearchPlace}
            onAddPlace={handleAddPlace}
            isAlreadyAdded={currentDayPlaceIds.includes(props.selectedSearchPlace.id)}
            onReturnToSearch={handleReturnToSearchResults}
            onClose={props.onClearSelectedSearchPlace}
          />
        )}

        {/* Itinerary Tab Panel */}
        <div
          className={`flex-1 overflow-hidden ${
            activeTab === 'itinerary' ? 'block' : 'hidden'
          }`}
        >
          <ItinerarySidebar
            {...props}
            onSelectSearchPlace={handleSelectSearchPlaceOnMobile}
            isMobileMode={true}
          />
        </div>
      </div>
    </div>
  );
}
