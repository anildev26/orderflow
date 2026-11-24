'use client';

import { useEffect, useRef } from 'react';
import { pointerMovedPastTap } from '@/lib/suggestionList';

export interface NameSuggestionItem {
  key: string;
  name: string;
  phoneDisplay?: string;
}

export function suggestionOptionKey(id: string | null, nameKey: string): string {
  if (id) return id;
  return `order-${nameKey.replace(/[^a-z0-9]+/gi, '-')}`;
}

export function NameSuggestionList({
  idPrefix,
  tone,
  items,
  activeIndex,
  onPick,
  onGestureStart,
  onGestureEnd,
  framed = true,
}: {
  idPrefix: string;
  tone: 'form' | 'dashboard';
  items: NameSuggestionItem[];
  activeIndex: number;
  onPick: (index: number) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (moved: boolean) => void;
  framed?: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const moved = useRef(false);
  const stopTracking = useRef<(() => void) | null>(null);

  useEffect(() => () => stopTracking.current?.(), []);

  useEffect(() => {
    if (activeIndex < 0) return;
    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (items.length === 0) return null;

  const box = tone === 'form'
    ? 'border-form-border bg-form-input-bg'
    : 'border-dashboard-border bg-dashboard-bg';

  return (
    <ul
      ref={listRef}
      id={`${idPrefix}-suggestions`}
      role="listbox"
      data-suggestion-list=""
      className={framed
        ? `mt-1 max-h-40 overflow-y-auto overscroll-contain touch-pan-y rounded-lg border ${box}`
        : 'max-h-40 overflow-y-auto overscroll-contain touch-pan-y'}
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      onPointerDown={(event) => {
        const onOption = event.target instanceof Element && !!event.target.closest('button');
        if (event.pointerType === 'mouse' && onOption) event.preventDefault();
        stopTracking.current?.();
        moved.current = false;
        const startX = event.clientX;
        const startY = event.clientY;
        onGestureStart?.();
        const track = (move: PointerEvent) => {
          if (pointerMovedPastTap(startX, startY, move.clientX, move.clientY)) moved.current = true;
        };
        const detach = () => {
          window.removeEventListener('pointermove', track);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
          stopTracking.current = null;
        };
        const end = (done: PointerEvent) => {
          if (done.type === 'pointercancel') moved.current = true;
          detach();
          onGestureEnd?.(moved.current);
        };
        stopTracking.current = detach;
        window.addEventListener('pointermove', track);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
      }}
    >
      {items.map((item, index) => (
        <li key={item.key} role="presentation">
          <button
            type="button"
            role="option"
            id={`${idPrefix}-option-${item.key}`}
            data-index={index}
            aria-selected={index === activeIndex}
            onClick={() => {
              if (moved.current) return;
              onPick(index);
            }}
            className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-3 hover:bg-accent-blue/10 ${index === activeIndex ? 'bg-accent-blue/15' : ''}`}
          >
            <span className="truncate">{item.name}</span>
            {item.phoneDisplay ? (
              <span className="text-xs text-text-muted flex-shrink-0">{item.phoneDisplay}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function useDelayedSuggestionClose(close: () => void) {
  const closeRef = useRef(close);
  const hold = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const schedule = () => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (hold.current) return;
      closeRef.current();
    }, 350);
  };

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => cancel, []);

  return {
    schedule,
    cancel,
    onGestureStart: () => {
      hold.current = true;
      cancel();
    },
    onGestureEnd: (gestureMoved: boolean) => {
      hold.current = false;
      if (gestureMoved) cancel();
    },
  };
}

export function handleSuggestionKeyDown(
  event: React.KeyboardEvent<HTMLInputElement>,
  opts: {
    open: boolean;
    count: number;
    activeIndex: number;
    close: () => void;
    move: (direction: 1 | -1) => void;
    pickActive: () => void;
  },
) {
  if (event.key === 'Escape') {
    if (!opts.open) return;
    event.preventDefault();
    opts.close();
    return;
  }
  if (!opts.open || opts.count === 0) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    opts.move(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    opts.move(-1);
  } else if (event.key === 'Enter' && opts.activeIndex >= 0 && opts.activeIndex < opts.count) {
    event.preventDefault();
    opts.pickActive();
  }
}
