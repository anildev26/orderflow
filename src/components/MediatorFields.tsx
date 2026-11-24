'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediatorStore } from '@/store/useMediatorStore';
import { normalizeIndianMobile, PHONE_CHECK_MESSAGE } from '@/lib/phone';
import {
  filterMediators,
  mediatorNameKey,
  mergeMediatorSuggestions,
  sameNameOtherNumbers,
  type MediatorSuggestion,
} from '@/lib/mediators';
import { useOrderContactNames } from '@/hooks/useOrderContactNames';
import { handleSuggestionKeyDown, NameSuggestionList, suggestionOptionKey } from '@/components/NameSuggestionList';

export interface MediatorFieldValue {
  name: string;
  phoneInput: string;
  mediatorId: string | null;
  saveToList: boolean;
}

export function MediatorFields({
  tone,
  value,
  onChange,
  idPrefix = 'mediator',
}: {
  tone: 'form' | 'dashboard';
  value: MediatorFieldValue;
  onChange: (next: MediatorFieldValue) => void;
  idPrefix?: string;
}) {
  const mediators = useMediatorStore((s) => s.mediators);
  const ensureLoaded = useMediatorStore((s) => s.ensureLoaded);
  const { mediatorNames } = useOrderContactNames();
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
    () => mergeMediatorSuggestions(mediators, mediatorNames),
    [mediators, mediatorNames],
  );
  const filtered = useMemo(
    () => filterMediators(suggestions, value.name),
    [suggestions, value.name],
  );
  const savedMatches = useMemo(
    () => filterMediators(mediators, browseQuery),
    [mediators, browseQuery],
  );
  const activeIndex = nav.name === value.name && nav.index >= 0 && nav.index < filtered.length ? nav.index : -1;
  const showList = suggesting && filtered.length > 0;

  const parsed = normalizeIndianMobile(value.phoneInput);
  const phoneNormalized = parsed.ok && !parsed.empty ? parsed.normalized : '';
  const picked = value.mediatorId ? mediators.find((m) => m.id === value.mediatorId) : undefined;
  const unchangedPick = !!picked
    && picked.nameKey === mediatorNameKey(value.name)
    && picked.phoneNormalized === phoneNormalized;
  const blocked = !unchangedPick && value.saveToList && parsed.ok && !parsed.empty
    ? mediators.find((m) => m.phoneNormalized === phoneNormalized && m.nameKey !== mediatorNameKey(value.name))
    : undefined;
  const otherNumbers = useMemo(
    () => (!blocked && !unchangedPick ? sameNameOtherNumbers(mediators, value.name, phoneNormalized) : []),
    [blocked, unchangedPick, mediators, value.name, phoneNormalized],
  );

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

  const pick = (suggestion: MediatorSuggestion) => {
    if (suggestion.id) {
      onChange({
        name: suggestion.name,
        phoneInput: suggestion.phoneDisplay || '',
        mediatorId: suggestion.id,
        saveToList: false,
      });
    } else {
      onChange({
        name: suggestion.name,
        phoneInput: '',
        mediatorId: null,
        saveToList: true,
      });
    }
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
        Mediator Name {tone === 'form' ? <span className="text-accent-red">*</span> : null}
      </label>
      <input
        id={`${idPrefix}-name`}
        type="text"
        value={value.name}
        maxLength={100}
        placeholder="Type mediator name"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? `${idPrefix}-suggestions` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIndex >= 0 ? `${idPrefix}-option-${suggestionOptionKey(filtered[activeIndex].id, filtered[activeIndex].nameKey)}` : undefined}
        className={input}
        onFocus={openSuggestions}
        onBlur={closeSuggestions}
        onChange={(e) => {
          onChange({ ...value, name: e.target.value, mediatorId: null, saveToList: true });
          openSuggestions();
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
            phoneDisplay: suggestion.phoneDisplay,
          }))}
          onPick={(index) => pick(filtered[index])}
        />
      )}
      <button type="button" onClick={toggleBrowse} aria-expanded={browsing} className="mt-1.5 text-xs font-medium text-accent-blue hover:underline">
        Choose from my mediators
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
            placeholder="Search name or number"
            className={`${input} rounded-none border-0 border-b ${tone === 'form' ? 'border-form-border' : 'border-dashboard-border'}`}
          />
          {savedMatches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted">No saved mediators</p>
          ) : (
            <NameSuggestionList
              idPrefix={`${idPrefix}-saved`}
              tone={tone}
              framed={false}
              activeIndex={savedMatches.findIndex((mediator) => mediator.id === value.mediatorId)}
              items={savedMatches.map((mediator) => ({
                key: mediator.id,
                name: mediator.name,
                phoneDisplay: mediator.phoneDisplay,
              }))}
              onPick={(index) => pick(savedMatches[index])}
            />
          )}
        </div>
      )}

      <label className={`${label} mt-3`} htmlFor={`${idPrefix}-phone`}>
        Mediator WhatsApp number <span className="font-normal text-text-muted">optional</span>
      </label>
      <input
        id={`${idPrefix}-phone`}
        type="tel"
        value={value.phoneInput}
        placeholder="10-digit mobile"
        className={input}
        onChange={(e) => onChange({
          ...value,
          phoneInput: e.target.value,
          mediatorId: null,
          saveToList: value.mediatorId ? true : value.saveToList,
        })}
      />
      {!parsed.ok && <p className="text-xs text-accent-red mt-1">{PHONE_CHECK_MESSAGE}</p>}

      {!unchangedPick && (
        <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={value.saveToList}
            onChange={(e) => onChange({ ...value, saveToList: e.target.checked })}
            className="w-4 h-4 text-accent-blue"
          />
          Save to my mediators
        </label>
      )}

      {blocked && value.saveToList && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <p>This number is already saved as {blocked.name} in your mediators</p>
          <button type="button" onClick={() => pick({
            id: blocked.id,
            name: blocked.name,
            nameKey: blocked.nameKey,
            phoneDisplay: blocked.phoneDisplay,
            phoneNormalized: blocked.phoneNormalized,
          })} className="mt-1 font-semibold text-accent-blue hover:underline">
            Use {blocked.name}
          </button>
        </div>
      )}
      {!blocked && otherNumbers.length > 0 && (
        <p className="text-xs text-text-muted mt-1">You also have {otherNumbers[0].name} with another number.</p>
      )}
    </div>
  );
}

export function mediatorFieldsFromOrder(order: {
  mediatorName: string;
  mediatorPhone?: string | null;
  mediatorId?: string | null;
}, saveToList: boolean): MediatorFieldValue {
  return {
    name: order.mediatorName || '',
    phoneInput: order.mediatorPhone ? (order.mediatorPhone.startsWith('91') && order.mediatorPhone.length === 12
      ? `+91 ${order.mediatorPhone.slice(2, 7)} ${order.mediatorPhone.slice(7)}`
      : order.mediatorPhone) : '',
    mediatorId: order.mediatorId ?? null,
    saveToList,
  };
}
