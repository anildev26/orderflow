'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReviewerStore } from '@/store/useReviewerStore';
import { filterReviewers, mergeReviewerSuggestions, reviewerNameKey, type ReviewerSuggestion } from '@/lib/reviewers';
import { useOrderContactNames } from '@/hooks/useOrderContactNames';
import { handleSuggestionKeyDown, NameSuggestionList, suggestionOptionKey } from '@/components/NameSuggestionList';

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
  const [open, setOpen] = useState(false);
  const [nav, setNav] = useState({ name: '', index: -1 });

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const suggestions = useMemo(
    () => mergeReviewerSuggestions(reviewers, reviewerNames),
    [reviewers, reviewerNames],
  );
  const filtered = useMemo(
    () => filterReviewers(suggestions, value.name),
    [suggestions, value.name],
  );
  const activeIndex = nav.name === value.name && nav.index >= 0 && nav.index < filtered.length ? nav.index : -1;
  const showList = open && filtered.length > 0;

  const key = reviewerNameKey(value.name);
  const alreadySaved = !!key && reviewers.some((r) => r.nameKey === key);

  const label = tone === 'form'
    ? 'block text-sm font-semibold text-form-label mb-1'
    : 'block text-xs font-semibold text-text-secondary mb-1.5';
  const input = tone === 'form'
    ? 'w-full bg-form-input-bg border border-form-border rounded-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition'
    : 'w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none transition';

  const close = () => {
    setOpen(false);
    setNav({ name: value.name, index: -1 });
  };

  const pick = (suggestion: ReviewerSuggestion) => {
    onChange({
      name: suggestion.name,
      reviewerId: suggestion.id,
      saveToList: suggestion.id ? false : true,
    });
    close();
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
    <div>
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
        onFocus={() => setOpen(true)}
        onBlur={close}
        onChange={(e) => {
          onChange({ ...value, name: e.target.value, reviewerId: null, saveToList: true });
          setOpen(true);
        }}
        onKeyDown={(e) => handleSuggestionKeyDown(e, {
          open: showList,
          count: filtered.length,
          activeIndex: activeIndex,
          close,
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
          onPick={(index) => pick(filtered[index])}
        />
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
