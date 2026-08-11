'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Place, ItineraryBlock, RouteSegment } from '@/types/itinerary';
import { Navigation, AlertTriangle } from 'lucide-react';

interface NaverMapProps {
  blocks: ItineraryBlock[];
  routes: RouteSegment[];
  selectedPlace?: Place | null;
  clientId?: string;
  onMarkerClick?: (block: ItineraryBlock) => void;
}

export default function NaverMap({
  blocks,
  routes,
  selectedPlace,
  clientId,
  onMarkerClick,
}: NaverMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const polylinesRef = useRef<naver.maps.Polyline[]>([]);
  const infoWindowRef = useRef<naver.maps.InfoWindow | null>(null);

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    if (typeof window !== 'undefined' && window.naver && window.naver.maps) {
      return true;
    }
    return false;
  });
  const [mapError, setMapError] = useState<string | null>(null);

  // Load Naver Map Script dynamically with ncpKeyId
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.naver && window.naver.maps) {
      return;
    }

    const ncpKeyId =
      clientId ||
      process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ||
      process.env.NAVER_MAP_CLIENT_ID ||
      '';

    if (!ncpKeyId || ncpKeyId.includes('your_')) {
      const timer = setTimeout(() => {
        setMapError('네이버 Client ID가 .env.local에 설정되지 않았습니다.');
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
    } catch (e: unknown) {
      console.error('Failed to initialize Naver Map:', e);
      const timer = setTimeout(() => {
        setMapError('네이버 지도 인증 실패 (NCP 콘솔의 Web 서비스 URL 설정을 확인해 주세요)');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isScriptLoaded]);

  // Update Markers & Paths when blocks or routes change
  useEffect(() => {
    if (!mapInstance.current || typeof naver === 'undefined' || !naver.maps) return;

    try {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];

      const validBlocks = blocks.filter((b) => {
        const lat = Number(b.place.lat);
        const lng = Number(b.place.lng);
        return Number.isFinite(lat) && lat >= 33 && lat <= 39 && Number.isFinite(lng) && lng >= 124 && lng <= 132;
      });

      if (validBlocks.length === 0) return;

      const firstPosition = new naver.maps.LatLng(
        validBlocks[0].place.lat,
        validBlocks[0].place.lng
      );
      const bounds = new naver.maps.LatLngBounds(
        firstPosition,
        firstPosition
      );

      validBlocks.forEach((block, idx) => {
        const position = new naver.maps.LatLng(block.place.lat, block.place.lng);
        bounds.extend(position);

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

          const infoContent = `
            <div style="
              padding: 12px 16px;
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(8px);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 12px;
              color: #f8fafc;
              min-width: 200px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
              font-family: sans-serif;
            ">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="
                  background: #10b981;
                  color: white;
                  font-size: 11px;
                  font-weight: bold;
                  padding: 2px 6px;
                  border-radius: 4px;
                ">#${idx + 1}</span>
                <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #ffffff;">${block.place.title}</h4>
              </div>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">${block.place.roadAddress || block.place.address}</p>
              ${
                block.place.link
                  ? `<a href="${block.place.link}" target="_blank" style="
                      display: inline-block;
                      margin-top: 8px;
                      font-size: 11px;
                      color: #38bdf8;
                      text-decoration: none;
                      font-weight: 600;
                    ">네이버 상세 정보 ↗</a>`
                  : ''
              }
            </div>
          `;

          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(infoContent);
            infoWindowRef.current.open(mapInstance.current!, marker);
          }
        });

        markersRef.current.push(marker);
      });

      routes.forEach((route) => {
        if (route.path && route.path.length > 0) {
          const linePath = route.path.map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
          const polyline = new naver.maps.Polyline({
            map: mapInstance.current!,
            path: linePath,
            strokeColor: '#10b981',
            strokeWeight: 5,
            strokeOpacity: 0.8,
            strokeStyle: 'solid',
          });
          polylinesRef.current.push(polyline);
        }
      });

      if (validBlocks.length > 0) {
        mapInstance.current.fitBounds(bounds, {
          top: 60,
          right: 60,
          bottom: 60,
          left: 60,
        });
      }
    } catch (e: unknown) {
      console.error('Error rendering markers or routes:', e);
    }
  }, [blocks, routes, onMarkerClick]);

  // Center map smoothly when selectedPlace changes
  useEffect(() => {
    if (!mapInstance.current || !selectedPlace || typeof naver === 'undefined' || !naver.maps) return;
    try {
      const lat = Number(selectedPlace.lat);
      const lng = Number(selectedPlace.lng);

      const isValidLat = Number.isFinite(lat) && lat >= 33 && lat <= 39;
      const isValidLng = Number.isFinite(lng) && lng >= 124 && lng <= 132;

      if (!isValidLat || !isValidLng) {
        console.warn('[NaverMap] Refusing to pan to invalid coordinates:', selectedPlace);
        return;
      }

      const targetPos = new naver.maps.LatLng(lat, lng);
      mapInstance.current.panTo(targetPos, {});
      mapInstance.current.setZoom(15, true);
    } catch (e: unknown) {
      console.error('Error panning to place:', e);
    }
  }, [selectedPlace]);

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-900 overflow-hidden">
      <div ref={mapElement} className="w-full h-full" />

      {!isScriptLoaded && !mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 text-white">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-300">네이버 지도를 연결하는 중...</p>
        </div>
      )}

      {mapError && (
        <div className="absolute top-4 left-4 right-4 bg-slate-900/95 border border-rose-500/50 backdrop-blur-md text-rose-200 text-xs p-4 rounded-2xl z-20 flex items-start gap-3 shadow-2xl">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-rose-300 text-sm">네이버 지도 인증 실패</h4>
            <p className="text-slate-300 leading-relaxed">{mapError}</p>
            <div className="mt-2 text-[11px] text-slate-400 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
              <p className="font-semibold text-emerald-400">💡 해결 방법 (Naver Cloud 콘솔):</p>
              <p>1. <b>AI·NAVER API ➔ Application 수정</b> 메뉴로 이동합니다.</p>
              <p>2. <b>Web 서비스 URL</b>에 본인의 Vercel 도메인(예: <code>https://your-app.vercel.app</code>) 및 <code>http://localhost:3000</code>을 추가합니다.</p>
              <p>3. 선택 서비스에서 <b>Web Dynamic Map</b> 항목이 체크되어 있는지 확인합니다.</p>
            </div>
          </div>
        </div>
      )}

      {blocks.length > 1 && routes.length > 0 && !mapError && (
        <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-white px-4 py-2.5 rounded-2xl shadow-xl z-10 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">총 자동차 이동 거리/시간</div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>
                {routes.reduce((acc, r) => acc + r.distanceMeter, 0) >= 1000
                  ? `${(routes.reduce((acc, r) => acc + r.distanceMeter, 0) / 1000).toFixed(1)}km`
                  : `${routes.reduce((acc, r) => acc + r.durationSeconds, 0)}m`}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">
                {Math.floor(routes.reduce((acc, r) => acc + r.durationSeconds, 0) / 3600) > 0
                  ? `${Math.floor(routes.reduce((acc, r) => acc + r.durationSeconds, 0) / 3600)}시간 `
                  : ''}
                {Math.ceil((routes.reduce((acc, r) => acc + r.durationSeconds, 0) % 3600) / 60)}분
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
