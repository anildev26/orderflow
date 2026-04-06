'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Order, STATUS_LABELS, STATUS_COLORS, OrderPlatform } from '@/types/order';
import UpdateOrderModal from './UpdateOrderModal';

const PLATFORM_BADGE_COLORS: Record<OrderPlatform, string> = {
  amazon: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  flipkart: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  meesho: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  myntra: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  jio: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  blinkit: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ajio: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

interface OrderCardProps {
  order: Order;
}

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const BORDER_COLORS: Record<string, string> = {
  ordered: 'border-l-blue-500',
  delivered: 'border-l-cyan-500',
  review_rating_submitted: 'border-l-purple-500',
  refund_form_pending: 'border-l-red-500',
  refund_form_filled: 'border-l-green-500',
  informed_mediator: 'border-l-teal-500',
  payment_received: 'border-l-emerald-600',
};

export default function OrderCard({ order }: OrderCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const days = mounted ? daysAgo(order.orderDate) : 0;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // Return period tracking (only when delivered)
  const showReturnPeriod = order.status === 'delivered' && order.deliveredDate;
  const returnPeriodEnd = mounted && showReturnPeriod
    ? new Date(new Date(order.deliveredDate!).getTime() + (order.returnPeriodDays || 7) * 24 * 60 * 60 * 1000)
    : null;
  const returnDaysLeft = returnPeriodEnd
    ? Math.ceil((returnPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Refund form link from mediator message
  const refundFormUrl = order.mediatorMessage
    ? (order.mediatorMessage.match(/(https?:\/\/[^\s]+)/i)?.[1] || null)
    : null;

  const borderColor = BORDER_COLORS[order.status] || 'border-l-blue-500';

  return (
    <>
      <div className={`rounded-xl overflow-hidden bg-dashboard-card border border-dashboard-border ${borderColor} border-l-4`}>
        <div className="p-4">
          {/* Row 1: Platform badge + Order ID + Status */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize flex-shrink-0 ${PLATFORM_BADGE_COLORS[order.platform] || PLATFORM_BADGE_COLORS.other}`}>
                {order.platform}
              </span>
              <span className="text-sm font-bold font-mono text-text-primary truncate">{order.orderId}</span>
              <button
                onClick={() => copyToClipboard(order.orderId, 'Order ID')}
                className="px-1.5 py-0.5 text-[10px] bg-dashboard-bg border border-dashboard-border rounded text-text-muted hover:text-text-primary transition flex-shrink-0"
              >
                Copy
              </button>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-md text-white flex-shrink-0 ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>

          {/* Row 2: Product + Amount + Date + Reviewer + Mediator */}
          <div className="mt-2 flex flex-col gap-1 md:max-w-xl">
            <p className="text-sm font-medium text-text-primary truncate">{order.productName}</p>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="text-sm font-bold text-green-400">&#8377;{order.totalAmount.toLocaleString('en-IN')}</span>
              {order.sellerLess > 0 && <span>Less: &#8377;{order.sellerLess}</span>}
              <span>{order.orderDate} ({days}d)</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium text-text-primary">{order.reviewerName}</span>
              </span>
              {order.mediatorName && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {order.mediatorName}
                </span>
              )}
              <span className="capitalize">{order.orderType}</span>
            </div>
          </div>

          {/* Return Period countdown (only when delivered) */}
          {showReturnPeriod && returnDaysLeft !== null && (
            <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs ${
              returnDaysLeft > 0
                ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                : 'bg-green-500/10 border border-green-500/20 text-green-400'
            }`}>
              {returnDaysLeft > 0
                ? `Return ends: ${returnPeriodEnd!.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (${returnDaysLeft}d left)`
                : 'Return period over'}
            </div>
          )}

          {/* Status date pills (compact) */}
          {(order.reviewRatingDate || order.refundFormFilledDate || order.informedMediatorDate) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {order.reviewRatingDate && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Review: {new Date(order.reviewRatingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              )}
              {order.refundFormFilledDate && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20">
                  Form filled: {new Date(order.refundFormFilledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              )}
              {order.informedMediatorDate && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Mediator: {new Date(order.informedMediatorDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-3 flex items-center gap-2">
          {refundFormUrl && (
            <a
              href={refundFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition inline-flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Refund Form
            </a>
          )}
          <a
            href={`https://t.me/orderflow_orders_bot?start=${order.orderId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Track on Telegram"
            className="py-2 px-3 text-xs font-medium rounded-lg bg-[#1a2535] border border-[#2d4a7a] text-[#5ba3e0] hover:bg-[#1e2e45] transition flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.973 13.89l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.945-.001.001-.001.001.341-.276z"/>
            </svg>
          </a>
          <button
            onClick={() => setShowModal(true)}
            className={`${refundFormUrl ? 'flex-1' : 'w-full'} py-2 text-center text-xs font-medium rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-blue-400 hover:bg-accent-blue/20 transition`}
          >
            Update Order - {STATUS_LABELS[order.status]}
          </button>
        </div>
      </div>

      {showModal && (
        <UpdateOrderModal order={order} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
