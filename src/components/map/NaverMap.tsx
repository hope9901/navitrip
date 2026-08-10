'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Place, ItineraryBlock, RouteSegment } from '@/types/itinerary';
import { MapPin, Navigation, Info } from 'lucide-react';

interface NaverMapProps {
  blocks: ItineraryBlock[];
  routes: RouteSegment[];
  selectedPlace?: Place | null;
  clientId?: string;
  onMarkerClick?: (block: ItineraryBlock) => void;
}

declare global {
  interface Window {
    naver: any;
  }
}

export default function NaverMap({
  blocks,
  routes,
  selectedPlace,
  clientId,
  onMarkerClick,
}: NaverMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Load Naver Map Script dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.naver && window.naver.maps) {
      setIsScriptLoaded(true);
      return;
    }

    const ncpClientId = clientId || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || '';
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${ncpClientId}`;
    script.async = true;

    script.onload = () => {
      if (window.naver && window.naver.maps) {
        setIsScriptLoaded(true);
      } else {
        setMapError('네이버 지도 스크립트를 로드하지 못했습니다.');
      }
    };

    script.onerror = () => {
      setMapError('네이버 지도 API 키를 확인해주세요.');
    };

    document.head.appendChild(script);
  }, [clientId]);

  // Initialize Map Instance
  useEffect(() => {
    if (!isScriptLoaded || !mapElement.current || mapInstance.current) return;

    try {
      const defaultCenter = new window.naver.maps.LatLng(37.5665, 126.9780); // Seoul default
      const mapOptions = {
        center: defaultCenter,
        zoom: 12,
        minZoom: 6,
        maxZoom: 19,
        zoomControl: true,
        zoomControlOptions: {
          position: window.naver.maps.Position.TOP_RIGHT,
        },
      };

      mapInstance.current = new window.naver.maps.Map(mapElement.current, mapOptions);
      infoWindowRef.current = new window.naver.maps.InfoWindow({
        borderWidth: 0,
        backgroundColor: 'transparent',
        disableAnchor: false,
      });
    } catch (e) {
      console.error('Failed to initialize Naver Map:', e);
    }
  }, [isScriptLoaded]);

  // Update Markers & Paths when blocks or routes change
  useEffect(() => {
    if (!mapInstance.current || !window.naver || !window.naver.maps) return;

    // Clear existing markers & polylines
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (blocks.length === 0) return;

    const bounds = new window.naver.maps.LatLngBounds();

    // Create markers for each block
    blocks.forEach((block, idx) => {
      const position = new window.naver.maps.LatLng(block.place.lat, block.place.lng);
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

      const marker = new window.naver.maps.Marker({
        position,
        map: mapInstance.current,
        title: block.place.title,
        icon: {
          content: markerContent,
          anchor: new window.naver.maps.Point(17, 17),
        },
      });

      window.naver.maps.Event.addListener(marker, 'click', () => {
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

        infoWindowRef.current.setContent(infoContent);
        infoWindowRef.current.open(mapInstance.current, marker);
      });

      markersRef.current.push(marker);
    });

    // Draw Polylines for routes
    routes.forEach((route) => {
      if (route.path && route.path.length > 0) {
        const linePath = route.path.map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
        const polyline = new window.naver.maps.Polyline({
          map: mapInstance.current,
          path: linePath,
          strokeColor: '#10b981',
          strokeWeight: 5,
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
        });
        polylinesRef.current.push(polyline);
      }
    });

    // Fit map bounds to encompass all markers
    if (blocks.length > 0) {
      mapInstance.current.fitBounds(bounds, {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60,
      });
    }
  }, [blocks, routes, onMarkerClick]);

  // Center map when selectedPlace changes
  useEffect(() => {
    if (!mapInstance.current || !selectedPlace || !window.naver) return;
    const targetPos = new window.naver.maps.LatLng(selectedPlace.lat, selectedPlace.lng);
    mapInstance.current.panTo(targetPos);
    mapInstance.current.setZoom(15);
  }, [selectedPlace]);

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-900 overflow-hidden">
      {/* Map Container */}
      <div ref={mapElement} className="w-full h-full" />

      {/* Map Overlay Loading / Error states */}
      {!isScriptLoaded && !mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 text-white">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-300">네이버 지도를 불러오는 중...</p>
        </div>
      )}

      {mapError && (
        <div className="absolute top-4 left-4 right-4 bg-amber-500/10 border border-amber-500/30 backdrop-blur-md text-amber-200 text-xs p-3 rounded-xl z-10 flex items-center gap-2 shadow-lg">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{mapError} (API 키를 연동하면 네이버 지도 및 길찾기가 완벽히 작동합니다.)</span>
        </div>
      )}

      {/* Route Summary Floating Badge */}
      {blocks.length > 1 && routes.length > 0 && (
        <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-white px-4 py-2.5 rounded-2xl shadow-xl z-10 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">총 자동차 이동 거리/시간</div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>{routes.reduce((acc, r) => acc + r.distanceMeter, 0) >= 1000 ? `${(routes.reduce((acc, r) => acc + r.distanceMeter, 0) / 1000).toFixed(1)}km` : `${routes.reduce((acc, r) => acc + r.distanceMeter, 0)}m`}</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">
                {Math.floor(routes.reduce((acc, r) => acc + r.durationSeconds, 0) / 3600) > 0 ? `${Math.floor(routes.reduce((acc, r) => acc + r.durationSeconds, 0) / 3600)}시간 ` : ''}
                {Math.ceil((routes.reduce((acc, r) => acc + r.durationSeconds, 0) % 3600) / 60)}분
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
