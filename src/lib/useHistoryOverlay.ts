'use client';

import { useCallback, useEffect, useState } from 'react';

type HistoryStateRecord = Record<string, unknown> | null;

/**
 * 모바일 전체 화면/시트 오버레이를 브라우저(안드로이드) 뒤로가기로 닫을 수 있게 한다.
 * 열 때 history 항목을 하나 쌓고(이미 열려 있으면 교체), 뒤로가기(popstate)로 닫힌다.
 * stateKey 별로 독립적으로 동작하므로 여러 컴포넌트에서 함께 쓸 수 있다.
 */
export function useHistoryOverlay<T extends string>(stateKey: string) {
  const [overlay, setOverlay] = useState<T | null>(null);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const value = (event.state as HistoryStateRecord)?.[stateKey];
      setOverlay(typeof value === 'string' ? (value as T) : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [stateKey]);

  const open = useCallback(
    (name: T) => {
      const current = window.history.state as HistoryStateRecord;
      const next = { ...(current ?? {}), [stateKey]: name };
      if (current?.[stateKey]) {
        window.history.replaceState(next, '');
      } else {
        window.history.pushState(next, '');
      }
      setOverlay(name);
    },
    [stateKey]
  );

  /** 닫기가 끝난 뒤(history 이동 완료) resolve 되므로, 이어서 다른 화면 이동을 안전하게 할 수 있다. */
  const close = useCallback((): Promise<void> => {
    const current = window.history.state as HistoryStateRecord;
    if (!current?.[stateKey]) {
      setOverlay(null);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('popstate', done);
        clearTimeout(fallbackTimer);
        setOverlay(null);
        resolve();
      };
      const fallbackTimer = setTimeout(done, 500);
      window.addEventListener('popstate', done);
      window.history.back();
    });
  }, [stateKey]);

  return { overlay, open, close };
}
