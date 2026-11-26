'use client';

import { useEffect, useRef } from 'react';
import { STATUS_META, type RequestStatus } from '@/lib/featureRequests';

export function StatusPill({ status, version }: { status: RequestStatus; version?: string | null }) {
  const meta = STATUS_META[status] ?? STATUS_META.new;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold whitespace-nowrap ${meta.pill}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {meta.label}
      {status === 'shipped' && version ? ` · ${version}` : ''}
    </span>
  );
}

export function Spinner({ className = 'w-5 h-5', light = false }: { className?: string; light?: boolean }) {
  return (
    <span
      className={`inline-block border-2 ${light ? 'border-white' : 'border-accent-blue'} border-t-transparent rounded-full animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

// Open layers (drawer, dialogs, the developer sheet), newest last. Escape closes only
// the top one, and page scroll is locked while any scroll-locking layer is open.
const layerStack: { id: number; lock: boolean }[] = [];
let layerSeq = 0;
let savedOverflow = '';

function syncScrollLock() {
  const locked = layerStack.some((l) => l.lock);
  if (locked && document.body.style.overflow !== 'hidden') {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  } else if (!locked && document.body.style.overflow === 'hidden') {
    document.body.style.overflow = savedOverflow;
  }
}

/** Registers an open layer: Escape closes it when it is on top; optionally locks page scroll. */
export function useLayer(onClose: () => void, { lockScroll = true }: { lockScroll?: boolean } = {}) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const id = ++layerSeq;
    layerStack.push({ id, lock: lockScroll });
    syncScrollLock();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (layerStack[layerStack.length - 1]?.id !== id) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = layerStack.findIndex((l) => l.id === id);
      if (i >= 0) layerStack.splice(i, 1);
      syncScrollLock();
    };
  }, [lockScroll]);
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  labelId,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  labelId: string;
}) {
  useLayer(onClose);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-dashboard-card border border-dashboard-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-dashboard-border">
          <h2 id={labelId} className="text-base font-semibold text-text-primary">{title}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-dashboard-border flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ onClose, children, labelId }: { onClose: () => void; children: React.ReactNode; labelId: string }) {
  useLayer(onClose);
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[520px] bg-dashboard-bg md:border-l border-dashboard-border shadow-2xl flex flex-col"
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-9 h-9 flex-shrink-0 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-dashboard-card transition"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-9 h-5 rounded-full flex-shrink-0 transition disabled:opacity-50 ${on ? 'bg-accent-blue' : 'bg-dashboard-border'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

export function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return (
    <span className={`text-[10px] tabular-nums ${n > max ? 'text-accent-red' : n > max * 0.9 ? 'text-accent-yellow' : 'text-text-muted'}`}>
      {n}/{max}
    </span>
  );
}

export const inputClass =
  'w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue focus:border-accent-blue outline-none transition';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-3 py-2 bg-dashboard-bg border border-dashboard-border text-text-secondary text-sm rounded-lg hover:text-text-primary hover:border-accent-blue/40 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const btnSmall =
  'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-dashboard-bg border border-dashboard-border text-text-secondary text-xs font-medium rounded-lg hover:text-text-primary hover:border-accent-blue/40 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

export const btnSmallPrimary =
  'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-accent-blue border border-accent-blue text-white text-xs font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
