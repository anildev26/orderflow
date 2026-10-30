'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMediatorStore } from '@/store/useMediatorStore';
import { normalizeIndianMobile, PHONE_CHECK_MESSAGE } from '@/lib/phone';
import {
  mediatorNameKey,
  planMediatorSave,
  sameNameOtherNumbers,
  type MediatorRecord,
} from '@/lib/mediators';

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

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
  const filtered = mediators.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.phoneNormalized.includes(q.replace(/\D/g, ''));
  });

  const label = tone === 'form'
    ? 'block text-sm font-semibold text-form-label mb-1'
    : 'block text-xs font-semibold text-text-secondary mb-1.5';
  const input = tone === 'form'
    ? 'w-full bg-form-input-bg border border-form-border rounded-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition'
    : 'w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none transition';

  const pick = (m: MediatorRecord) => {
    onChange({
      name: m.name,
      phoneInput: m.phoneDisplay || '',
      mediatorId: m.id,
      saveToList: false,
    });
    setOpen(false);
    setQuery('');
  };

  return (
    <div>
      <label className={label} htmlFor={`${idPrefix}-name`}>
        Mediator Name {tone === 'form' ? <span className="text-accent-red">*</span> : null}
      </label>
      <input
        id={`${idPrefix}-name`}
        type="text"
        value={value.name}
        maxLength={100}
        placeholder="Type mediator name"
        className={input}
        onChange={(e) => onChange({ ...value, name: e.target.value, mediatorId: null, saveToList: true })}
      />
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 text-xs font-medium text-accent-blue hover:underline">
        Choose from my mediators
      </button>
      {open && (
        <div className={`mt-2 rounded-lg border overflow-hidden ${tone === 'form' ? 'border-form-border bg-form-input-bg' : 'border-dashboard-border bg-dashboard-bg'}`}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or number"
            className={`${input} rounded-none border-0 border-b ${tone === 'form' ? 'border-form-border' : 'border-dashboard-border'}`}
          />
          <ul className="max-h-40 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-muted">No saved mediators</li>
            ) : filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-3 hover:bg-accent-blue/10 ${value.mediatorId === m.id ? 'bg-accent-blue/15' : ''}`}
                >
                  <span className="truncate">{m.name}</span>
                  <span className="text-xs text-text-muted flex-shrink-0">{m.phoneDisplay || 'No number'}</span>
                </button>
              </li>
            ))}
          </ul>
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
          <button type="button" onClick={() => pick(blocked)} className="mt-1 font-semibold text-accent-blue hover:underline">
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
