'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { DayItinerary, RouteSegment, PlanData, SavedMapView } from '@/types/itinerary';
import { createRouteSignature } from '@/lib/routeSignature';
import {
  savePlanToDB,
  loadPlanFromDB,
  listSavedPlansFromDB,
  deletePlanFromDB,
  SavedPlanSummary,
  LoadedPlanIdentity,
  PlanSaveResult,
  normalizePlanTitle,
  normalizeUserName,
} from '@/lib/supabase';

export interface PlanActionsOptions {
  planTitle: string;
  setPlanTitle: (title: string) => void;
  days: DayItinerary[];
  setDays: React.Dispatch<React.SetStateAction<DayItinerary[]>>;
  activeDayIndex: number;
  setActiveDayIndex: (idx: number) => void;
  routes: RouteSegment[];
  drivingRoutes?: RouteSegment[];
  planId?: string;
  authorName?: string;
  userName?: string;
  onPlanSaved?: (result: PlanSaveResult) => void;
  onLoadPlan?: (plan: PlanData) => void;
  onNewPlan?: () => void;
  onDeleteCurrentActivePlan?: () => void;
  onRequestMapView?: () => SavedMapView | null;
  loadedPlanIdentity?: LoadedPlanIdentity | null;
}

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * 일정 저장 / 공유 / 불러오기 / 삭제 로직.
 * 데스크톱 사이드바와 모바일 상단 바가 같은 동작을 공유하도록 분리했다.
 */
