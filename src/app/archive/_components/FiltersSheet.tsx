'use client';

import { useId, useMemo, useState } from 'react';
import {
  DEFAULT_FILTERS,
  suggestNames,
  type ArchiveFilters,
  type ArchiveRange,
  type ArchiveSort,
  type BankOption,
  type NameOption,
} from '@/lib/archive';
import { todayStr } from '@/lib/followup';
import { Sheet, btnNeutral, btnPrimary, inputCls } from '@/app/follow-ups/_components/ui';
import { chipOff, chipOn, platformTitle } from './shared';

const RANGES: { id: ArchiveRange; label: string }[] = [
  { id: 'any', label: 'Any time' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'this_year', label: 'This year' },
  { id: 'custom', label: 'Pick dates' },
];

export const SORTS: { id: ArchiveSort; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'highest', label: 'Highest refund' },
  { id: 'slowest', label: 'Took longest to pay' },
];

export default function FiltersSheet({
  initial,
  platforms,
  mediators,
  reviewers,
  banks,
  countFor,
  onApply,
  onClose,
}: {
  initial: ArchiveFilters;
  platforms: string[];
  mediators: NameOption[];
  reviewers: NameOption[];
  banks: BankOption[];
  countFor: (f: ArchiveFilters) => number;
  onApply: (f: ArchiveFilters) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<ArchiveFilters>(initial);
  const count = useMemo(() => countFor(f), [countFor, f]);
  const today = todayStr();
  const set = (patch: Partial<ArchiveFilters>) => setF((cur) => ({ ...cur, ...patch }));
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Sheet
      title="Filters"
      labelId="archive-filters-title"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2 w-full">
          <button type="button" onClick={() => setF({ ...DEFAULT_FILTERS, status: f.status })} className={btnNeutral}>Clear all</button>
          <button type="button" onClick={() => onApply(f)} className={btnPrimary}>
            {count === 0 ? 'No orders match' : `Show ${count} order${count === 1 ? '' : 's'}`}
          </button>
        </div>
      }
    >
      <Section title="Paid or cancelled on">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button key={r.id} type="button" onClick={() => set({ range: r.id })} className={f.range === r.id ? chipOn : chipOff} aria-pressed={f.range === r.id}>
              {r.label}
            </button>
          ))}
        </div>
        {f.range === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <label className="text-xs text-text-muted min-w-0">
              From
              <input type="date" value={f.from} max={today} onChange={(e) => set({ from: e.target.value })} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs text-text-muted min-w-0">
              To
              <input type="date" value={f.to} max={today} onChange={(e) => set({ to: e.target.value })} className={`${inputCls} mt-1`} />
            </label>
          </div>
        )}
      </Section>

      {platforms.length > 1 && (
        <Section title="Platform">
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p) => (
              <button key={p} type="button" onClick={() => set({ platforms: toggle(f.platforms, p) })} className={f.platforms.includes(p) ? chipOn : chipOff} aria-pressed={f.platforms.includes(p)}>
                {platformTitle(p)}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Mediator">
        <NamePicker label="Mediator" options={mediators} value={f.mediator} onChange={(mediator) => set({ mediator })} placeholder="Type a mediator name" />
      </Section>

      <Section title="Reviewer">
        <NamePicker label="Reviewer" options={reviewers} value={f.reviewer} onChange={(reviewer) => set({ reviewer })} placeholder="Type a reviewer name" />
      </Section>

      {banks.length > 0 && (
        <Section title="Bank received in">
          <div className="flex flex-wrap gap-1.5">
            {banks.map((b) => (
              <button key={b.key} type="button" onClick={() => set({ banks: toggle(f.banks, b.key) })} className={`${f.banks.includes(b.key) ? chipOn : chipOff} max-w-full`} aria-pressed={f.banks.includes(b.key)}>
                <span className="truncate">{b.name}</span>
                <span className="opacity-60">{b.count}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Sort">
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button key={s.id} type="button" onClick={() => set({ sort: s.id })} className={f.sort === s.id ? chipOn : chipOff} aria-pressed={f.sort === s.id}>
              {s.label}
            </button>
          ))}
        </div>
      </Section>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5">{title}</p>
      {children}
    </div>
  );
}

/** Type a few letters, pick a name from the user's own archived orders. */
function NamePicker({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: NameOption[];
  value: string;
  onChange: (key: string) => void;
  placeholder: string;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const selected = options.find((o) => o.key === value);
  const suggestions = useMemo(() => suggestNames(options, text), [options, text]);

  if (options.length === 0) return <p className="text-xs text-text-muted">No names saved on your archived orders.</p>;

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-accent-blue bg-accent-blue/10 px-3 py-2">
        <span className="text-sm font-semibold text-text-primary break-words min-w-0">
          {selected?.name || value}
          {selected && <span className="ml-1.5 text-xs font-normal text-text-muted">{selected.count} order{selected.count === 1 ? '' : 's'}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setText('');
          }}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="w-8 h-8 flex-shrink-0 rounded-md inline-flex items-center justify-center text-text-muted hover:text-text-primary"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className={inputCls}
      />
      {(focused || text) && (
        <ul className="mt-1 rounded-lg border border-dashboard-border overflow-hidden divide-y divide-dashboard-border">
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-text-muted">No {label.toLowerCase()} with that name in Archive.</li>
          ) : (
            suggestions.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.key);
                    setText('');
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm text-text-primary hover:bg-dashboard-card-hover"
                >
                  <span className="break-words min-w-0">{o.name}</span>
                  <span className="text-xs text-text-muted whitespace-nowrap">{o.count} order{o.count === 1 ? '' : 's'}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
