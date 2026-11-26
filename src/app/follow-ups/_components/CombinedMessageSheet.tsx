'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { Order } from '@/types/order';
import { fmtDate } from '@/lib/followup';
import { whatsAppFollowUpUrl } from '@/lib/phone';
import { workingDaysLabel } from '@/lib/workingDays';
import {
  MAX_ORDERS_PER_MESSAGE,
  NO_MEDIATOR_KEY,
  TONE_LABEL,
  buildMediatorMessage,
  isDue,
  refundOf,
  rupees,
  toneFor,
  type MediatorGroup,
  type MessageTone,
} from '@/lib/followUpBoard';
import { WhatsAppGlyph } from '@/components/WhatsAppChatLink';
import { overdueBadge, PlatformBadge } from './FollowUpCard';
import { Sheet, btnNeutral, btnPrimary, btnWhatsApp, copyText } from './ui';

export default function CombinedMessageSheet({
  group,
  today,
  phone,
  waitDays,
  onClose,
  onMarkContacted,
}: {
  group: MediatorGroup<Order>;
  today: string;
  phone: string | null;
  waitDays: (o: Order) => number | null;
  onClose: () => void;
  onMarkContacted: (orders: Order[]) => Promise<boolean>;
}) {
  const dueIds = useMemo(() => group.orders.filter((o) => isDue(o, today)).slice(0, MAX_ORDERS_PER_MESSAGE).map((o) => o.id), [group, today]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(dueIds.length ? dueIds : group.orders.slice(0, 1).map((o) => o.id)));
  const chosen = group.orders.filter((o) => selected.has(o.id));
  const suggestedTone = toneFor(chosen.length ? chosen : group.orders);
  const [tone, setTone] = useState<MessageTone | null>(null);
  const activeTone = tone ?? suggestedTone;
  const suggested = chosen.length
    ? buildMediatorMessage(group.key === NO_MEDIATOR_KEY ? '' : group.name, chosen, activeTone, { fmtDate, waitDays: (o) => waitDays(o as Order), daysLabel: workingDaysLabel })
    : '';
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? suggested;
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = chosen.reduce((s, o) => s + refundOf(o), 0);
  const atCap = selected.size >= MAX_ORDERS_PER_MESSAGE;

  const changeSelection = (next: Set<string>) => {
    setSelected(next);
    setEdited(null);
    setSent(false);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_ORDERS_PER_MESSAGE) next.add(id);
    else {
      toast.error(`One message can list up to ${MAX_ORDERS_PER_MESSAGE} orders. Send the rest in a second message.`);
      return;
    }
    changeSelection(next);
  };

  const copy = async () => {
    if (!text.trim()) return;
    if (await copyText(text)) {
      toast.success('Message copied. Paste it in WhatsApp.');
      setSent(true);
    } else {
      toast.error('Could not copy. Select the text in the box and copy it.');
    }
  };

  const markContacted = async () => {
    if (busy || !chosen.length) return;
    setBusy(true);
    const ok = await onMarkContacted(chosen);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title={group.key === NO_MEDIATOR_KEY ? 'Orders without a mediator' : `Message ${group.name}`}
      subtitle={`${group.orders.length} ${group.orders.length === 1 ? 'order' : 'orders'} waiting · tick the ones to include`}
      labelId="fu-combined-title"
      onClose={onClose}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <p className="text-xs font-semibold text-text-primary">
            {chosen.length} selected · {rupees(total)}
          </p>
          <div className="flex gap-3 text-xs">
            <button type="button" className="text-accent-blue disabled:opacity-40" disabled={!dueIds.length} onClick={() => changeSelection(new Set(dueIds))}>Due only</button>
            <button type="button" className="text-accent-blue" onClick={() => changeSelection(new Set(group.orders.slice(0, MAX_ORDERS_PER_MESSAGE).map((o) => o.id)))}>
              {group.orders.length > MAX_ORDERS_PER_MESSAGE ? `First ${MAX_ORDERS_PER_MESSAGE}` : 'All'}
            </button>
            <button type="button" className="text-accent-blue" onClick={() => changeSelection(new Set())}>None</button>
          </div>
        </div>
        <ul className="rounded-xl border border-dashboard-border divide-y divide-dashboard-border overflow-hidden">
          {group.orders.map((o) => {
            const b = overdueBadge(o.nextReminderDate, today);
            const checked = selected.has(o.id);
            return (
              <li key={o.id}>
                <label className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer ${checked ? 'bg-accent-blue/5' : 'bg-dashboard-bg'} ${!checked && atCap ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.id)}
                    className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[var(--color-accent-blue)]"
                    aria-label={`Include ${o.orderId}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <PlatformBadge platform={o.platform} />
                      <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full ${b.cls}`}>{b.text}</span>
                    </span>
                    <span className="block font-mono text-xs font-semibold text-text-primary break-all mt-1">{o.orderId}</span>
                    <span className="block text-[11px] text-text-muted break-words">
                      {o.productName ? `${o.productName} · ` : ''}
                      {waitDays(o) != null ? `form filled ${workingDaysLabel(waitDays(o)!)} ago` : 'refund form date not set'}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-accent-green tabular-nums flex-shrink-0">{rupees(refundOf(o))}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {group.orders.length > MAX_ORDERS_PER_MESSAGE && (
          <p className="text-[11px] text-text-muted mt-1.5">One message can list up to {MAX_ORDERS_PER_MESSAGE} orders, so long lists stay readable.</p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <p className="text-xs font-semibold text-text-primary">Message</p>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Message tone">
            {(['friendly', 'reminder', 'firm'] as MessageTone[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={activeTone === t}
                onClick={() => {
                  setTone(t);
                  setEdited(null);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                  activeTone === t ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue font-semibold' : 'border-dashboard-border bg-dashboard-bg text-text-secondary'
                }`}
              >
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setEdited(e.target.value);
            setSent(false);
          }}
          rows={10}
          aria-label="Message to send"
          placeholder="Tick at least one order to build the message."
          className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-text-primary outline-none focus:ring-2 focus:ring-accent-blue resize-y"
        />
        {edited != null && (
          <button type="button" className="text-xs text-accent-blue mt-1" onClick={() => setEdited(null)}>Reset to suggested text</button>
        )}
        {tone == null && chosen.length > 0 && suggestedTone !== 'friendly' && (
          <p className="text-[11px] text-text-muted mt-1">Tone set to {TONE_LABEL[suggestedTone]} because you have asked about these orders before.</p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {phone ? (
          <a
            href={text.trim() ? whatsAppFollowUpUrl(text, phone) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!text.trim()}
            onClick={(e) => {
              if (!text.trim()) e.preventDefault();
              else setSent(true);
            }}
            className={`${btnWhatsApp} py-2.5 ${!text.trim() ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <WhatsAppGlyph className="w-4 h-4" /> Open WhatsApp
          </a>
        ) : null}
        <button type="button" onClick={copy} disabled={!text.trim()} className={`${btnNeutral} py-2.5 ${phone ? '' : 'sm:col-span-2'}`}>
          Copy message
        </button>
      </div>
      {!phone && group.key !== NO_MEDIATOR_KEY && (
        <p className="text-[11px] text-text-muted">Save {group.name}&apos;s WhatsApp number in Account Settings → Mediators to open their chat directly.</p>
      )}

      <div className={`rounded-xl border p-3 space-y-2 ${sent ? 'border-accent-green/40 bg-accent-green/10' : 'border-dashboard-border bg-dashboard-bg'}`}>
        <p className="text-xs text-text-secondary">
          {sent ? 'Sent it? ' : 'After sending, '}mark the {chosen.length} selected {chosen.length === 1 ? 'order' : 'orders'} as contacted. Next reminder in 3 working days.
        </p>
        <button type="button" onClick={markContacted} disabled={busy || !chosen.length} className={`${btnPrimary} w-full py-2.5`}>
          {busy ? 'Saving…' : `✓ Mark ${chosen.length} contacted`}
        </button>
      </div>
    </Sheet>
  );
}
