'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReviewerStore } from '@/store/useReviewerStore';
import { filterReviewers, mergeReviewerSuggestions, reviewerNameKey, type ReviewerSuggestion } from '@/lib/reviewers';
import { useOrderContactNames } from '@/hooks/useOrderContactNames';
import { handleSuggestionKeyDown, NameSuggestionList, suggestionOptionKey, useDelayedSuggestionClose } from '@/components/NameSuggestionList';
import { shouldShowNameSuggestions } from '@/lib/suggestionList';

export interface ReviewerFieldValue {
  name: string;
  reviewerId: string | null;
  saveToList: boolean;
}

export function ReviewerFields({
  tone,
  value,
  onChange,
  idPrefix = 'reviewer',
}: {
  tone: 'form' | 'dashboard';
  value: ReviewerFieldValue;
  onChange: (next: ReviewerFieldValue) => void;
  idPrefix?: string;
}) {
  const reviewers = useReviewerStore((s) => s.reviewers);
  const ensureLoaded = useReviewerStore((s) => s.ensureLoaded);
  const { reviewerNames } = useOrderContactNames();
  const [suggesting, setSuggesting] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [browseQuery, setBrowseQuery] = useState('');
  const [nav, setNav] = useState({ name: '', index: -1 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  useEffect(() => {
    if (!suggesting && !browsing) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setSuggesting(false);
        setBrowsing(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [suggesting, browsing]);

  const suggestions = useMemo(
    () => mergeReviewerSuggestions(reviewers, reviewerNames),
    [reviewers, reviewerNames],
  );
  const filtered = useMemo(
    () => filterReviewers(suggestions, value.name),
    [suggestions, value.name],
  );
  const savedMatches = useMemo(
    () => filterReviewers(reviewers, browseQuery),
    [reviewers, browseQuery],
  );
  const activeIndex = nav.name === value.name && nav.index >= 0 && nav.index < filtered.length ? nav.index : -1;
  const showList = shouldShowNameSuggestions(value.name, filtered.length, suggesting);

  const key = reviewerNameKey(value.name);
  const alreadySaved = !!key && reviewers.some((r) => r.nameKey === key);

  const label = tone === 'form'
    ? 'block text-sm font-semibold text-form-label mb-1'
    : 'block text-xs font-semibold text-text-secondary mb-1.5';
  const input = tone === 'form'
    ? 'w-full bg-form-input-bg border border-form-border rounded-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition'
    : 'w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none transition';

  const closeSuggestions = () => {
    setSuggesting(false);
    setNav({ name: value.name, index: -1 });
  };
  const dismissSuggestions = useDelayedSuggestionClose(closeSuggestions);

  const openSuggestions = () => {
    setBrowsing(false);
    setSuggesting(true);
  };

  const toggleBrowse = () => {
    setSuggesting(false);
    setNav({ name: value.name, index: -1 });
    setBrowseQuery('');
    setBrowsing((current) => !current);
  };

  const pick = (suggestion: ReviewerSuggestion) => {
    onChange({
      name: suggestion.name,
      reviewerId: suggestion.id,
      saveToList: suggestion.id ? false : true,
    });
    dismissSuggestions.cancel();
    closeSuggestions();
    setBrowsing(false);
  };

  const move = (direction: 1 | -1) => {
    setNav((current) => {
      const length = filtered.length;
      if (length === 0) return { name: value.name, index: -1 };
      const index = current.name === value.name && current.index >= 0 && current.index < length ? current.index : -1;
      const next = direction > 0
        ? (index < 0 ? 0 : (index + 1) % length)
        : (index <= 0 ? length - 1 : index - 1);
      return { name: value.name, index: next };
    });
  };

  return (
    <div ref={rootRef}>
      <label className={label} htmlFor={`${idPrefix}-name`}>
        Reviewer Name {tone === 'form' ? <span className="text-accent-red">*</span> : null}
      </label>
      <input
        id={`${idPrefix}-name`}
        type="text"
        value={value.name}
        maxLength={100}
        placeholder="Type reviewer name"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? `${idPrefix}-suggestions` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIndex >= 0 ? `${idPrefix}-option-${suggestionOptionKey(filtered[activeIndex].id, filtered[activeIndex].nameKey)}` : undefined}
        className={input}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Element && next.closest('[data-suggestion-list]')) return;
          dismissSuggestions.schedule();
        }}
        onChange={(e) => {
          const nextName = e.target.value;
          onChange({ ...value, name: nextName, reviewerId: null, saveToList: true });
          if (nextName.trim()) openSuggestions();
          else closeSuggestions();
        }}
        onKeyDown={(e) => handleSuggestionKeyDown(e, {
          open: showList,
          count: filtered.length,
          activeIndex: activeIndex,
          close: closeSuggestions,
          move,
          pickActive: () => { if (activeIndex >= 0) pick(filtered[activeIndex]); },
        })}
      />
      {showList && (
        <NameSuggestionList
          idPrefix={idPrefix}
          tone={tone}
          activeIndex={activeIndex}
          items={filtered.map((suggestion) => ({
            key: suggestionOptionKey(suggestion.id, suggestion.nameKey),
            name: suggestion.name,
          }))}
          onGestureStart={dismissSuggestions.onGestureStart}
          onGestureEnd={dismissSuggestions.onGestureEnd}
          onPick={(index) => {
            dismissSuggestions.cancel();
            pick(filtered[index]);
          }}
        />
      )}
      <button type="button" onClick={toggleBrowse} aria-expanded={browsing} className="mt-1.5 text-xs font-medium text-accent-blue hover:underline">
        Choose from my reviewers
      </button>
      {browsing && (
        <div className={`mt-2 rounded-lg border overflow-hidden ${tone === 'form' ? 'border-form-border bg-form-input-bg' : 'border-dashboard-border bg-dashboard-bg'}`}>
          <input
            type="text"
            value={browseQuery}
            onChange={(e) => setBrowseQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setBrowsing(false);
              }
            }}
            placeholder="Search name"
            className={`${input} rounded-none border-0 border-b ${tone === 'form' ? 'border-form-border' : 'border-dashboard-border'}`}
          />
          {savedMatches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted">No saved reviewers</p>
          ) : (
            <NameSuggestionList
              idPrefix={`${idPrefix}-saved`}
              tone={tone}
              framed={false}
              activeIndex={savedMatches.findIndex((reviewer) => reviewer.id === value.reviewerId)}
              items={savedMatches.map((reviewer) => ({
                key: reviewer.id,
                name: reviewer.name,
              }))}
              onPick={(index) => pick(savedMatches[index])}
            />
          )}
        </div>
      )}

      {!alreadySaved && key && (
        <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={value.saveToList}
            onChange={(e) => onChange({ ...value, saveToList: e.target.checked })}
            className="w-4 h-4 text-accent-blue"
          />
          Save to reviewer list
        </label>
      )}
    </div>
  );
}
