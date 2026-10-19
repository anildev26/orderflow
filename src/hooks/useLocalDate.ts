'use client';

import { useSyncExternalStore } from 'react';
import { todayStr } from '@/lib/followup';
import { watchLocalDate } from '@/lib/localDate';

// Share one midnight timer across the dashboard, cards, and open modals.
const listeners = new Set<() => void>();
let stopWatching: (() => void) | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    stopWatching = watchLocalDate(() => {
      for (const notify of listeners) notify();
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopWatching?.();
      stopWatching = undefined;
    }
  };
}

export function useLocalDate() {
  return useSyncExternalStore<string | null>(subscribe, todayStr, () => null);
}
