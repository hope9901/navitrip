'use client';

import React from 'react';
import { FolderOpen, X, Loader2, MapPin, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { PlanActions } from './usePlanActions';

interface SavedPlansModalsProps {
  actions: PlanActions;
}

/** 저장된 일정 불러오기 목록 및 삭제 확인 모달 */
export default function SavedPlansModals({ actions }: SavedPlansModalsProps) {
  const {
    userName,
    isAdmin,
    isLoadModalOpen,
    setIsLoadModalOpen,
    savedPlansList,
    loadingPlansList,
    deletingPlanId,
    confirmDeleteTarget,
    setConfirmDeleteTarget,
    handleSelectSavedPlan,
    handleConfirmDelete,
  } = actions;

  return (
    <>
    {/* Load Saved Plans Modal */}
    {isLoadModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <FolderOpen className="w-4 h-4 text-sky-400" />
              <span>
                {isAdmin ? '👑 [어드민 관리] 저장된 전체 여행 일정' : `[${userName}] 님의 저장된 여행 일정`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsLoadModalOpen(false)}
              aria-label="불러오기 창 닫기"
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto custom-scrollbar">
            {loadingPlansList ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
                <span>{isAdmin ? '전체 저장 일정을 조회하는 중입니다...' : `'${userName}' 님의 저장된 일정을 조회하는 중입니다...`}</span>
              </div>
            ) : savedPlansList.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                {isAdmin ? '저장된 일정이 없습니다.' : `'${userName}' 님의 이름으로 저장된 일정이 없습니다.`}
              </div>
            ) : (
              savedPlansList.map((planItem) => {
                const isDeletingThis = deletingPlanId === planItem.id;
                return (
                  <div
                    key={planItem.id}
                    onClick={() => handleSelectSavedPlan(planItem.id)}
                    className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm hover:shadow-md"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-100 group-hover:text-sky-400 transition-colors truncate">
                          {planItem.title}
                        </h4>
                        {planItem.authorName && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-700/80 text-slate-300">
                            작성자: {planItem.authorName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>장소 {planItem.placeCount}개</span>
                        </span>
                        {planItem.updatedAt && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(planItem.updatedAt).toLocaleDateString('ko-KR')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleSelectSavedPlan(planItem.id)}
                        className="px-2.5 py-1.5 bg-sky-600/90 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95"
                      >
                        불러오기
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingThis}
                        onClick={() => setConfirmDeleteTarget(planItem)}
                        className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-600/90 border border-rose-500/30 text-rose-300 hover:text-white rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95 disabled:opacity-50"
                        title="일정 삭제"
                      >
                        {isDeletingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    )}

    {/* Deletion Confirmation Modal */}
    {confirmDeleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
        <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-sm p-5 flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>일정 삭제 확인</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            정말로 <strong className="text-white font-bold">&lsquo;{confirmDeleteTarget.title}&rsquo;</strong> 일정을 삭제하시겠습니까? 삭제된 일정은 복구할 수 없습니다.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setConfirmDeleteTarget(null)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              삭제하기
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
