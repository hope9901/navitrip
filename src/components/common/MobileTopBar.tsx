'use client';

import React, { useId, useState } from 'react';
import {
  Share2,
  Check,
  Loader2,
  MoreHorizontal,
  Save,
  Edit3,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  User,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { usePlanActions, PlanActionsOptions } from '../itinerary/usePlanActions';
import SavedPlansModals from '../itinerary/SavedPlansModals';

interface MobileTopBarProps extends PlanActionsOptions {
  onChangeUserName?: () => void;
  onForceRefreshRoute?: () => void;
  isRefreshingRoute?: boolean;
  refreshCooldownSeconds?: number;
}

/**
 * 모바일 상단 바: 일정 제목 · 공유 · ⋯(일정 관리) 메뉴.
 * 데스크톱 사이드바 상단의 툴바와 제목 입력을 모바일에서 대체한다.
 */
export default function MobileTopBar(props: MobileTopBarProps) {
  const {
    planTitle,
    setPlanTitle,
    days,
    authorName,
    loadedPlanIdentity,
    onNewPlan,
    onChangeUserName,
    onForceRefreshRoute,
    isRefreshingRoute = false,
    refreshCooldownSeconds = 0,
  } = props;

  const actions = usePlanActions(props);
  const {
    userName,
    isAdmin,
    isSaving,
    copiedShareUrl,
    saveMessage,
    titleError,
    setTitleError,
    isTitleChanged,
    isSharedOriginal,
    saveButtonLabel,
    executeSaveOrShare,
    handleOpenLoadModal,
  } = actions;

  const titleInputId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const totalPlaces = days.reduce((acc, d) => acc + (d.blocks?.length || 0), 0);
  const activeBlockCount = days[props.activeDayIndex]?.blocks?.length || 0;
  const subtitle = isSharedOriginal
    ? `${authorName}님이 공유한 일정 · ${days.length}일 · 장소 ${totalPlaces}곳`
    : `${isAdmin ? 'ADMIN' : userName} · ${days.length}일 · 장소 ${totalPlaces}곳`;

  const saveHint = isSharedOriginal
    ? '공유받은 일정이라 내 일정으로 새로 저장돼요'
    : isTitleChanged
    ? '제목이 바뀌어 새 일정으로 저장돼요'
    : null;

  const runFromMenu = (action?: () => void) => {
    setIsMenuOpen(false);
    action?.();
  };

  const openRename = () => {
    setTitleDraft(planTitle);
    setRenameError(null);
    setIsRenameOpen(true);
  };

  const confirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setRenameError('여행 일정 이름을 입력해 주세요.');
      return;
    }
    setPlanTitle(trimmed);
    setTitleError(null);
    setIsRenameOpen(false);
  };

  const menuItemClass =
    'w-full min-h-[52px] flex items-center gap-3.5 px-3 rounded-xl text-left text-[15px] text-slate-100 hover:bg-slate-900 active:bg-slate-900 disabled:opacity-50 transition-colors';

  return (
    <>
      {/* Top Bar */}
      <div className="fixed top-0 inset-x-0 z-30 md:hidden px-3 pt-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={openRename}
            aria-label={`일정 제목: ${planTitle || '제목 없음'} (눌러서 바꾸기)`}
            className="flex-1 min-w-0 h-14 px-4 rounded-2xl bg-slate-950/95 border border-slate-800 text-left shadow-xl backdrop-blur-md"
          >
            <div className="text-[15px] font-bold text-slate-100 truncate">{planTitle || '제목 없는 일정'}</div>
            <div className={`text-xs truncate ${isSharedOriginal ? 'text-amber-300' : 'text-slate-400'}`}>{subtitle}</div>
          </button>

          <button
            type="button"
            onClick={() => executeSaveOrShare('share')}
            disabled={isSaving}
            aria-label={copiedShareUrl ? '공유 링크 복사됨' : '공유 링크 복사'}
            className="w-14 h-14 shrink-0 rounded-2xl bg-slate-950/95 border border-slate-800 text-slate-100 flex items-center justify-center shadow-xl backdrop-blur-md active:scale-95 transition-transform disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            ) : copiedShareUrl ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Share2 className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="일정 관리 메뉴"
            aria-haspopup="dialog"
            className="w-14 h-14 shrink-0 rounded-2xl bg-slate-950/95 border border-slate-800 text-slate-100 flex items-center justify-center shadow-xl backdrop-blur-md active:scale-95 transition-transform"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Save / Share / Title Feedback */}
        {(saveMessage || titleError) && (
          <div
            role="status"
            className={`mt-2 pointer-events-auto px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-start gap-2 shadow-xl backdrop-blur-md animate-fadeIn ${
              titleError
                ? 'bg-rose-950/95 border border-rose-500/40 text-rose-200'
                : 'bg-emerald-950/95 border border-emerald-500/40 text-emerald-100'
            }`}
          >
            {titleError ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{titleError || saveMessage}</span>
          </div>
        )}
      </div>

      {/* ⋯ Plan Management Action Sheet */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="일정 관리">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 w-full h-full bg-slate-950/70 animate-fadeIn"
          />
          <div className="absolute inset-x-0 bottom-0 bg-slate-950 border-t border-slate-800 rounded-t-3xl px-3 pt-2.5 pb-4 safe-pb shadow-2xl animate-fadeIn">
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mb-3" />
            <div className="px-3 pb-2 text-xs font-semibold text-slate-400">일정 관리</div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => runFromMenu(() => executeSaveOrShare('save'))}
              className={menuItemClass}
            >
              <Save className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="flex flex-col min-w-0">
                <span>{saveButtonLabel}</span>
                {saveHint && <span className="text-xs text-slate-400">{saveHint}</span>}
              </span>
            </button>

            <button type="button" onClick={() => runFromMenu(openRename)} className={menuItemClass}>
              <Edit3 className="w-5 h-5 text-slate-300 shrink-0" />
              <span>제목 바꾸기</span>
            </button>

            <button type="button" onClick={() => runFromMenu(handleOpenLoadModal)} className={menuItemClass}>
              <FolderOpen className="w-5 h-5 text-sky-400 shrink-0" />
              <span>저장된 일정 불러오기</span>
            </button>

            {onNewPlan && (
              <button type="button" onClick={() => runFromMenu(onNewPlan)} className={menuItemClass}>
                <FolderPlus className="w-5 h-5 text-slate-300 shrink-0" />
                <span>새 일정 만들기</span>
              </button>
            )}

            {onForceRefreshRoute && activeBlockCount >= 2 && (
              <button
                type="button"
                disabled={isRefreshingRoute || refreshCooldownSeconds > 0}
                onClick={() => runFromMenu(onForceRefreshRoute)}
                className={menuItemClass}
              >
                <RefreshCw className={`w-5 h-5 text-slate-300 shrink-0 ${isRefreshingRoute ? 'animate-spin' : ''}`} />
                <span className="flex flex-col">
                  <span>예상 이동 시간 새로고침</span>
                  {refreshCooldownSeconds > 0 && (
                    <span className="text-xs text-slate-400">{refreshCooldownSeconds}초 후 다시 할 수 있어요</span>
                  )}
                </span>
              </button>
            )}

            {onChangeUserName && (
              <button type="button" onClick={() => runFromMenu(onChangeUserName)} className={menuItemClass}>
                {isAdmin ? (
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <User className="w-5 h-5 text-slate-300 shrink-0" />
                )}
                <span>작성자 이름 변경</span>
                <span className="ml-auto text-sm text-slate-400 truncate max-w-[40%]">{isAdmin ? 'ADMIN' : userName}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rename Sheet */}
      {isRenameOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="일정 제목 바꾸기">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setIsRenameOpen(false)}
            className="absolute inset-0 w-full h-full bg-slate-950/70 animate-fadeIn"
          />
          <form
            onSubmit={confirmRename}
            className="absolute inset-x-0 bottom-0 bg-slate-950 border-t border-slate-800 rounded-t-3xl px-4 pt-4 pb-4 safe-pb flex flex-col gap-3 shadow-2xl animate-fadeIn"
          >
            <label htmlFor={titleInputId} className="text-sm font-bold text-slate-100">
              일정 제목
            </label>
            <input
              id={titleInputId}
              name="mobilePlanTitle"
              type="text"
              value={titleDraft}
              onChange={(e) => {
                setTitleDraft(e.target.value);
                if (renameError) setRenameError(null);
              }}
              autoFocus
              enterKeyHint="done"
              placeholder="예: 순천 1박2일 힐링 여행"
              className={`w-full min-h-[48px] px-4 bg-slate-900 border rounded-xl text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                renameError ? 'border-rose-500' : 'border-slate-700'
              }`}
            />
            {renameError ? (
              <p className="text-xs text-rose-400">{renameError}</p>
            ) : loadedPlanIdentity ? (
              <p className="text-xs text-slate-400">제목을 바꾸면 저장할 때 새 일정으로 저장돼요.</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsRenameOpen(false)}
                className="min-h-[48px] px-5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-200"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[48px] rounded-xl bg-emerald-400 text-emerald-950 text-sm font-bold active:scale-[0.98] transition-transform"
              >
                확인
              </button>
            </div>
          </form>
        </div>
      )}

      <SavedPlansModals actions={actions} />
    </>
  );
}
