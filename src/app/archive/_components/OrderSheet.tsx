'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { Order } from '@/types/order';
import { STATUS_LABELS, formatSellerLess } from '@/types/order';
import { archiveDateOf, daysToPay, isPaid, plannedRefundOf, previousStatusOf, receivedOf } from '@/lib/archive';
import { todayStr } from '@/lib/followup';
import { Sheet, btnNeutral, btnPrimary, copyText, inputCls } from '@/app/follow-ups/_components/ui';
import { PlatformBadge, StatusPill, platformTitle, rupees, shortDate } from './shared';

type Mode = 'view' | 'edit' | 'reopen';

export default function OrderSheet({
  order,
  bankNames,
  onClose,
  onSavePayment,
  onReopen,
}: {
  order: Order;
  bankNames: string[];
  onClose: () => void;
  onSavePayment: (order: Order, date: string, bank: string) => Promise<boolean>;
  onReopen: (order: Order) => Promise<boolean>;
}) {
  const today = todayStr();
  const paid = isPaid(order);
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(order.paymentReceivedDate?.slice(0, 10) || today);
  const [bank, setBank] = useState(order.paymentBank || '');
  const back = previousStatusOf(order);
  const days = daysToPay(order);
  const archivedOn = archiveDateOf(order);

  const steps: { label: string; date?: string | null }[] = [
    { label: 'Ordered', date: order.orderDate },
    { label: 'Delivered', date: order.deliveredDate },
    { label: 'Review / rating done', date: order.reviewRatingDate },
    { label: 'Refund form filled', date: order.refundFormFilledDate },
    { label: 'Informed mediator', date: order.informedMediatorDate },
  ].filter((s) => !!s.date);

  const copyId = async () => {
    if (await copyText(order.orderId)) toast.success('Order ID copied');
    else toast.error('Could not copy. Press and hold the order ID to copy it.');
  };

  const save = async () => {
    if (busy) return;
    if (!date) return toast.error('Pick the date you received the payment.');
    if (date > today) return toast.error('The paid date cannot be in the future.');
    setBusy(true);
    const ok = await onSavePayment(order, date, bank);
    setBusy(false);
    if (ok) setMode('view');
  };

  const reopen = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onReopen(order);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title={order.orderId}
      labelId="archive-order-title"
      subtitle={
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <PlatformBadge platform={order.platform} /> {order.productName || platformTitle(order.platform)}
        </span>
      }
      onClose={busy ? () => {} : onClose}
    >
      {mode === 'view' && (
        <>
          <div className="flex items-center justify-between gap-3">
            <StatusPill order={order} />
            <span className="text-xs text-text-muted">
              {paid ? 'Paid' : 'Cancelled'} {shortDate(archivedOn, today)}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
            <Detail label="You paid" value={rupees(order.totalAmount)} />
            {order.commissionAmount != null ? (
              <Detail label="Commission" value={rupees(order.commissionAmount)} />
            ) : order.sellerLess > 0 ? (
              <Detail label="Seller's less" value={formatSellerLess(order.sellerLess, order.sellerLessPercent)} />
            ) : (
              <Detail label="Deal" value="Full refund" />
            )}
            {paid ? (
              <Detail label="Refund received" value={rupees(receivedOf(order))} strong />
            ) : (
              <Detail label="Refund (cancelled)" value={`₹0 · was ${rupees(plannedRefundOf(order))}`} />
            )}
            {paid && <Detail label="Bank" value={order.paymentBank || 'Not saved'} />}
            <Detail label="Mediator" value={order.mediatorName || '-'} />
            <Detail label="Reviewer" value={order.reviewerName || '-'} />
            {order.brandName && <Detail label="Brand" value={order.brandName} />}
            <Detail label="Order type" value={order.orderType || '-'} />
            {order.email && <Detail label="Email" value={order.email} wide />}
          </dl>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2">
              Journey{days != null ? ` · paid ${days} day${days === 1 ? '' : 's'} after the form` : ''}
            </p>
            <ol className="ml-1 border-l-2 border-dashboard-border">
              {steps.map((s) => (
                <Step key={s.label} label={s.label} date={shortDate(s.date, today)} />
              ))}
              <Step label={paid ? 'Paid' : 'Cancelled'} date={shortDate(archivedOn, today)} tone={paid ? 'green' : 'red'} />
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={copyId} className={btnNeutral}>Copy order ID</button>
            {paid ? (
              <button type="button" onClick={() => setMode('edit')} className={btnNeutral}>Edit paid date / bank</button>
            ) : (
              <button type="button" onClick={() => setMode('reopen')} className={btnNeutral}>Reopen order</button>
            )}
          </div>
          {paid && (
            <button type="button" onClick={() => setMode('reopen')} className={`${btnNeutral} w-full`}>Reopen order</button>
          )}
        </>
      )}

      {mode === 'edit' && (
        <>
          <div>
            <label htmlFor="archive-paid-date" className="text-xs font-semibold text-text-primary">Date you received the payment</label>
            <input id="archive-paid-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="archive-paid-bank" className="text-xs font-semibold text-text-primary">
              Bank <span className="font-normal text-text-muted">optional</span>
            </label>
            <input
              id="archive-paid-bank"
              value={bank}
              maxLength={60}
              list="archive-bank-list"
              onChange={(e) => setBank(e.target.value)}
              placeholder="e.g. HDFC"
              className={`${inputCls} mt-1.5`}
            />
            <datalist id="archive-bank-list">
              {bankNames.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <p className="text-[11px] text-text-muted">The refund amount and the rest of the order stay the same.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('view')} disabled={busy} className={btnNeutral}>Cancel</button>
            <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </>
      )}

      {mode === 'reopen' && (
        <>
          <p className="text-sm font-semibold text-text-primary">Reopen this order?</p>
          <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-3 text-xs text-text-secondary space-y-1">
            <p>
              It goes back to <b className="text-text-primary">{STATUS_LABELS[back]}</b>, the status it had before you marked it {paid ? 'paid' : 'cancelled'}.
            </p>
            <p>It shows on the Dashboard again{order.nextReminderDate ? ', and its follow-up reminder comes back' : ''}.</p>
          </div>
          {paid && <p className="text-[11px] text-text-muted">The paid date and bank are cleared. Everything else stays as it is. You can undo right after.</p>}
          {!paid && <p className="text-[11px] text-text-muted">Everything else on the order stays as it is. You can undo right after.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('view')} disabled={busy} className={btnNeutral}>Keep archived</button>
            <button type="button" onClick={reopen} disabled={busy} className={btnPrimary}>{busy ? 'Reopening…' : 'Reopen'}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function Detail({ label, value, strong = false, wide = false }: { label: string; value: string; strong?: boolean; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-text-muted">{label}</dt>
      <dd className={`font-semibold break-words ${strong ? 'text-accent-green' : 'text-text-primary'}`}>{value}</dd>
    </div>
  );
}

function Step({ label, date, tone }: { label: string; date: string; tone?: 'green' | 'red' }) {
  const dot = tone === 'green' ? 'bg-accent-green' : tone === 'red' ? 'bg-accent-red' : 'bg-text-muted';
  const text = tone === 'green' ? 'text-accent-green font-semibold' : tone === 'red' ? 'text-accent-red font-semibold' : 'text-text-secondary';
  return (
    <li className="relative pl-4 py-1 flex items-center justify-between gap-3 text-xs">
      <span className={`absolute -left-[5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />
      <span className={text}>{label}</span>
      <span className={`${text} tabular-nums whitespace-nowrap`}>{date}</span>
    </li>
  );
}

