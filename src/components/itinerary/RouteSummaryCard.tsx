'use client';

import React from 'react';
import { RouteSegment } from '@/types/itinerary';
import { Navigation, RefreshCw, Clock } from 'lucide-react';

interface RouteSummaryCardProps {
  routes: RouteSegment[];
  routeSource?: 'live' | 'cache' | 'saved' | 'stale-cache' | 'fallback' | null;
  calculatedAt?: string | null;
  onForceRefreshRoute?: () => void;
  isRefreshingRoute?: boolean;
  refreshCooldownSeconds?: number;
  blockCount?: number;
}

export default function RouteSummaryCard({
  routes,
  routeSource,
  calculatedAt,
  onForceRefreshRoute,
  isRefreshingRoute = false,
  refreshCooldownSeconds = 0,
  blockCount = 0,
}: RouteSummaryCardProps) {
  // Naver driving routes only (walking segments have no time/distance yet, fallback segments are excluded)
  const drivingSegments = routes.filter(
    (r) =>
      r.travelMode !== 'walking' &&
      !r.isFallback &&
      (r.source === 'live' || r.source === 'cache' || r.source === 'saved' || r.source === 'naver')
  );
  const hasWalkingSegments = routes.some((r) => r.travelMode === 'walking');
  const hasDrivingRoutes = drivingSegments.length > 0;

  const totalDrivingDistanceMeter = drivingSegments.reduce((acc, r) => acc + (r.distanceMeter || 0), 0);
  const totalDrivingDurationSec = drivingSegments.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);

  const formattedDrivingDist =
    totalDrivingDistanceMeter >= 1000
      ? `${(totalDrivingDistanceMeter / 1000).toFixed(1)}km`
      : `${totalDrivingDistanceMeter}m`;

  const totalDrivingMins = Math.ceil(totalDrivingDurationSec / 60);
  const formattedDrivingDuration =
    totalDrivingMins < 60
      ? `${totalDrivingMins}분`
      : `${Math.floor(totalDrivingMins / 60)}시간 ${totalDrivingMins % 60}분`;

  const getSourceBadgeLabel = () => {
    if (!routeSource || routeSource === 'live') return '최신 예상 경로';
    if (routeSource === 'saved') return '저장된 예상 경로';
    if (routeSource === 'cache') return '서버 캐시 예상 경로';
    if (routeSource === 'stale-cache') return '이전 계산 결과';
    return '예상 경로';
  };

  const formattedCalcTime = calculatedAt
    ? new Date(calculatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Render Empty State if fewer than 2 places
  if (blockCount < 2) {
    return null;
  }

  // Desktop Floating Badge Component (rendered inside NaverMap.tsx at bottom-right)
  return (
    <div className="hidden md:flex flex-col gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/70 text-white px-4 py-3 rounded-2xl shadow-xl z-10 max-w-xs border-l-4 border-l-emerald-500">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {getSourceBadgeLabel()}
          </span>
          {formattedCalcTime && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{formattedCalcTime}</span>
            </span>
          )}
        </div>

        {onForceRefreshRoute && (
          <button
            type="button"
            onClick={onForceRefreshRoute}
            disabled={isRefreshingRoute || refreshCooldownSeconds > 0}
            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-400 hover:text-emerald-300 rounded-lg text-[10px] font-semibold transition-all border border-slate-700/60 active:scale-95"
            title="현재 Day의 자동차 예상 시간 실시간 재계산"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingRoute ? 'animate-spin' : ''}`} />
            <span>
              {isRefreshingRoute
                ? '계산중...'
                : refreshCooldownSeconds > 0
                ? `${refreshCooldownSeconds}초`
                : '예상 시간 새로고침'}
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
          <Navigation className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-slate-400">
            {hasWalkingSegments ? '예상 자동차 이동 거리/시간 (도보 구간 제외)' : '예상 자동차 이동 거리/시간'}
          </div>
          <div className="text-xs font-bold text-slate-100 flex items-center gap-2 mt-0.5">
            {hasDrivingRoutes ? (
              <>
                <span>{formattedDrivingDist}</span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400">{formattedDrivingDuration}</span>
              </>
            ) : (
              <span className="text-slate-400 text-[11px]">자동차 이동 경로를 계산할 수 없습니다.</span>
            )}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 leading-tight pt-1 border-t border-slate-800/60">
        * 실제 이동 거리와 시간은 교통 상황 및 경로에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}
