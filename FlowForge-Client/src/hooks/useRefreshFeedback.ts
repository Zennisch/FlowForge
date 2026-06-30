'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type RefreshState = 'idle' | 'refreshing' | 'complete';

interface RefreshFeedback {
  refreshState: RefreshState;
  isRefreshing: boolean;
  hasRefreshCompleted: boolean;
  runRefresh: () => Promise<void>;
}

export function useRefreshFeedback(
  onRefresh: () => Promise<unknown> | void,
  completeDuration = 1200
): RefreshFeedback {
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshState === 'refreshing') {
      return;
    }

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setRefreshState('refreshing');

    try {
      await onRefresh();
    } finally {
      setRefreshState('complete');
      resetTimerRef.current = window.setTimeout(() => {
        setRefreshState('idle');
        resetTimerRef.current = null;
      }, completeDuration);
    }
  }, [completeDuration, onRefresh, refreshState]);

  return {
    refreshState,
    isRefreshing: refreshState === 'refreshing',
    hasRefreshCompleted: refreshState === 'complete',
    runRefresh,
  };
}
