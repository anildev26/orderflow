'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// Open sheets, newest last. Escape closes only the top one; page scroll is locked
// while any is open and restored when the last one closes.
const stack: number[] = [];
let seq = 0;
let savedOverflow = '';

function useSheetLayer(onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => {
    ref.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const id = ++seq;
    if (stack.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) document.body.style.overflow = savedOverflow;
    };
  }, []);
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  title,
  subtitle,
  labelId,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  labelId: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useSheetLayer(onClose);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-dashboard-card border border-dashboard-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-dashboard-border">
          <div className="min-w-0">
            <h2 id={labelId} className="text-base font-semibold text-text-primary break-words">{title}</h2>
            {subtitle && <div className="text-xs text-text-muted mt-0.5 break-words">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-1 flex-shrink-0 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-dashboard-bg transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="px-4 sm:px-5 py-3 border-t border-dashboard-border flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export { copyText } from '@/lib/clipboard';

/** Success toast with an Undo button. */
export function toastWithUndo(message: string, onUndo: () => Promise<void>) {
  toast.success(
    (t) => (
      <span className="flex items-center gap-3">
        <span>{message}</span>
        <button
          type="button"
          className="text-accent-blue font-semibold whitespace-nowrap"
          onClick={async () => {
            toast.dismiss(t.id);
            try {
              await onUndo();
              toast.success('Undone');
            } catch (err) {
              toast.error(err instanceof Error ? `Could not undo: ${err.message}` : 'Could not undo');
            }
          }}
        >
          Undo
        </button>
      </span>
    ),
    { duration: 7000 },
  );
}

export function errorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : '';
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Could not reach the server. Check your internet and try again.';
  if (/jwt|session|not authenticated/i.test(msg)) return 'Your session has expired. Refresh the page or sign in again.';
  return msg && msg.length < 140 ? `${fallback}: ${msg}` : fallback;
}

export const btn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
export const btnNeutral = `${btn} bg-dashboard-bg border-dashboard-border text-text-secondary hover:text-text-primary hover:border-accent-blue/40`;
export const btnPrimary = `${btn} bg-accent-blue border-accent-blue text-white hover:opacity-90`;
export const btnWhatsApp = `${btn} bg-[#25D366] border-[#25D366] text-white hover:opacity-90`;
export const btnPaid = `${btn} bg-accent-green/15 border-accent-green/30 text-accent-green hover:bg-accent-green/25`;
export const btnDanger = `${btn} bg-accent-red/10 border-accent-red/30 text-accent-red hover:bg-accent-red/20`;
export const inputCls =
  'w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue focus:border-accent-blue outline-none';
