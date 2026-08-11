'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 2500 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-emerald-950/95 border border-emerald-500/50 text-emerald-100 text-xs font-semibold rounded-2xl shadow-2xl backdrop-blur-md animate-fadeIn max-w-[90vw]">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="truncate">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="p-1 text-emerald-300 hover:text-white rounded-lg transition-colors ml-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
