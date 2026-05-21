'use client';

import { DemoOrder } from '@/store/useDemoOrderStore';
import { STATUS_LABELS, STATUS_COLORS, STATUS_OPTIONS } from '@/types/order';
import Link from 'next/link';

function fmtDate(d?: string) {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

function DisabledField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative group">
      <div className="pointer-events-none opacity-60">{children}</div>
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center px-2 py-1 bg-dashboard-bg border border-dashboard-border rounded-lg text-[10px] text-text-secondary whitespace-nowrap z-10 shadow">
        {label}
      </div>
    </div>
  );
}

interface DemoOrderModalProps {
  order: DemoOrder;
  onClose: () => void;
  /** When true, no dark backdrop is rendered (tour provides its own overlay) */
  tourMode?: boolean;
}

export default function DemoOrderModal({ order, onClose, tourMode = false }: DemoOrderModalProps) {
  const refundAmount = order.totalAmount - order.sellerLess;

  const card = (
    <div
      data-tour="mediator-message"
      className="bg-dashboard-card rounded-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-dashboard-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Update Order</h2>
          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Demo — actions disabled
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-dashboard-bg text-text-secondary hover:text-text-primary"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Order details card */}
        <div className="p-4 rounded-xl bg-dashboard-bg space-y-3">
          <span className="text-xs font-semibold text-text-secondary">Order Details</span>
          {[
            { label: 'Order ID', value: <span className="font-mono font-bold text-text-primary">{order.orderId}</span> },
            { label: 'Product', value: order.productName },
            { label: 'Platform', value: <span className="capitalize">{order.platform}</span> },
            { label: 'Order Date', value: fmtDate(order.orderDate) },
            { label: 'Amount', value: <span className="font-bold text-green-400">₹{order.totalAmount.toLocaleString('en-IN')}{order.sellerLess > 0 && <span className="text-xs text-text-muted ml-1">(Less: ₹{order.sellerLess})</span>}</span> },
            ...(order.sellerLess > 0 ? [{ label: 'Refund Amount', value: <span className="font-bold text-emerald-400">₹{refundAmount.toLocaleString('en-IN')}</span> }] : []),
            { label: 'Mediator', value: order.mediatorName || '-' },
            { label: 'Reviewer', value: order.reviewerName || '-' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{row.label}</span>
              <span className="text-sm text-text-primary">{row.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-dashboard-border">
            <span className="text-xs text-text-muted">Current Status</span>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md text-white ${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'bg-gray-500'}`}>
              {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] || order.status}
            </span>
          </div>

          {/* Copy for WhatsApp + Telegram */}
          <div className="flex gap-2 mt-1">
            <DisabledField label="Sign up to copy for WhatsApp">
              <button className="flex-1 py-2 text-xs font-medium rounded-lg bg-dashboard-card border border-dashboard-border text-text-secondary flex items-center justify-center gap-2 cursor-not-allowed">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy for WhatsApp
              </button>
            </DisabledField>
            <DisabledField label="Sign up to track on Telegram">
              <div className="flex-1 py-2 text-xs font-medium rounded-lg bg-[#1a2535] border border-[#2d4a7a] text-[#5ba3e0] flex items-center justify-center gap-2 cursor-not-allowed">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.973 13.89l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.945-.001.001-.001.001.341-.276z" />
                </svg>
                Track on Telegram
              </div>
            </DisabledField>
          </div>
        </div>

        {/* Replacement toggle */}
        <DisabledField label="Sign up to mark replacement orders">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-5 rounded-full bg-dashboard-border cursor-not-allowed">
              <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white translate-x-0.5" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Replacement Order</span>
          </div>
        </DisabledField>

        {/* Mediator message */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Mediator Message</label>
          <textarea
            readOnly
            value={order.mediatorMessage}
            rows={3}
            className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none resize-none opacity-80 cursor-default"
          />
        </div>

        {/* Refund form link */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Refund Form Link</label>
          <input
            readOnly
            value={order.refundFormLink || 'https://forms.gle/demo-refund-link'}
            className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none opacity-80 cursor-default"
          />
        </div>

        {/* Status dropdown */}
        <DisabledField label="Sign up to update order status">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Update Status</label>
            <select
              disabled
              value={order.status}
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none cursor-not-allowed"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </DisabledField>
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 flex gap-3">
        <DisabledField label="Sign up to update orders">
          <button
            disabled
            className="flex-1 py-2.5 bg-accent-blue text-white font-medium rounded-lg opacity-40 cursor-not-allowed"
          >
            Update Order
          </button>
        </DisabledField>
        <Link
          href="/signup"
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-violet-600 transition whitespace-nowrap"
        >
          Sign up free →
        </Link>
      </div>
    </div>
  );

  if (tourMode) {
    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto">{card}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      {card}
    </div>
  );
}
