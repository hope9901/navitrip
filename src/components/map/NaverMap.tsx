'use client';

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Place, ItineraryBlock, RouteSegment, SavedMapView, MapFocusRequest } from '@/types/itinerary';
import { getNaverMapSearchUrl } from '@/lib/naverMapUrl';
import RouteSummaryCard from '@/components/itinerary/RouteSummaryCard';
import { AlertTriangle, Maximize2, Info } from 'lucide-react';

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
  routeSource?: 'live' | 'cache' | 'saved' | 'stale-cache' | 'fallback' | null;
  calculatedAt?: string | null;
  onForceRefreshRoute?: () => void;
  isRefreshingRoute?: boolean;
  refreshCooldownSeconds?: number;
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
    routeSource,
    calculatedAt,
    onForceRefreshRoute,
    isRefreshingRoute = false,
    refreshCooldownSeconds = 0,
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
  const blocksRef = useRef<ItineraryBlock[]>(blocks);
  blocksRef.current = blocks;

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    if (typeof window !== 'undefined' && window.naver && window.naver.maps) {
      return true;
    }
    return false;
  });
  const [mapError, setMapError] = useState<string | null>(null);
  const [coordWarning, setCoordWarning] = useState<string | null>(null);

  // Fit bounds helper function - Closes InfoWindow when "전체 보기" is triggered
  const fitAllBounds = useCallback(() => {
    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const validBlocks = blocksRef.current.filter((b) => {
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
  }, []);

  // Expose getMapView and fitAllBounds to parent via Ref
  useImperativeHandle(
    ref,
    () => ({
      getMapView: () => {
        if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return null;
        try {
          const center = mapInstance.current.getCenter() as naver.maps.LatLng;
          const zoom = mapInstance.current.getZoom();
          const bounds = mapInstance.current.getBounds() as naver.maps.LatLngBounds;

          const centerLat = typeof center.lat === 'function' ? center.lat() : Number((center as unknown as { y: number }).y);
          const centerLng = typeof center.lng === 'function' ? center.lng() : Number((center as unknown as { x: number }).x);

          if (bounds && typeof bounds.getNE === 'function') {
            const ne = bounds.getNE();
            const sw = bounds.getSW();
            return {
              center: { lat: centerLat, lng: centerLng },
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
            center: { lat: centerLat, lng: centerLng },
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
          return;
        }
      }

      // Fallback: fitAllBounds
      fitAllBounds();
    },
    [fitAllBounds]
  );

  // Execute Focus Request helper - STABLE REFERENCE
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

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      // On mobile, offset center latitude down by ~0.002 degrees so marker is in visible upper viewport above bottom sheet
      const centerLat = isMobile ? lat - 0.002 : lat;
      const centerPos = new naver.maps.LatLng(centerLat, lng);
      const targetPos = new naver.maps.LatLng(lat, lng);

      mapInstance.current.setCenter(centerPos);
      mapInstance.current.setZoom(15);

      const currentBlocks = blocksRef.current;
      const matchingBlock = currentBlocks.find(
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

      const naverSearchUrl = getNaverMapSearchUrl(placeData);

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
            naverSearchUrl
              ? `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                  <a href="${naverSearchUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: #38bdf8;
                    font-weight: 600;
                    text-decoration: none;
                  ">
                    네이버에서 사진·리뷰 보기 ↗
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
    []
  );

  // Initialize Map Instance with dynamic zoomControl based on screen width
  useEffect(() => {
    if (!isScriptLoaded || !mapElement.current || mapInstance.current) return;

    try {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const defaultCenter = new naver.maps.LatLng(37.5665, 126.9780);
      const mapOptions: naver.maps.MapOptions = {
        center: defaultCenter,
        zoom: 12,
        minZoom: 6,
        maxZoom: 19,
        zoomControl: !isMobile,
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

      // Auto-close InfoWindow when user zooms out past threshold (zoom <= 12)
      naver.maps.Event.addListener(mapInstance.current, 'zoom_changed', (zoom: number) => {
        if (zoom <= 12 && infoWindowRef.current) {
          infoWindowRef.current.close();
        }
      });

      if (onMapReadyChange) {
        onMapReadyChange(true);
      }

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

  // Window Resize Listener for dynamic zoomControl option updates (Mobile vs Desktop)
  useEffect(() => {
    const handleWindowResize = () => {
      if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;
      const isMobile = window.innerWidth < 768;
      mapInstance.current.setOptions({
        zoomControl: !isMobile,
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // ResizeObserver for Map DOM element resizing
  useEffect(() => {
    if (!mapElement.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstance.current && typeof naver !== 'undefined' && naver.maps) {
        try {
          naver.maps.Event.trigger(mapInstance.current, 'resize');
        } catch {
          // ignore
        }
      }
    });
    observer.observe(mapElement.current);
    return () => observer.disconnect();
  }, []);

  // Render Markers & Polylines
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

  // Priority 3: Initial plan load or Day change
  useEffect(() => {
    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;
    if (dayChangeKey) {
      fitAllBounds();
    }
  }, [dayChangeKey, fitAllBounds]);

  // Priority 1: Focus Request
  useEffect(() => {
    if (!focusRequest) return;

    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) {
      pendingFocusRequestRef.current = focusRequest;
      return;
    }

    executeFocusRequest(focusRequest);
  }, [focusRequest, executeFocusRequest]);

  const hasFallbackRoute = routes.some((r) => r.isFallback || r.source === 'fallback');

  return (
    <div className="relative w-full h-full min-h-[250px] bg-slate-900 overflow-hidden">
      <div ref={mapElement} className="w-full h-full" />

      {/* Manual "Fit All Bounds" Camera Control Button */}
      {blocks.length > 0 && isScriptLoaded && !mapError && (
        <button
          type="button"
          onClick={fitAllBounds}
          className="absolute top-4 left-4 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold shadow-xl z-20 flex items-center gap-1.5 transition-all active:scale-95 min-h-[38px]"
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
        <div className="absolute top-4 right-14 md:right-14 bg-slate-900/90 border border-slate-700 backdrop-blur-md text-slate-300 text-xs px-3 py-2 rounded-xl z-20 flex items-center gap-2 shadow-lg max-w-[260px] md:max-w-none truncate">
          <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{routeErrorMessage || '자동차 경로를 불러오지 못해 직선거리만 표시합니다.'}</span>
        </div>
      )}

      {/* Desktop Floating Route Summary Card (hidden on mobile, floating bottom-right on desktop) */}
      <div className="absolute bottom-6 right-6 z-10 hidden md:flex">
        <RouteSummaryCard
          routes={routes}
          routeSource={routeSource}
          calculatedAt={calculatedAt}
          onForceRefreshRoute={onForceRefreshRoute}
          isRefreshingRoute={isRefreshingRoute}
          refreshCooldownSeconds={refreshCooldownSeconds}
          variant="desktop"
          blockCount={blocks.length}
        />
      </div>
    </div>
  );
});

export default NaverMap;
