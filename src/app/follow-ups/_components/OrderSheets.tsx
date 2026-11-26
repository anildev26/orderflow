'use client';

import { useState } from 'react';
import type { Order } from '@/types/order';
import { formatSellerLess } from '@/types/order';
import { fmtDate, nextMonday, snapReminderDate } from '@/lib/followup';
import { addWorkingDays, workingDaysLabel } from '@/lib/workingDays';
import { refundOf, rupees } from '@/lib/followUpBoard';
import { PlatformBadge } from './FollowUpCard';
import { Sheet, btnDanger, btnNeutral, btnPaid, btnPrimary, inputCls } from './ui';

const ACTION_LABELS: Record<string, string> = {
  scheduled: 'Reminder scheduled',
  contacted: 'Contacted mediator',
  snoozed: 'Reminder moved',
  stopped: 'Reminders stopped',
};

type Choice = 'd3' | 'tomorrow' | 'monday' | 'pick';

export function MoreSheet({
  order,
  today,
  onClose,
  onSnooze,
  onStop,
  onGotPaid,
  onUpdateOrder,
}: {
  order: Order;
  today: string;
  onClose: () => void;
  onSnooze: (order: Order, date: string, note: string) => Promise<boolean>;
  onStop: (order: Order, note: string) => Promise<boolean>;
  onGotPaid: (order: Order) => void;
  onUpdateOrder: (order: Order) => void;
}) {
  const options: { id: Choice; label: string; date: string }[] = [
    { id: 'd3', label: 'In 3 working days', date: addWorkingDays(today, 3) },
    { id: 'tomorrow', label: 'Next working day', date: addWorkingDays(today, 1) },
    { id: 'monday', label: 'Next Monday', date: nextMonday() },
  ];
  const [choice, setChoice] = useState<Choice>('d3');
  const [picked, setPicked] = useState(addWorkingDays(today, 5));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const date = choice === 'pick' ? picked : options.find((o) => o.id === choice)!.date;
  const refund = refundOf(order);
  const expected = order.refundFormFilledDate && order.refundTimelineDays ? addWorkingDays(order.refundFormFilledDate, order.refundTimelineDays) : null;
  const history = order.reminderHistory || [];

  const save = async () => {
    if (busy || !date) return;
    setBusy(true);
    const ok = await onSnooze(order, date, note);
    setBusy(false);
    if (ok) onClose();
  };
  const stop = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onStop(order, note);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title={order.orderId}
      labelId="fu-more-title"
      subtitle={<span className="inline-flex items-center gap-1.5"><PlatformBadge platform={order.platform} /> {order.productName || 'Order'} · refund {rupees(refund)}</span>}
      onClose={onClose}
    >
      <button type="button" onClick={() => onGotPaid(order)} className={`${btnPaid} w-full py-3 text-sm`}>₹ Got paid</button>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-text-primary mb-1.5">Remind me again</legend>
        {[...options, { id: 'pick' as const, label: 'Pick a date', date: picked }].map((o) => (
          <label
            key={o.id}
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition ${
              choice === o.id ? 'border-accent-blue/50 bg-accent-blue/10' : 'border-dashboard-border bg-dashboard-bg'
            }`}
          >
            <span className="flex items-center gap-2.5 text-sm text-text-primary">
              <input type="radio" name="fu-when" checked={choice === o.id} onChange={() => setChoice(o.id)} className="accent-[var(--color-accent-blue)]" />
              {o.label}
            </span>
            {o.id !== 'pick' && <span className="text-xs text-text-muted">{fmtDate(o.date)}</span>}
          </label>
        ))}
        {choice === 'pick' && (
          <input
            type="date"
            aria-label="Reminder date"
            value={picked}
            min={addWorkingDays(today, 1)}
            onChange={(e) => e.target.value && setPicked(snapReminderDate(e.target.value))}
            className={inputCls}
          />
        )}
      </fieldset>

      <div>
        <label htmlFor="fu-note" className="text-xs font-semibold text-text-primary">Note <span className="font-normal text-text-muted">optional</span></label>
        <input id="fu-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. mediator asked to call Monday" className={`${inputCls} mt-1.5`} />
      </div>

      <button type="button" onClick={save} disabled={busy || !date} className={`${btnPrimary} w-full py-2.5 text-sm`}>
        {busy ? 'Saving…' : `Remind me on ${fmtDate(date)}`}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onUpdateOrder(order)} className={btnNeutral}>Update order</button>
        {confirmStop ? (
          <button type="button" onClick={stop} disabled={busy} className={btnDanger}>Yes, stop reminders</button>
        ) : (
          <button type="button" onClick={() => setConfirmStop(true)} className={btnNeutral}>Stop reminders</button>
        )}
      </div>
      {confirmStop && <p className="text-[11px] text-text-muted">The order stays on your dashboard; it just leaves Follow-ups. Use Got paid instead if the refund arrived.</p>}

      <div className="border-t border-dashboard-border pt-3">
        <button type="button" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails} className="w-full flex items-center justify-between text-xs font-semibold text-text-primary">
          Order details and history
          <span className="text-text-muted">{showDetails ? 'Hide' : 'Show'}</span>
        </button>
        {showDetails && (
          <div className="mt-3 space-y-3">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <Detail label="Order date" value={fmtDate(order.orderDate)} />
              <Detail label="Order amount" value={rupees(order.totalAmount)} />
              {order.commissionAmount != null ? (
                <Detail label="Commission" value={rupees(order.commissionAmount)} />
              ) : order.sellerLess > 0 ? (
                <Detail label="Seller less" value={formatSellerLess(order.sellerLess, order.sellerLessPercent)} />
              ) : null}
              <Detail label="Refund amount" value={rupees(refund)} />
              {order.mediatorName && <Detail label="Mediator" value={order.mediatorName.trim()} />}
              {order.reviewerName && <Detail label="Reviewer" value={order.reviewerName} />}
              {order.refundFormFilledDate && <Detail label="Refund form filled" value={fmtDate(order.refundFormFilledDate)} />}
              {order.refundTimelineDays ? <Detail label="Timeline" value={workingDaysLabel(order.refundTimelineDays)} /> : null}
              {expected && <Detail label="Expected by" value={fmtDate(expected)} />}
              {order.lastContactedDate && <Detail label="Last contacted" value={fmtDate(order.lastContactedDate)} />}
              {order.email && <Detail label="Email" value={order.email} wide />}
            </dl>
            {history.length > 0 && (
              <ol className="space-y-1.5">
                {[...history].reverse().map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-text-muted">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />
                    <span className="break-words">
                      <span className="text-text-secondary font-medium">{fmtDate(h.date)}</span> · {ACTION_LABELS[h.action] || h.action}
                      {h.nextReminderDate && h.action !== 'stopped' ? `, next ${fmtDate(h.nextReminderDate)}` : ''}
                      {h.note ? <span className="italic"> · {h.note}</span> : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-semibold text-text-primary break-words">{value}</dd>
    </div>
  );
}

function yesterday(today: string): string {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function GotPaidSheet({
  order,
  today,
  onClose,
  onConfirm,
}: {
  order: Order;
  today: string;
  onClose: () => void;
  onConfirm: (order: Order, date: string, bank: string) => Promise<boolean>;
}) {
  const [date, setDate] = useState('');
  const [bank, setBank] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const minDate = order.orderDate && /^\d{4}-\d{2}-\d{2}/.test(order.orderDate) ? order.orderDate.slice(0, 10) : undefined;

  const save = async () => {
    if (busy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pick the date you received the payment.');
    if (date > today) return setError('The payment date cannot be in the future.');
    if (minDate && date < minDate) return setError('The payment date cannot be before the order date.');
    setError('');
    setBusy(true);
    const ok = await onConfirm(order, date, bank);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title="Got paid?"
      labelId="fu-paid-title"
      subtitle={<span className="font-mono break-all">{order.orderId}</span>}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={btnNeutral} disabled={busy}>Cancel</button>
          <button type="button" onClick={save} className={btnPrimary} disabled={busy || !date}>
            {busy ? 'Saving…' : 'Mark paid and move to Archive'}
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 p-4 text-center">
        <p className="text-xs text-text-secondary">Payment received</p>
        <p className="text-3xl font-bold text-accent-green tabular-nums mt-1">{rupees(refundOf(order))}</p>
        <p className="text-[11px] text-text-muted mt-1">
          {order.commissionAmount != null
            ? `${rupees(order.totalAmount)} order + ${rupees(order.commissionAmount)} commission`
            : order.sellerLess > 0
              ? `${rupees(order.totalAmount)} order − ${formatSellerLess(order.sellerLess, order.sellerLessPercent)} seller less`
              : 'Full order amount'}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-text-primary">When did you receive it? <span className="text-accent-red">*</span></p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {[
            { label: 'Today', value: today },
            { label: 'Yesterday', value: yesterday(today) },
          ].map((d) => (
            <button
              key={d.label}
              type="button"
              aria-pressed={date === d.value}
              onClick={() => {
                setDate(d.value);
                setError('');
              }}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                date === d.value ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue font-semibold' : 'border-dashboard-border bg-dashboard-bg text-text-secondary'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          aria-label="Payment received date"
          value={date}
          max={today}
          min={minDate}
          onChange={(e) => {
            setDate(e.target.value);
            setError('');
          }}
          className={`${inputCls} mt-2`}
        />
      </div>

      <div>
        <label htmlFor="fu-bank" className="text-xs font-semibold text-text-primary">Bank <span className="font-normal text-text-muted">optional</span></label>
        <input
          id="fu-bank"
          value={bank}
          maxLength={60}
          onChange={(e) => setBank(e.target.value)}
          placeholder="e.g. HDFC, SBI, Paytm, PhonePe"
          autoComplete="off"
          className={`${inputCls} mt-1.5`}
        />
      </div>

      {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
      <p className="text-[11px] text-text-muted">The order moves to Archive and its reminders stop. You can undo right after saving.</p>
    </Sheet>
  );
}
