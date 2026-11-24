'use client';

import { useEffect, useRef } from 'react';

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
}: {
  idPrefix: string;
  tone: 'form' | 'dashboard';
  items: NameSuggestionItem[];
  activeIndex: number;
  onPick: (index: number) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

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
      className={`mt-1 max-h-40 overflow-auto rounded-lg border ${box}`}
    >
      {items.map((item, index) => (
        <li key={item.key} role="presentation">
          <button
            type="button"
            role="option"
            id={`${idPrefix}-option-${item.key}`}
            data-index={index}
            aria-selected={index === activeIndex}
            onPointerDown={(event) => {
              event.preventDefault();
              onPick(index);
            }}
            onMouseDown={(event) => {
              event.preventDefault();
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
