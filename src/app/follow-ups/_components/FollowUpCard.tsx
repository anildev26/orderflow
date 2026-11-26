'use client';

import toast from 'react-hot-toast';
import type { Order } from '@/types/order';
import { buildFollowUpMessage } from '@/lib/followup';
import { whatsAppFollowUpUrl } from '@/lib/phone';
import { workingDaysLabel, workingDaysOffset } from '@/lib/workingDays';
import { platformTitle, refundOf, rupees } from '@/lib/followUpBoard';
import { WhatsAppGlyph } from '@/components/WhatsAppChatLink';
import { btnNeutral, btnWhatsApp, copyText } from './ui';

export function overdueBadge(nextReminderDate: string | undefined, today: string) {
  const offset = nextReminderDate ? workingDaysOffset(nextReminderDate, today) : 0;
  if (offset < 0) return { text: `${workingDaysLabel(-offset)} overdue`, cls: 'bg-accent-red/15 text-accent-red', tone: 'overdue' as const };
  if (offset === 0) return { text: 'Due today', cls: 'bg-accent-yellow/15 text-accent-yellow', tone: 'due' as const };
  return { text: `in ${workingDaysLabel(offset)}`, cls: 'bg-dashboard-bg text-text-muted border border-dashboard-border', tone: 'upcoming' as const };
}

const PLATFORM_CLS: Record<string, string> = {
  amazon: 'bg-amber-500/15 text-amber-500',
  flipkart: 'bg-blue-500/15 text-blue-500',
  meesho: 'bg-rose-500/15 text-rose-500',
  myntra: 'bg-violet-500/15 text-violet-500',
  ajio: 'bg-teal-500/15 text-teal-500',
  nykaa: 'bg-pink-500/15 text-pink-500',
};

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${PLATFORM_CLS[platform] ?? 'bg-dashboard-bg text-text-secondary border border-dashboard-border'}`}>
      {platformTitle(platform)}
    </span>
  );
}

export async function copyOrderId(orderId: string) {
  if (await copyText(orderId)) toast.success('Order ID copied');
  else toast.error('Could not copy. Press and hold the ID to copy it.');
}

export default function FollowUpCard({
  order,
  today,
  phone,
  waitDays,
  busy,
  onContacted,
  onMore,
}: {
  order: Order;
  today: string;
  phone: string | null;
  waitDays: number | null;
  busy: boolean;
  onContacted: (order: Order) => void;
  onMore: (order: Order) => void;
}) {
  const badge = overdueBadge(order.nextReminderDate, today);
  const stripe = badge.tone === 'overdue' ? 'border-l-accent-red' : badge.tone === 'due' ? 'border-l-accent-yellow' : 'border-l-accent-blue';
  const message = buildFollowUpMessage(order);

  const copyMessage = async () => {
    if (await copyText(message)) toast.success('Follow-up message copied. Paste it in WhatsApp.');
    else toast.error('Could not copy the message. Open More to see the order details.');
  };

  return (
    <article className={`bg-dashboard-card border border-dashboard-border border-l-4 ${stripe} rounded-xl p-3 sm:p-3.5 flex flex-col gap-2 min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <PlatformBadge platform={order.platform} />
          <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>{badge.text}</span>
          {order.reminderStatus === 'snoozed' && <span className="text-[10.5px] text-text-muted">snoozed</span>}
        </div>
        <span className="text-sm font-bold text-accent-green tabular-nums whitespace-nowrap">{rupees(refundOf(order))}</span>
      </div>

      <button
        type="button"
        onClick={() => copyOrderId(order.orderId)}
        title="Copy order ID"
        className="self-start text-left font-mono text-[13px] font-semibold text-text-primary break-all hover:text-accent-blue transition"
      >
        {order.orderId}
        <span className="ml-1.5 text-[10px] font-sans font-normal text-text-muted">copy</span>
      </button>

      <p className="text-xs text-text-muted break-words">
        {[
          order.productName,
          order.mediatorName ? <span key="m" className="text-text-secondary font-medium">{order.mediatorName.trim()}</span> : null,
          waitDays != null ? `form filled ${workingDaysLabel(waitDays)} ago` : null,
          order.reminderCount ? `asked ${order.reminderCount} ${order.reminderCount === 1 ? 'time' : 'times'}` : null,
        ]
          .filter(Boolean)
          .map((part, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {part}
            </span>
          ))}
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 sm:gap-2">
        {phone ? (
          <a href={whatsAppFollowUpUrl(message, phone)} target="_blank" rel="noopener noreferrer" className={`${btnWhatsApp} min-w-0 px-2`}>
            <WhatsAppGlyph className="w-3.5 h-3.5 flex-shrink-0 hidden min-[360px]:inline" /> <span className="truncate">WhatsApp</span>
          </a>
        ) : (
          <button type="button" onClick={copyMessage} className={`${btnNeutral} min-w-0 px-2`} title="No WhatsApp number saved for this mediator">
            <WhatsAppGlyph className="w-3.5 h-3.5 flex-shrink-0 hidden min-[360px]:inline" /> <span className="truncate"><span className="min-[360px]:hidden">Copy</span><span className="hidden min-[360px]:inline">Copy message</span></span>
          </button>
        )}
        <button type="button" onClick={() => onContacted(order)} disabled={busy} className={`${btnNeutral} min-w-0 px-2`}>
          <span className="truncate">{busy ? 'Saving…' : <><span className="hidden min-[360px]:inline">✓ </span>Contacted</>}</span>
        </button>
        <button type="button" onClick={() => onMore(order)} disabled={busy} className={`${btnNeutral} px-2.5`} aria-label={`More for ${order.orderId}`}>
          More
        </button>
      </div>
    </article>
  );
}
