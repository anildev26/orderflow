'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { Order, STATUS_LABELS, STATUS_COLORS, OrderPlatform } from '@/types/order';
import { useOrderStore } from '@/store/useOrderStore';
import {
  buildFollowUpMessage,
  fmtDate,
  daysOverdue,
  addDays,
  SNOOZE_PRESETS,
} from '@/lib/followup';

const UpdateOrderModal = dynamic(() => import('./UpdateOrderModal'), { ssr: false });

const PLATFORM_BADGE_COLORS: Record<OrderPlatform, string> = {
  amazon: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  flipkart: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  meesho: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  myntra: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  jio: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  blinkit: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ajio: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  shopsy: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  nykaa: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const ACTION_LABELS: Record<string, string> = {
  scheduled: 'Reminder scheduled',
  contacted: 'Contacted mediator',
  snoozed: 'Snoozed',
  stopped: 'Reminders stopped',
};

export default function FollowUpRow({ order }: { order: Order }) {
  const markContacted = useOrderStore((s) => s.markContacted);
  const snoozeReminder = useOrderStore((s) => s.snoozeReminder);
  const stopReminders = useOrderStore((s) => s.stopReminders);

  const [expanded, setExpanded] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [nextDate, setNextDate] = useState(() => addDays(undefined, 7));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const overdue = order.nextReminderDate ? daysOverdue(order.nextReminderDate) : 0;
  const refundAmount = order.totalAmount - order.sellerLess;

  // Urgency drives the left border + the overdue badge
  const urgency = overdue > 0 ? 'overdue' : overdue === 0 ? 'due' : 'upcoming';
  const borderColor =
    urgency === 'overdue' ? 'border-l-red-500' : urgency === 'due' ? 'border-l-amber-500' : 'border-l-blue-500';

  const overdueBadge =
    urgency === 'overdue'
      ? { text: `${overdue}d overdue`, cls: 'bg-red-500/15 text-red-400 border-red-500/30' }
      : urgency === 'due'
        ? { text: 'Due today', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
        : { text: `in ${-overdue}d`, cls: 'bg-dashboard-bg text-text-muted border-dashboard-border' };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildFollowUpMessage(order));
    toast.success('Follow-up message copied! Paste in WhatsApp');
  };

  const handleContacted = async () => {
    setBusy(true);
    await markContacted(order.id, nextDate, note);
    toast.success(`Marked contacted · next reminder ${fmtDate(nextDate)}`);
    setNote('');
    setBusy(false);
  };

  const handleSnooze = async () => {
    setBusy(true);
    await snoozeReminder(order.id, nextDate, note);
    toast.success(`Snoozed to ${fmtDate(nextDate)}`);
    setNote('');
    setBusy(false);
  };

  const handleStop = async () => {
    setBusy(true);
    await stopReminders(order.id, note);
    toast.success('Reminders stopped for this order');
    setBusy(false);
  };

  const history = order.reminderHistory || [];

  return (
    <>
      <div className={`rounded-xl overflow-hidden bg-dashboard-card border border-dashboard-border border-l-4 ${borderColor}`}>
        {/* Collapsed header */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left p-4 hover:bg-dashboard-card-hover transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize flex-shrink-0 ${PLATFORM_BADGE_COLORS[order.platform] || PLATFORM_BADGE_COLORS.other}`}>
                  {order.platform}
                </span>
                <span className="text-sm font-bold font-mono text-text-primary truncate">{order.orderId}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md text-white ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-text-muted flex-wrap">
                {order.mediatorName && (
                  <span>Mediator: <span className="text-text-secondary font-medium">{order.mediatorName}</span></span>
                )}
                <span>Reviewer: <span className="text-text-secondary font-medium">{order.reviewerName || '-'}</span></span>
                <span className="text-emerald-400 font-semibold">Refund ₹{refundAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-text-muted flex-wrap">
                {order.refundFormFilledDate && <span>Filled: {fmtDate(order.refundFormFilledDate)}</span>}
                <span>Next: <span className="text-text-secondary font-medium">{fmtDate(order.nextReminderDate)}</span></span>
                {order.reminderCount ? <span>· Contacted {order.reminderCount}x</span> : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${overdueBadge.cls}`}>
                {overdueBadge.text}
              </span>
              {order.reminderStatus === 'snoozed' && (
                <span className="text-[10px] text-text-muted">snoozed</span>
              )}
              <svg className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </button>

        {/* Expanded */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-dashboard-border pt-3 space-y-4">
            {/* Order details */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <Detail label="Product" value={order.productName || '-'} />
              <Detail label="Order Date" value={fmtDate(order.orderDate)} />
              <Detail label="Order Amount" value={`₹${order.totalAmount.toLocaleString('en-IN')}`} />
              {order.sellerLess > 0 && <Detail label="Seller Less" value={`₹${order.sellerLess.toLocaleString('en-IN')}`} />}
              <Detail label="Refund Amount" value={`₹${refundAmount.toLocaleString('en-IN')}`} accent />
              {order.email && <Detail label="Email" value={order.email} />}
              {order.refundFormFilledDate && <Detail label="Refund Form Filled" value={fmtDate(order.refundFormFilledDate)} />}
              {order.informedMediatorDate && <Detail label="Informed Mediator" value={fmtDate(order.informedMediatorDate)} />}
              {order.refundTimelineDays && <Detail label="Timeline" value={`${order.refundTimelineDays} days`} />}
              {order.lastContactedDate && <Detail label="Last Contacted" value={fmtDate(order.lastContactedDate)} />}
            </div>

            {/* Schedule next follow-up */}
            <div className="p-3 rounded-xl bg-dashboard-bg border border-dashboard-border space-y-3">
              <p className="text-xs font-semibold text-text-primary">Set next follow-up</p>
              <div className="flex flex-wrap gap-1.5">
                {SNOOZE_PRESETS.map((preset) => {
                  const d = preset.getDate();
                  const active = nextDate === d;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setNextDate(d)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                        active
                          ? 'bg-accent-blue text-white border-accent-blue'
                          : 'bg-dashboard-card border-dashboard-border text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-dashboard-card border border-dashboard-border text-text-primary focus:ring-2 focus:ring-accent-blue outline-none"
                />
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (e.g. mediator asked to call next Monday)"
                className="w-full bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
              />
              <p className="text-[11px] text-text-muted">Next reminder will be set to <span className="text-text-secondary font-medium">{fmtDate(nextDate)}</span>.</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleContacted}
                disabled={busy}
                className="flex-1 min-w-[140px] py-2 text-xs font-semibold rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition disabled:opacity-50"
              >
                Mark Contacted
              </button>
              <button
                onClick={handleSnooze}
                disabled={busy}
                className="flex-1 min-w-[100px] py-2 text-xs font-medium rounded-lg bg-dashboard-bg border border-dashboard-border text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover transition disabled:opacity-50"
              >
                Snooze
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 min-w-[140px] py-2 text-xs font-medium rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy for WhatsApp
              </button>
              <button
                onClick={() => setShowUpdate(true)}
                className="flex-1 min-w-[120px] py-2 text-xs font-medium rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-blue-400 hover:bg-accent-blue/20 transition"
              >
                Update Order
              </button>
              <button
                onClick={handleStop}
                disabled={busy}
                className="py-2 px-3 text-xs font-medium rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                Stop
              </button>
            </div>

            {/* Follow-up history */}
            {history.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-primary mb-2">Follow-up history</p>
                <ol className="space-y-1.5">
                  {[...history].reverse().map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-text-muted">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />
                      <span>
                        <span className="text-text-secondary font-medium">{fmtDate(h.date)}</span>
                        {' — '}{ACTION_LABELS[h.action] || h.action}
                        {h.nextReminderDate && h.action !== 'stopped' ? ` → next ${fmtDate(h.nextReminderDate)}` : ''}
                        {h.note ? <span className="italic"> · {h.note}</span> : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {showUpdate && <UpdateOrderModal order={order} onClose={() => setShowUpdate(false)} />}
    </>
  );
}

function Detail({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-text-muted">{label}</span>
      <p className={`font-semibold truncate ${accent ? 'text-emerald-400' : 'text-text-primary'}`}>{value}</p>
    </div>
  );
}