export function usePlanActions({
  planTitle,
  setPlanTitle,
  days,
  setDays,
  activeDayIndex,
  setActiveDayIndex,
  routes,
  drivingRoutes,
  planId,
  authorName,
  userName = '사용자',
  onPlanSaved,
  onLoadPlan,
  onNewPlan,
  onDeleteCurrentActivePlan,
  onRequestMapView,
  loadedPlanIdentity,
}: PlanActionsOptions) {
  const isMounted = useIsMounted();

  const [isSaving, setIsSaving] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Load Saved Plans Modal State
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [savedPlansList, setSavedPlansList] = useState<SavedPlanSummary[]>([]);
  const [loadingPlansList, setLoadingPlansList] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  // Deletion Confirmation Modal State
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<SavedPlanSummary | null>(null);

  const normalizedUser = (userName || '').trim().toLowerCase();
  const isAdmin = isMounted && (normalizedUser === 'admin' || userName.trim() === '어드민');

  const currentNormTitle = normalizePlanTitle(planTitle);
  const loadedNormTitle = loadedPlanIdentity ? normalizePlanTitle(loadedPlanIdentity.title) : null;
  const isTitleChanged = loadedPlanIdentity ? currentNormTitle !== loadedNormTitle : false;

  const currentNormAuthor = normalizeUserName(userName);
  const loadedNormAuthor = loadedPlanIdentity ? normalizeUserName(loadedPlanIdentity.authorName) : null;
  const isAuthorChanged = loadedPlanIdentity ? currentNormAuthor !== loadedNormAuthor : Boolean(authorName && authorName !== userName && !isAdmin);

  const isSharedOriginal = isAuthorChanged;

  const handleOpenLoadModal = async () => {
    setIsLoadModalOpen(true);
    setLoadingPlansList(true);
    try {
      const list = await listSavedPlansFromDB(userName);
      setSavedPlansList(list);
    } catch (err) {
      console.error('Failed to list saved plans:', err);
    } finally {
      setLoadingPlansList(false);
    }
  };

  const handleSelectSavedPlan = async (selectedId: string) => {
    setLoadingPlansList(true);
    try {
      const plan = await loadPlanFromDB(selectedId);
      if (plan) {
        if (onLoadPlan) {
          onLoadPlan(plan);
        } else {
          setPlanTitle(plan.title || '불러온 여행 일정');
          if (plan.days && plan.days.length > 0) {
            setDays(plan.days);
            setActiveDayIndex(0);
          }
        }
        setIsLoadModalOpen(false);
        setSaveMessage(`'${plan.title}' 일정을 성공적으로 불러왔습니다!`);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to load selected plan:', err);
    } finally {
      setLoadingPlansList(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    const target = confirmDeleteTarget;
    setDeletingPlanId(target.id);
    try {
      await deletePlanFromDB(target.id, userName);

      setSavedPlansList((prev) => prev.filter((item) => item.id !== target.id));
      setConfirmDeleteTarget(null);

      // If active current open plan was deleted, reset workspace
      if (planId === target.id) {
        if (onDeleteCurrentActivePlan) {
          onDeleteCurrentActivePlan();
        } else if (onNewPlan) {
          onNewPlan();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
      alert(`일정 삭제 실패: ${msg}`);
    } finally {
      setDeletingPlanId(null);
    }
  };

  const validateTitle = (): boolean => {
    if (!planTitle || !planTitle.trim()) {
      setTitleError('여행 일정 이름을 입력해 주세요.');
      return false;
    }
    setTitleError(null);
    return true;
  };

  const prepareDaysWithSavedRoutes = (): DayItinerary[] => {
    // 도보 선택은 블록에 저장되므로, 경로 캐시에는 항상 원본 자동차 경로를 저장한다.
    const routesToSave = drivingRoutes ?? routes;
    return days.map((d, idx) => {
      if (idx === activeDayIndex && routesToSave && routesToSave.length > 0) {
        const waypoints = (d.blocks || []).map((b) => ({ lat: b.place.lat, lng: b.place.lng }));
        if (waypoints.length >= 2) {
          const totalDist = routesToSave.reduce((acc, r) => acc + (r.distanceMeter || 0), 0);
          const totalDur = routesToSave.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
          const routeSig = createRouteSignature({ waypoints, option: 'trafast', mode: 'driving', version: 1 });

          return {
            ...d,
            savedRoute: {
              routeSignature: routeSig,
              distanceMeter: totalDist,
              durationSeconds: totalDur,
              calculatedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              source: 'saved' as const,
              segments: routesToSave,
            },
          };
        }
      }
      return d;
    });
  };

  const executeSaveOrShare = async (action: 'save' | 'share') => {
    if (!validateTitle()) return;

    setIsSaving(true);
    try {
      const currentMapView = onRequestMapView ? onRequestMapView() || undefined : undefined;
      const daysToSave = prepareDaysWithSavedRoutes();

      const result = await savePlanToDB({
        plan: {
          id: planId,
          title: planTitle.trim(),
          authorName: userName,
          mapView: currentMapView,
          days: daysToSave,
        },
        loadedPlanIdentity,
        currentUserName: userName,
      });

      if (onPlanSaved) {
        onPlanSaved(result);
      }

      if (action === 'save') {
        setIsJustSaved(true);
        setSaveMessage(result.message);
        setTimeout(() => {
          setIsJustSaved(false);
          setSaveMessage(null);
        }, 3500);
      } else if (action === 'share') {
        if (result.isLocalFallback) {
          setSaveMessage('Supabase 설정 전이므로 공유 링크 생성이 제한됩니다. (로컬 저장 완료)');
          return;
        }

        const shareUrl = `${window.location.origin}/plan/${result.id}`;
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShareUrl(true);
        setSaveMessage(`공유 링크가 복사되었습니다! (${result.message})`);

        setTimeout(() => {
          setCopiedShareUrl(false);
          setSaveMessage(null);
        }, 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.';
      console.error('Save/Share plan error:', err);
      setTitleError(msg);
      setSaveMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  let saveButtonLabel = '저장';
  if (isJustSaved) {
    saveButtonLabel = '저장완료';
  } else if (isSharedOriginal) {
    saveButtonLabel = '내 일정으로 저장';
  } else if (isTitleChanged) {
    saveButtonLabel = '새 이름으로 저장';
  } else if (!loadedPlanIdentity || !planId) {
    saveButtonLabel = '새 일정 저장';
  } else {
    saveButtonLabel = '저장';
  }

  return {
    userName,
    isAdmin,
    isSaving,
    copiedShareUrl,
    isJustSaved,
    saveMessage,
    titleError,
    setTitleError,
    isTitleChanged,
    isSharedOriginal,
    saveButtonLabel,
    executeSaveOrShare,
    isLoadModalOpen,
    setIsLoadModalOpen,
    savedPlansList,
    loadingPlansList,
    deletingPlanId,
    confirmDeleteTarget,
    setConfirmDeleteTarget,
    handleOpenLoadModal,
    handleSelectSavedPlan,
    handleConfirmDelete,
  };
}

export type PlanActions = ReturnType<typeof usePlanActions>;
