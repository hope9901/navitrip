'use client';

import React from 'react';
import { Compass } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-14 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl text-white shadow-md shadow-emerald-500/20">
          <Compass className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm md:text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
            <span>NaviTrip</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Naver Map
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 hidden sm:block">
            네이버 길찾기 자동차 경로 & 일정 공유
          </p>
        </div>
      </div>
    </header>
  );
}
