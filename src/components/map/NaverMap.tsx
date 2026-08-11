'use client';

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Place, ItineraryBlock, RouteSegment, SavedMapView, MapFocusRequest } from '@/types/itinerary';
import { getNaverMapUrl } from '@/lib/naverMapUrl';
import { Navigation, AlertTriangle, Maximize2, Info } from 'lucide-react';

export interface NaverMapRefHandle {
  getMapView: () => SavedMapView | null;
  fitAllBounds: () => void;
}

interface NaverMapProps {
  blocks: ItineraryBlock[];
  routes: RouteSegment[];
  selectedPlace?: Place | null;
  selectedBlockId?: string | null;
  focusRequest?: MapFocusRequest | null;
  initialMapView?: SavedMapView | null;
  dayChangeKey?: string | number;
  clientId?: string;
  onMarkerClick?: (block: ItineraryBlock) => void;
  routeErrorMessage?: string | null;
  isMapReady?: boolean;
  onMapReadyChange?: (ready: boolean) => void;
}

const NaverMap = forwardRef<NaverMapRefHandle, NaverMapProps>(function NaverMap(
  {
    blocks,
    routes,
    focusRequest,
    initialMapView,
    dayChangeKey,
    clientId,
    onMarkerClick,
    routeErrorMessage,
    onMapReadyChange,
  },
  ref
) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  const polylinesRef = useRef<naver.maps.Polyline[]>([]);
  const infoWindowRef = useRef<naver.maps.InfoWindow | null>(null);
  const pendingFocusRequestRef = useRef<MapFocusRequest | null>(null);
  const hasAppliedInitialViewRef = useRef<boolean>(false);

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    if (typeof window !== 'undefined' && window.naver && window.naver.maps) {
      return true;
    }
    return false;
  });
  const [mapError, setMapError] = useState<string | null>(null);
  const [coordWarning, setCoordWarning] = useState<string | null>(null);

  // Fit bounds helper function (Priority 2 & 3)
  const fitAllBounds = useCallback(() => {
    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;

    const validBlocks = blocks.filter((b) => {
      const lat = Number(b.place.lat);
      const lng = Number(b.place.lng);
      return Number.isFinite(lat) && lat >= 33 && lat <= 39 && Number.isFinite(lng) && lng >= 124 && lng <= 132;
    });

    if (validBlocks.length === 0) return;

    if (validBlocks.length === 1) {
      const pos = new naver.maps.LatLng(validBlocks[0].place.lat, validBlocks[0].place.lng);
      mapInstance.current.setCenter(pos);
      mapInstance.current.setZoom(15);
      return;
    }

    const firstPos = new naver.maps.LatLng(validBlocks[0].place.lat, validBlocks[0].place.lng);
    const bounds = new naver.maps.LatLngBounds(firstPos, firstPos);

    validBlocks.forEach((b) => {
      bounds.extend(new naver.maps.LatLng(b.place.lat, b.place.lng));
    });

    mapInstance.current.fitBounds(bounds, {
      top: 60,
      right: 60,
      bottom: 60,
      left: 60,
    });
  }, [blocks]);

  // Expose getMapView and fitAllBounds to parent via Ref
  useImperativeHandle(
    ref,
    () => ({
      getMapView: () => {
        if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return null;
        try {
          const center = mapInstance.current.getCenter();
          const zoom = mapInstance.current.getZoom();
          const bounds = mapInstance.current.getBounds() as naver.maps.LatLngBounds;

          if (bounds && typeof bounds.getNE === 'function') {
            const ne = bounds.getNE();
            const sw = bounds.getSW();
            return {
              center: { lat: center.lat(), lng: center.lng() },
              zoom,
              bounds: {
                north: ne.lat(),
                east: ne.lng(),
                south: sw.lat(),
                west: sw.lng(),
              },
            };
          }

          return {
            center: { lat: center.lat(), lng: center.lng() },
            zoom,
          };
        } catch (err) {
          console.error('Error getting map view:', err);
          return null;
        }
      },
      fitAllBounds,
    }),
    [fitAllBounds]
  );

  // Load Naver Map Script dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.naver && window.naver.maps) {
      return;
    }

    const ncpKeyId =
      clientId ||
      process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ||
      '';

    if (!ncpKeyId || ncpKeyId.includes('your_')) {
      const timer = setTimeout(() => {
        setMapError('네이버 Client ID가 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID에 설정되지 않았습니다.');
      }, 0);
      return () => clearTimeout(timer);
    }

    const scriptId = 'naver-map-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'text/javascript';
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${ncpKeyId}`;
      script.async = true;
      document.head.appendChild(script);
    }

    script.onload = () => {
      if (window.naver && window.naver.maps) {
        setIsScriptLoaded(true);
      } else {
        setMapError('네이버 지도 스크립트를 준비하지 못했습니다.');
      }
    };

    script.onerror = () => {
      setMapError('네이버 지도 API 인증 실패 (NCP 콘솔의 Web 서비스 URL 등록을 확인하세요)');
    };
  }, [clientId]);

  // Apply initial saved mapView or initial bounds
  const applyInitialViewport = useCallback(
    (view?: SavedMapView | null) => {
      if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;

      if (view && view.center) {
        const lat = Number(view.center.lat);
        const lng = Number(view.center.lng);
        const validLat = Number.isFinite(lat) && lat >= 33 && lat <= 39;
        const validLng = Number.isFinite(lng) && lng >= 124 && lng <= 132;

        if (validLat && validLng) {
          if (
            view.bounds &&
            Number.isFinite(view.bounds.south) &&
            Number.isFinite(view.bounds.west) &&
            Number.isFinite(view.bounds.north) &&
            Number.isFinite(view.bounds.east)
          ) {
            const sw = new naver.maps.LatLng(view.bounds.south, view.bounds.west);
            const ne = new naver.maps.LatLng(view.bounds.north, view.bounds.east);
            const bounds = new naver.maps.LatLngBounds(sw, ne);
            mapInstance.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
          } else {
            const center = new naver.maps.LatLng(lat, lng);
            mapInstance.current.setCenter(center);
            if (view.zoom && Number.isFinite(view.zoom)) {
              mapInstance.current.setZoom(view.zoom);
            }
          }
          hasAppliedInitialViewRef.current = true;
          return;
        }
      }

      // Fallback: fitAllBounds
      fitAllBounds();
      hasAppliedInitialViewRef.current = true;
    },
    [fitAllBounds]
  );

  // Execute Focus Request helper
  const executeFocusRequest = useCallback(
    (req: MapFocusRequest) => {
      if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;

      const lat = Number(req.lat);
      const lng = Number(req.lng);

      const isValidLat = Number.isFinite(lat) && lat >= 33 && lat <= 39;
      const isValidLng = Number.isFinite(lng) && lng >= 124 && lng <= 132;

      if (!isValidLat || !isValidLng) {
        const warningMsg = `'${req.title || '장소'}'의 좌표가 올바르지 않아 지도를 이동할 수 없습니다. (lat: ${lat}, lng: ${lng})`;
        console.warn('[NaverMap]', warningMsg);
        setCoordWarning(warningMsg);
        setTimeout(() => setCoordWarning(null), 4000);
        return;
      }

      const targetPos = new naver.maps.LatLng(lat, lng);
      mapInstance.current.panTo(targetPos, {});
      mapInstance.current.setZoom(15, true);

      // Open InfoWindow if matching marker exists or construct temporary InfoWindow
      const matchingBlock = blocks.find(
        (b) => b.id === req.blockId || b.place.id === req.placeId || (Math.abs(b.place.lat - lat) < 0.0001 && Math.abs(b.place.lng - lng) < 0.0001)
      );

      const placeData: Partial<Place> = matchingBlock
        ? matchingBlock.place
        : {
            title: req.title || '선택한 장소',
            address: req.address || '',
            lat,
            lng,
          };

      const naverUrl = getNaverMapUrl(placeData);

      const infoContent = `
        <div style="
          padding: 12px 16px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          color: #f8fafc;
          min-width: 220px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          font-family: sans-serif;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #ffffff;">${placeData.title}</h4>
            ${
              placeData.category && placeData.category !== '주소'
                ? `<span style="font-size: 10px; background: rgba(51, 65, 85, 0.8); color: #cbd5e1; padding: 2px 6px; border-radius: 4px;">${placeData.category.split('>').pop()?.trim()}</span>`
                : ''
            }
          </div>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">${placeData.roadAddress || placeData.address || ''}</p>
          ${
            placeData.telephone
              ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">📞 ${placeData.telephone}</p>`
              : ''
          }
          ${
            naverUrl
              ? `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                  <a href="${naverUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: #38bdf8;
                    font-weight: 600;
                    text-decoration: none;
                  ">
                    네이버 지도 상세보기 ↗
                  </a>
                </div>`
              : ''
          }
        </div>
      `;

      if (infoWindowRef.current) {
        infoWindowRef.current.setContent(infoContent);

        const markerKey = req.blockId || (matchingBlock ? matchingBlock.id : null);
        if (markerKey && markersRef.current.has(markerKey)) {
          infoWindowRef.current.open(mapInstance.current!, markersRef.current.get(markerKey)!);
        } else {
          infoWindowRef.current.open(mapInstance.current!, targetPos);
        }
      }
    },
    [blocks]
  );

  // Initialize Map Instance
  useEffect(() => {
    if (!isScriptLoaded || !mapElement.current || mapInstance.current) return;

    try {
      const defaultCenter = new naver.maps.LatLng(37.5665, 126.9780);
      const mapOptions: naver.maps.MapOptions = {
        center: defaultCenter,
        zoom: 12,
        minZoom: 6,
        maxZoom: 19,
        zoomControl: true,
        zoomControlOptions: {
          position: naver.maps.Position.TOP_RIGHT,
        },
      };

      mapInstance.current = new naver.maps.Map(mapElement.current, mapOptions);
      infoWindowRef.current = new naver.maps.InfoWindow({
        content: '',
        borderWidth: 0,
        backgroundColor: 'transparent',
        disableAnchor: false,
      });

      if (onMapReadyChange) {
        onMapReadyChange(true);
      }

      // Apply initial view or pending focus request
      applyInitialViewport(initialMapView);

      if (pendingFocusRequestRef.current) {
        const req = pendingFocusRequestRef.current;
        pendingFocusRequestRef.current = null;
        executeFocusRequest(req);
      }
    } catch (e: unknown) {
      console.error('Failed to initialize Naver Map:', e);
      const timer = setTimeout(() => {
        setMapError('네이버 지도 인증 실패 (NCP 콘솔의 Web 서비스 URL 설정을 확인해 주세요)');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isScriptLoaded, initialMapView, applyInitialViewport, executeFocusRequest, onMapReadyChange]);

  // Render Markers & Polylines (DOES NOT call fitBounds)
  useEffect(() => {
    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;

    try {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();

      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];

      const validBlocks = blocks.filter((b) => {
        const lat = Number(b.place.lat);
        const lng = Number(b.place.lng);
        return Number.isFinite(lat) && lat >= 33 && lat <= 39 && Number.isFinite(lng) && lng >= 124 && lng <= 132;
      });

      validBlocks.forEach((block, idx) => {
        const position = new naver.maps.LatLng(block.place.lat, block.place.lng);

        const markerContent = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            font-weight: 700;
            font-size: 14px;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 0 0 0 3px rgba(255, 255, 255, 0.9);
            cursor: pointer;
            transition: transform 0.2s ease;
          ">
            ${idx + 1}
          </div>
        `;

        const marker = new naver.maps.Marker({
          position,
          map: mapInstance.current!,
          title: block.place.title,
          icon: {
            content: markerContent,
            anchor: new naver.maps.Point(17, 17),
          },
        });

        naver.maps.Event.addListener(marker, 'click', () => {
          if (onMarkerClick) onMarkerClick(block);

          executeFocusRequest({
            requestId: Date.now(),
            placeId: block.place.id,
            blockId: block.id,
            lat: block.place.lat,
            lng: block.place.lng,
            title: block.place.title,
            address: block.place.roadAddress || block.place.address,
            source: 'marker',
          });
        });

        markersRef.current.set(block.id, marker);
      });

      // Polylines rendering
      routes.forEach((route) => {
        if (route.path && route.path.length > 0) {
          const linePath = route.path.map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
          const isFallback = route.isFallback || route.source === 'fallback';

          const polyline = new naver.maps.Polyline({
            map: mapInstance.current!,
            path: linePath,
            strokeColor: isFallback ? '#94a3b8' : '#10b981',
            strokeWeight: isFallback ? 4 : 5,
            strokeOpacity: isFallback ? 0.6 : 0.85,
            strokeStyle: isFallback ? 'dash' : 'solid',
          });
          polylinesRef.current.push(polyline);
        }
      });
    } catch (e: unknown) {
      console.error('Error rendering markers or routes:', e);
    }
  }, [blocks, routes, onMarkerClick, executeFocusRequest]);

  // Priority 3: Initial plan load or Day change (fitBounds EXACTLY ONCE)
  useEffect(() => {
    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;
    if (dayChangeKey) {
      fitAllBounds();
    }
  }, [dayChangeKey, fitAllBounds]);

  // Priority 1: Focus Request (triggers panTo at zoom 15 + infoWindow)
  useEffect(() => {
    if (!focusRequest) return;

    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) {
      pendingFocusRequestRef.current = focusRequest;
      return;
    }

    executeFocusRequest(focusRequest);
  }, [focusRequest, executeFocusRequest]);

  // Driving Distance & Duration Calculation Rules (Only sum Naver API driving routes, exclude fallbacks)
  const drivingSegments = routes.filter((r) => !r.isFallback && r.source === 'naver');
  const hasDrivingRoutes = drivingSegments.length > 0;
  const hasFallbackRoute = routes.some((r) => r.isFallback || r.source === 'fallback');

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

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-900 overflow-hidden">
      <div ref={mapElement} className="w-full h-full" />

      {/* Manual "Fit All Bounds" Camera Control Button */}
      {blocks.length > 0 && isScriptLoaded && !mapError && (
        <button
          type="button"
          onClick={fitAllBounds}
          className="absolute top-4 left-4 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold shadow-xl z-20 flex items-center gap-1.5 transition-all active:scale-95"
          title="전체 일정 장소 지도에 한눈에 보기"
        >
          <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>전체 보기</span>
        </button>
      )}

      {!isScriptLoaded && !mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 text-white">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-300">네이버 지도를 연결하는 중...</p>
        </div>
      )}

      {/* Map Auth Error Banner */}
      {mapError && (
        <div className="absolute top-4 left-4 right-4 bg-slate-900/95 border border-rose-500/50 backdrop-blur-md text-rose-200 text-xs p-4 rounded-2xl z-20 flex items-start gap-3 shadow-2xl">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-rose-300 text-sm">네이버 지도 인증 실패</h4>
            <p className="text-slate-300 leading-relaxed">{mapError}</p>
          </div>
        </div>
      )}

      {/* Coordinate Warning Alert Banner */}
      {coordWarning && (
        <div className="absolute top-16 left-4 right-4 bg-amber-500/10 border border-amber-500/40 backdrop-blur-md text-amber-200 text-xs p-3 rounded-xl z-20 flex items-center gap-2 shadow-xl animate-fadeIn">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{coordWarning}</span>
        </div>
      )}

      {/* Driving Route Failure / Fallback Notice */}
      {(hasFallbackRoute || routeErrorMessage) && !mapError && (
        <div className="absolute top-4 right-14 bg-slate-900/90 border border-slate-700 backdrop-blur-md text-slate-300 text-xs px-3 py-2 rounded-xl z-20 flex items-center gap-2 shadow-lg">
          <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{routeErrorMessage || '자동차 경로를 불러오지 못해 직선거리만 표시합니다.'}</span>
        </div>
      )}

      {/* Route Distance & Duration Summary Badge (Wording & Calculation updated per Section 2) */}
      {blocks.length > 1 && !mapError && (
        <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-white px-4 py-3 rounded-2xl shadow-xl z-10 flex flex-col gap-1.5 max-w-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">
                {hasDrivingRoutes ? '예상 자동차 이동 거리/시간' : '자동차 이동 경로 안내'}
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
      )}
    </div>
  );
});

export default NaverMap;
