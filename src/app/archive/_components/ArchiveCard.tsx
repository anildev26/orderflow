'use client';

import { memo } from 'react';
import type { Order } from '@/types/order';
import { reviewerKey } from '@/lib/archive';
import { Amount, Highlight, PlatformBadge, StatusPill, archiveLine } from './shared';

function ArchiveCardInner({ order, query, today, onOpen }: { order: Order; query: string; today: string; onOpen: (o: Order) => void }) {
  const q = query.trim().toLowerCase();
  const showReviewer = !!q && !!order.reviewerName && reviewerKey(order.reviewerName).includes(q);
  return (
    <button
      type="button"
      onClick={() => onOpen(order)}
      className={`w-full text-left rounded-xl border border-dashboard-border bg-dashboard-card p-3.5 hover:bg-dashboard-card-hover hover:border-accent-blue/40 transition flex flex-col gap-1 min-w-0 ${order.status === 'order_cancelled' ? 'opacity-90' : ''}`}
    >
      <span className="flex items-start justify-between gap-3 min-w-0">
        <span className="font-mono text-[13px] font-semibold text-text-primary break-all min-w-0">
          <Highlight text={order.orderId} query={query} />
        </span>
        <Amount order={order} />
      </span>
      {order.productName && (
        <span className="text-sm text-text-secondary break-words">
          <Highlight text={order.productName} query={query} />
        </span>
      )}
      <span className="flex items-center justify-between gap-3 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0 text-xs text-text-muted">
          <PlatformBadge platform={order.platform} />
          {order.mediatorName && (
            <span className="break-words min-w-0">
              <Highlight text={order.mediatorName} query={query} />
            </span>
          )}
        </span>
        <StatusPill order={order} />
      </span>
      {showReviewer && (
        <span className="text-xs text-text-muted break-words">
          Reviewer: <Highlight text={order.reviewerName} query={query} />
        </span>
      )}
      <span className="text-xs text-text-muted break-words">{archiveLine(order, today)}</span>
    </button>
  );
}

const ArchiveCard = memo(ArchiveCardInner);
export default ArchiveCard;
