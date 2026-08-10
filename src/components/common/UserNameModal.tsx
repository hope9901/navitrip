'use client';

import React, { useState, useId } from 'react';
import { User, Sparkles, Check, ArrowRight } from 'lucide-react';

interface UserNameModalProps {
  isOpen: boolean;
  onSaveUserName: (name: string) => void;
  onClose?: () => void;
  currentName?: string;
  isChangeMode?: boolean;
}

export default function UserNameModal({
  isOpen,
  onSaveUserName,
  onClose,
  currentName = '',
  isChangeMode = false,
}: UserNameModalProps) {
  const nameInputId = useId();
  const [name, setName] = useState(currentName);
  const [prevCurrentName, setPrevCurrentName] = useState(currentName);

  if (currentName !== prevCurrentName) {
    setPrevCurrentName(currentName);
    setName(currentName);
  }

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('이름(닉네임)을 1자 이상 입력해 주세요.');
      return;
    }
    setError('');
    onSaveUserName(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-5 shadow-2xl relative">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <User className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-white">
            {isChangeMode ? '사용자 이름 변경' : '여행 일정에 오신 것을 환영합니다!'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            저장하신 여행 일정은 본인 이름으로 관리되며,<br />
            이름별로 일정이 구분되어 안전하게 보관됩니다.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={nameInputId} className="text-[11px] font-semibold text-slate-300">
              사용자(작성자) 이름 입력
            </label>
            <input
              id={nameInputId}
              name="userName"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="예: 홍길동, 김철수"
              autoFocus
              maxLength={20}
              className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
            />
            {error && <span className="text-[11px] text-rose-400 font-medium">{error}</span>}
          </div>

          <div className="flex items-center gap-2 pt-2">
            {isChangeMode && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95"
            >
              <span>{isChangeMode ? '변경하기' : '시작하기'}</span>
              {isChangeMode ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          <span>공유받은 링크도 본인 이름으로 편집 및 저장할 수 있습니다.</span>
        </div>
      </div>
    </div>
  );
}
