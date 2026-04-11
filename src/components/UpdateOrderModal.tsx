'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order, OrderStatus, STATUS_LABELS, STATUS_COLORS, STATUS_OPTIONS } from '@/types/order';
import { useOrderStore } from '@/store/useOrderStore';

function fmtDate(d?: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface UpdateOrderModalProps {
  order: Order;
  onClose: () => void;
}

export default function UpdateOrderModal({ order, onClose }: UpdateOrderModalProps) {
  const router = useRouter();
  const updateOrderStatus = useOrderStore((s) => s.updateOrderStatus);
  // Bank is now a free-text field (no longer driven by settings store)
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [newStatus, setNewStatus] = useState<OrderStatus>(order.status);

  // Status-specific date fields
  const [deliveredDate, setDeliveredDate] = useState(order.deliveredDate || today);
  const [returnPeriodDays, setReturnPeriodDays] = useState(order.returnPeriodDays || 7);
  const [reviewRatingDate, setReviewRatingDate] = useState(order.reviewRatingDate || today);
  const [refundFormFilledDate, setRefundFormFilledDate] = useState(order.refundFormFilledDate || today);
  const [informedMediatorDate, setInformedMediatorDate] = useState(order.informedMediatorDate || today);
  const [paymentReceivedDate, setPaymentReceivedDate] = useState(order.paymentReceivedDate || today);
  const [paymentBank, setPaymentBank] = useState(order.paymentBank || '');

  // General fields
  const [mediatorMessage, setMediatorMessage] = useState(order.mediatorMessage || '');
  const [refundFormLink, setRefundFormLink] = useState(order.refundFormLink || '');
  const [sellerLess, setSellerLess] = useState(order.sellerLess);
  const [isReplacement, setIsReplacement] = useState(order.isReplacement);
  const [replacementOrderId, setReplacementOrderId] = useState(order.replacementOrderId || '');
  const [replacementAmount, setReplacementAmount] = useState(String(order.totalAmount || ''));

  // Copy all details for WhatsApp
  const handleCopyDetails = () => {
    const refundAmount = order.totalAmount - order.sellerLess;
    const lines: string[] = [
      `📦 *Order Details*`,
      ``,
      `*Order ID:* ${order.orderId}`,
      `*Platform:* ${order.platform.charAt(0).toUpperCase() + order.platform.slice(1)}`,
      `*Product:* ${order.productName}`,
      `*Order Date:* ${fmtDate(order.orderDate)}`,
      `*Order Type:* ${order.orderType}`,
      ``,
      `💰 *Payment Info*`,
      `*Order Amount:* ₹${order.totalAmount.toLocaleString('en-IN')}`,
      `*Seller Less:* ₹${order.sellerLess.toLocaleString('en-IN')}`,
      `*Refund Amount:* ₹${refundAmount.toLocaleString('en-IN')}`,
    ];

    if (order.mediatorName) lines.push(``, `👤 *Mediator:* ${order.mediatorName}`);
    if (order.reviewerName) lines.push(`*Reviewer:* ${order.reviewerName}`);

    lines.push(``, `📋 *Status:* ${STATUS_LABELS[order.status]}`);

    if (order.deliveredDate) {
      lines.push(`*Delivered:* ${fmtDate(order.deliveredDate)}`);
      if (order.returnPeriodDays) lines.push(`*Return Period:* ${order.returnPeriodDays} days`);
    }
    if (order.reviewRatingDate) lines.push(`*Review/Rating Date:* ${fmtDate(order.reviewRatingDate)}`);
    if (order.refundFormFilledDate) lines.push(`*Refund Form Filled:* ${fmtDate(order.refundFormFilledDate)}`);
    if (order.informedMediatorDate) lines.push(`*Mediator Informed:* ${fmtDate(order.informedMediatorDate)}`);
    if (order.paymentReceivedDate) {
      lines.push(`*Payment Received:* ${fmtDate(order.paymentReceivedDate)}`);
      if (order.paymentBank) lines.push(`*Payment Bank:* ${order.paymentBank}`);
    }

    if (order.isReplacement) {
      lines.push(``, `🔄 *Replacement Order*`);
      if (order.replacementOrderId) lines.push(`*New Order ID:* ${order.replacementOrderId}`);
    }

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Order details copied! Paste in WhatsApp');
  };

  const handleUpdate = async () => {
    // Show confirmation when archiving (payment_received)
    if (newStatus === 'payment_received' && !showArchiveConfirm) {
      setShowArchiveConfirm(true);
      return;
    }

    // Show confirmation when cancelling
    if (newStatus === 'order_cancelled' && !showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }

    const extras: Partial<Order> = {};

    if (newStatus === 'delivered') {
      extras.deliveredDate = deliveredDate;
      extras.returnPeriodDays = returnPeriodDays;
    }
    if (newStatus === 'review_rating_submitted') {
      extras.reviewRatingDate = reviewRatingDate;
    }
    if (newStatus === 'refund_form_filled') {
      extras.refundFormFilledDate = refundFormFilledDate;
    }
    if (newStatus === 'informed_mediator') {
      extras.informedMediatorDate = informedMediatorDate;
    }
    if (newStatus === 'payment_received') {
      extras.paymentReceivedDate = paymentReceivedDate;
      extras.paymentBank = paymentBank;
    }

    if (mediatorMessage !== (order.mediatorMessage || '')) extras.mediatorMessage = mediatorMessage;
    if (refundFormLink !== (order.refundFormLink || '')) extras.refundFormLink = refundFormLink.trim() || undefined;
    if (sellerLess !== order.sellerLess) extras.sellerLess = sellerLess;
    if (isReplacement !== order.isReplacement) extras.isReplacement = isReplacement;
    if (isReplacement) {
      if (replacementOrderId !== (order.replacementOrderId || '')) extras.replacementOrderId = replacementOrderId;
      const parsedAmt = parseFloat(replacementAmount);
      if (!isNaN(parsedAmt) && parsedAmt !== order.totalAmount) extras.totalAmount = parsedAmt;
    }

    await updateOrderStatus(order.id, newStatus, extras);
    toast.success(`Order updated to: ${STATUS_LABELS[newStatus]}`);
    onClose();
  };

  // Return period tracking
  const returnPeriodEnd = order.deliveredDate
    ? new Date(new Date(order.deliveredDate).getTime() + (order.returnPeriodDays || 7) * 24 * 60 * 60 * 1000)
    : null;
  const returnDaysLeft = returnPeriodEnd
    ? Math.ceil((returnPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const hasChanges =
    newStatus !== order.status ||
    mediatorMessage !== (order.mediatorMessage || '') ||
    refundFormLink !== (order.refundFormLink || '') ||
    sellerLess !== order.sellerLess ||
    isReplacement !== order.isReplacement ||
    (isReplacement && replacementOrderId !== (order.replacementOrderId || '')) ||
    (isReplacement && parseFloat(replacementAmount) !== order.totalAmount) ||
    (newStatus === 'delivered' && (deliveredDate !== (order.deliveredDate || today) || returnPeriodDays !== (order.returnPeriodDays || 7))) ||
    (newStatus === 'review_rating_submitted' && reviewRatingDate !== (order.reviewRatingDate || today)) ||
    (newStatus === 'refund_form_filled' && refundFormFilledDate !== (order.refundFormFilledDate || today)) ||
    (newStatus === 'informed_mediator' && informedMediatorDate !== (order.informedMediatorDate || today)) ||
    (newStatus === 'payment_received' && (paymentReceivedDate !== (order.paymentReceivedDate || today) || paymentBank !== (order.paymentBank || '')));

  const refundAmount = order.totalAmount - order.sellerLess;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-dashboard-card rounded-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-dashboard-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Update Order</h2>
            <p className="text-xs text-text-muted mt-0.5">Update the status of this order</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dashboard-bg text-text-secondary hover:text-text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── Full Order Details Card ── */}
          <div className="p-4 rounded-xl bg-dashboard-bg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Order ID</span>
              <span className="text-sm font-mono font-bold text-text-primary">{order.orderId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Product</span>
              <span className="text-sm text-text-primary truncate ml-4">{order.productName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Order Date</span>
              <span className="text-sm text-text-primary">{fmtDate(order.orderDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Amount</span>
              <span className="text-sm font-bold text-green-400">
                &#8377;{order.totalAmount.toLocaleString('en-IN')}
                {order.sellerLess > 0 && (
                  <span className="text-xs text-text-muted ml-1">(Less: &#8377;{order.sellerLess})</span>
                )}
              </span>
            </div>
            {order.sellerLess > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Refund Amount</span>
                <span className="text-sm font-bold text-emerald-400">&#8377;{refundAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Platform</span>
              <span className="text-sm text-text-primary capitalize">{order.platform}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Type</span>
              <span className="text-sm text-text-primary">{order.orderType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Mediator</span>
              <span className="text-sm text-text-primary">{order.mediatorName || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Reviewer</span>
              <span className="text-sm text-text-primary">{order.reviewerName}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-dashboard-border">
              <span className="text-xs text-text-muted">Current Status</span>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md text-white ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>

            {/* Copy + Telegram buttons */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleCopyDetails}
                className="flex-1 py-2 text-xs font-medium rounded-lg bg-dashboard-card border border-dashboard-border text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover transition flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy for WhatsApp
              </button>
              <a
                href={`https://t.me/orderflow_orders_bot?start=${order.orderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 text-xs font-medium rounded-lg bg-[#1a2535] border border-[#2d4a7a] text-[#5ba3e0] hover:bg-[#1e2e45] transition flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.973 13.89l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.945-.001.001-.001.001.341-.276z"/>
                </svg>
                Track on Telegram
              </a>
            </div>
          </div>

          {/* ── Status Date Tracking Pills ── */}
          {order.deliveredDate && (
            <div className={`p-3 rounded-xl border ${
              returnDaysLeft !== null && returnDaysLeft > 0
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <p className="text-xs text-text-secondary">
                Delivered: {fmtDate(order.deliveredDate)}
                {' · '}{order.returnPeriodDays || 7}d return
              </p>
              {returnPeriodEnd && (
                <p className={`text-xs font-bold mt-0.5 ${returnDaysLeft !== null && returnDaysLeft > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {returnDaysLeft !== null && returnDaysLeft > 0
                    ? `${returnDaysLeft} days left`
                    : 'Return period over'}
                </p>
              )}
            </div>
          )}

          {order.reviewRatingDate && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <p className="text-xs text-text-secondary">Review/Rating: <span className="font-semibold text-purple-400">{fmtDate(order.reviewRatingDate)}</span></p>
            </div>
          )}

          {order.refundFormFilledDate && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30">
              <p className="text-xs text-text-secondary">Refund form filled: <span className="font-semibold text-green-400">{fmtDate(order.refundFormFilledDate)}</span></p>
            </div>
          )}

          {order.informedMediatorDate && (
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30">
              <p className="text-xs text-text-secondary">Mediator informed: <span className="font-semibold text-teal-400">{fmtDate(order.informedMediatorDate)}</span></p>
            </div>
          )}

          {order.paymentReceivedDate && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-xs text-text-secondary">
                Payment received: <span className="font-semibold text-emerald-400">{fmtDate(order.paymentReceivedDate)}</span>
                {order.paymentBank && <span className="ml-2 text-emerald-400">via {order.paymentBank}</span>}
              </p>
            </div>
          )}

          {/* Seller Less */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Seller Less Amount</label>
            <input
              type="number"
              value={sellerLess}
              onChange={(e) => setSellerLess(Number(e.target.value) || 0)}
              min={0}
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none"
            />
          </div>

          {/* Replacement Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`relative w-10 h-5 rounded-full transition ${isReplacement ? 'bg-accent-blue' : 'bg-dashboard-border'}`}
                onClick={() => setIsReplacement(!isReplacement)}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isReplacement ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-semibold text-text-primary">Replacement Order</span>
            </label>
            {isReplacement && (
              <div className="mt-3 space-y-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div>
                  <label className="block text-xs text-text-muted mb-1">New Order ID</label>
                  <input type="text" value={replacementOrderId} onChange={(e) => setReplacementOrderId(e.target.value)} placeholder="Enter replacement order ID" className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">New Amount</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={replacementAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setReplacementAmount(v);
                    }}
                    placeholder="0"
                    className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mediator Message */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Mediator Message</label>
            <textarea
              value={mediatorMessage}
              onChange={(e) => setMediatorMessage(e.target.value)}
              placeholder="Paste the mediator message here..."
              rows={3}
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none resize-none"
            />
          </div>

          {/* Refund Form Link */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Refund Form Link</label>
            <input
              type="url"
              value={refundFormLink}
              onChange={(e) => setRefundFormLink(e.target.value)}
              placeholder="https://... (paste refund form link)"
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
            />
            {refundFormLink && (
              <a href={refundFormLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs text-green-400 hover:underline">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Refund Form
              </a>
            )}
          </div>

          {/* Status Update */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Update Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* ── Status-specific inputs ── */}

          {newStatus === 'delivered' && (
            <div className="space-y-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-xs font-semibold text-text-primary">Delivery Details</p>
              <div>
                <label className="block text-xs text-text-muted mb-1">Delivered Date</label>
                <input type="date" value={deliveredDate} onChange={(e) => setDeliveredDate(e.target.value)} max={today} className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Return Period (days)</label>
                <select value={returnPeriodDays} onChange={(e) => setReturnPeriodDays(parseInt(e.target.value))} className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none">
                  <option value={7}>7 days</option>
                  <option value={10}>10 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
              {deliveredDate && (
                <p className="text-[11px] text-text-muted">
                  Return ends: {new Date(new Date(deliveredDate).getTime() + returnPeriodDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          )}

          {newStatus === 'review_rating_submitted' && (
            <div className="space-y-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <p className="text-xs font-semibold text-text-primary">Review/Rating Date</p>
              <input type="date" value={reviewRatingDate} onChange={(e) => setReviewRatingDate(e.target.value)} max={today} className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none" />
            </div>
          )}

          {newStatus === 'refund_form_filled' && (
            <div className="space-y-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <p className="text-xs font-semibold text-text-primary">Refund Form Filled Date</p>
              <input type="date" value={refundFormFilledDate} onChange={(e) => setRefundFormFilledDate(e.target.value)} max={today} className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none" />
            </div>
          )}

          {newStatus === 'informed_mediator' && (
            <div className="space-y-3 p-4 rounded-xl bg-teal-500/10 border border-teal-500/30">
              <p className="text-xs font-semibold text-text-primary">Mediator Informed Date</p>
              <input type="date" value={informedMediatorDate} onChange={(e) => setInformedMediatorDate(e.target.value)} max={today} className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none" />
            </div>
          )}

          {newStatus === 'payment_received' && (
            <div className="space-y-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-xs font-semibold text-text-primary">Payment Details</p>
              <div>
                <label className="block text-xs text-text-muted mb-1">Payment Received Date</label>
                <input type="date" value={paymentReceivedDate} onChange={(e) => setPaymentReceivedDate(e.target.value)} max={today} className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Payment Bank</label>
                <input
                  type="text"
                  value={paymentBank}
                  onChange={(e) => setPaymentBank(e.target.value)}
                  placeholder="e.g. HDFC, Paytm, PhonePe..."
                  className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none"
                />
              </div>
              <p className="text-[11px] text-amber-400">This order will be moved to Archive.</p>
            </div>
          )}
        </div>

        {/* Archive Confirmation Dialog */}
        {showArchiveConfirm && (
          <div className="px-5 pb-3">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm font-semibold text-amber-400 mb-1">Confirm Archive</p>
              <p className="text-xs text-text-secondary mb-3">
                This will move the order to Archive. You won&apos;t see it on the dashboard anymore. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
                >
                  Yes, Archive Order
                </button>
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="px-4 py-2 bg-dashboard-bg text-text-primary text-sm font-medium rounded-lg hover:bg-dashboard-border transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Dialog */}
        {showCancelConfirm && (
          <div className="px-5 pb-3">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-sm font-semibold text-red-400 mb-1">Cancel Order?</p>
              <p className="text-xs text-text-secondary mb-3">
                This will cancel the order and move it to Archive under Cancelled Orders. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
                >
                  Yes, Cancel Order
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-4 py-2 bg-dashboard-bg text-text-primary text-sm font-medium rounded-lg hover:bg-dashboard-border transition"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={handleUpdate}
            disabled={!hasChanges}
            className="flex-1 py-2.5 bg-accent-blue text-white font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Order - {STATUS_LABELS[newStatus]}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-dashboard-bg text-text-primary font-medium rounded-lg hover:bg-dashboard-border transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
