'use client';

import { useEffect, useState } from 'react';
import { useReviewerStore } from '@/store/useReviewerStore';
import { reviewerNameKey, type ReviewerRecord } from '@/lib/reviewers';

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const key = reviewerNameKey(value.name);
  const alreadySaved = !!key && reviewers.some((r) => r.nameKey === key);
  const filtered = reviewers.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q);
  });

  const label = tone === 'form'
    ? 'block text-sm font-semibold text-form-label mb-1'
    : 'block text-xs font-semibold text-text-secondary mb-1.5';
  const input = tone === 'form'
    ? 'w-full bg-form-input-bg border border-form-border rounded-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition'
    : 'w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none transition';

  const pick = (r: ReviewerRecord) => {
    onChange({ name: r.name, reviewerId: r.id, saveToList: false });
    setOpen(false);
    setQuery('');
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
        className={input}
        onChange={(e) => onChange({ ...value, name: e.target.value, reviewerId: null, saveToList: true })}
      />
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 text-xs font-medium text-accent-blue hover:underline">
        Choose from my reviewers
      </button>
      {open && (
        <div className={`mt-2 rounded-lg border overflow-hidden ${tone === 'form' ? 'border-form-border bg-form-input-bg' : 'border-dashboard-border bg-dashboard-bg'}`}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name"
            className={`${input} rounded-none border-0 border-b ${tone === 'form' ? 'border-form-border' : 'border-dashboard-border'}`}
          />
          <ul className="max-h-40 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-muted">No saved reviewers</li>
            ) : filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent-blue/10 ${value.reviewerId === r.id ? 'bg-accent-blue/15' : ''}`}
                >
                  <span className="truncate">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
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
