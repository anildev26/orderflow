'use client';

import { memo, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { Order, STATUS_LABELS, STATUS_COLORS, OrderPlatform, formatSellerLess } from '@/types/order';
import { CopyTextButton } from '@/components/CopyTextButton';
import { isSafeHttpUrl } from '@/lib/urlSafety';
import { getReturnWindow } from '@/lib/returnWindow';
import { reviewDueDate } from '@/lib/reviewTiming';
import { useLocalDate } from '@/hooks/useLocalDate';
import { useMediatorStore } from '@/store/useMediatorStore';
import { orderChatPhone } from '@/lib/mediators';
import { WhatsAppChatLink } from '@/components/WhatsAppChatLink';
import { DotsOverlay } from '@/components/loading/LoadingDots';
import { messageView } from '@/lib/mediatorMessage';
import { copyText } from '@/lib/clipboard';
import { daysBetween } from '@/lib/followup';

const UpdateOrderModal = dynamic(() => import('./UpdateOrderModal'), { ssr: false, loading: DotsOverlay });

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

interface OrderCardProps {
  order: Order;
}

// Local calendar dates (YYYY-MM-DD) shown as "02 Nov"; avoids the UTC shift of new Date('YYYY-MM-DD').
function shortDate(d: string): string {
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
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

function OrderCard({ order }: OrderCardProps) {
  const [showModal, setShowModal] = useState(false);
  const mediators = useMediatorStore((s) => s.mediators);
  const ensureMediators = useMediatorStore((s) => s.ensureLoaded);
  useEffect(() => { void ensureMediators(); }, [ensureMediators]);
  const chatPhone = orderChatPhone(order, mediators);

  // Keep the return window visible alongside later statuses, including reviews.
  // today is null until the page runs in the browser, so dates never differ from the server render.
  const today = useLocalDate();
  const mounted = today !== null;
  const days = mounted && today ? Math.max(0, daysBetween(today, order.orderDate.slice(0, 10))) : 0;
  const returnWindow = today ? getReturnWindow(order, today) : null;
  const returnEndStr = returnWindow?.endDate;
  const returnPeriodEnd = returnEndStr ? new Date(returnEndStr + 'T00:00:00') : null;
  const returnDaysLeft = mounted && returnWindow ? returnWindow.daysLeft : null;
  const reviewDue = reviewDueDate(order);
  const showReviewStrip = mounted && !!today && order.status === 'delivered' && !!reviewDue && !!returnWindow && returnDaysLeft !== null && returnDaysLeft > 0;
  const reviewIsDue = Boolean(showReviewStrip && today && reviewDue && today >= reviewDue);

  // Refund form button: the saved link, else the form link found in the message.
  // The message itself stays available whenever it says more than that link.
  const msg = messageView(order.mediatorMessage, order.refundFormLink, isSafeHttpUrl);
  const refundFormUrl = msg.formUrl;
  const showViewMessage = msg.hasMore;
  const copyMessage = async () => {
    if (await copyText(order.mediatorMessage || '')) toast.success('Message copied');
    else toast.error('Could not copy. Press and hold the message to copy it.');
  };

  const [showMessageModal, setShowMessageModal] = useState(false);
  useEffect(() => {
    if (!showMessageModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMessageModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMessageModal]);

  const borderColor = BORDER_COLORS[order.status] || 'border-l-blue-500';

  return (
    <>
      <div className={`rounded-xl overflow-hidden bg-dashboard-card border border-dashboard-border ${borderColor} border-l-4`}>
        <div className="p-4">
          {/* Row 1: Platform badge + Order ID + Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize flex-shrink-0 ${PLATFORM_BADGE_COLORS[order.platform] || PLATFORM_BADGE_COLORS.other}`}>
                {order.platform}
              </span>
              <span className="text-sm font-bold font-mono text-text-primary break-all min-w-0">{order.orderId}</span>
              <CopyTextButton text={order.orderId} />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-md text-white ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
          </div>

          {/* Row 2: Product + Amount + Date + Reviewer + Mediator */}
          <div className="mt-2 flex flex-col gap-1 md:max-w-xl">
            <p className="text-sm font-medium text-text-primary break-words">{order.productName}</p>
            <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-text-muted">
              <span className="text-sm font-bold text-green-400">&#8377;{order.totalAmount.toLocaleString('en-IN')}</span>
              {order.commissionAmount != null ? (
                <span>Commission: &#8377;{order.commissionAmount.toLocaleString('en-IN')}</span>
              ) : order.sellerLess > 0 ? (
                <span>Less: {formatSellerLess(order.sellerLess, order.sellerLessPercent)}</span>
              ) : null}
              <span>{fmtDate(order.orderDate)} ({days}d)</span>
            </div>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-text-muted min-w-0">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium text-text-primary break-words">{order.reviewerName}</span>
              </span>
              {order.mediatorName && (
                <span className="flex items-center gap-1 min-w-0 max-w-full">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="break-words min-w-0">{order.mediatorName}</span>
                  {chatPhone ? <WhatsAppChatLink phone={chatPhone} name={order.mediatorName} compact /> : null}
                </span>
              )}
              <span className="capitalize">{order.orderType}</span>
            </div>
          </div>

          {/* Return window is independent of the current status badge. */}
          {returnWindow && returnDaysLeft !== null && (
            <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs ${
              returnDaysLeft > 0
                ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                : 'bg-green-500/10 border border-green-500/20 text-green-400'
            }`}>
              {`Return ends: ${returnPeriodEnd!.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
              {returnDaysLeft === 1 ? ' · Ends today' : returnDaysLeft > 1 ? ` (${returnDaysLeft}d left)` : ' · Return period over'}
            </div>
          )}

          {showReviewStrip && reviewDue && (
            <div className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-purple-500/10 border border-purple-500/20 text-purple-400">
              {reviewIsDue
                ? 'Rating & review due'
                : `Review due: ${new Date(reviewDue + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
            </div>
          )}

          {/* Status date pills (compact) */}
          {(order.reviewRatingDate || order.refundFormFilledDate || order.informedMediatorDate) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {order.reviewRatingDate && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Review: {shortDate(order.reviewRatingDate)}
                </span>
              )}
              {order.refundFormFilledDate && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20">
                  Form filled: {shortDate(order.refundFormFilledDate)}
                </span>
              )}
              {order.informedMediatorDate && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Mediator: {shortDate(order.informedMediatorDate)}
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
          {showViewMessage && (
            <button
              onClick={() => setShowMessageModal(true)}
              className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition inline-flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Message
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className={`${refundFormUrl || showViewMessage ? 'flex-1' : 'w-full'} min-w-0 py-2 text-center text-xs font-medium rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-blue-400 hover:bg-accent-blue/20 transition`}
          >
            Update Order - {STATUS_LABELS[order.status]}
          </button>
        </div>
      </div>

      {showModal && (
        <UpdateOrderModal order={order} onClose={() => setShowModal(false)} />
      )}

      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowMessageModal(false)}>
          <div className="bg-dashboard-card rounded-2xl w-full max-w-md mx-4 max-h-[70vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-dashboard-border">
              <h2 className="text-base font-semibold text-text-primary">Mediator Message</h2>
              <button onClick={() => setShowMessageModal(false)} aria-label="Close" className="p-1 rounded-lg hover:bg-dashboard-bg text-text-secondary hover:text-text-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-text-primary whitespace-pre-wrap break-words select-text">{order.mediatorMessage}</p>
              <button type="button" onClick={copyMessage} className="w-full py-2 text-xs font-medium rounded-lg bg-dashboard-bg border border-dashboard-border text-text-secondary hover:text-text-primary transition">
                Copy message
              </button>
              {(msg.links.length > 0 || refundFormUrl) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-muted">Links</p>
                  {refundFormUrl && !msg.links.some((l) => l.url === refundFormUrl) && (
                    <LinkRow href={refundFormUrl} kind="Refund form" />
                  )}
                  {msg.links.map((l) => (
                    <LinkRow key={l.url} href={l.url} kind={l.url === refundFormUrl ? 'Refund form' : l.kind === 'form' ? 'Form' : l.kind === 'product' ? 'Product' : 'Link'} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LinkRow({ href, kind }: { href: string; kind: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 p-2 rounded-lg bg-dashboard-bg border border-dashboard-border hover:border-accent-blue/40 transition">
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent-blue/15 text-accent-blue flex-shrink-0">{kind}</span>
      <span className="text-xs text-accent-blue break-all min-w-0">{href.replace(/^https?:\/\//i, '')}</span>
    </a>
  );
}

export default memo(OrderCard);
