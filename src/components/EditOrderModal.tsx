'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Order, OrderPlatform, ORDER_TYPES, SellerLessMode, computeSellerLess } from '@/types/order';
import { useOrderStore } from '@/store/useOrderStore';
import { usePlatformStore } from '@/store/usePlatformStore';

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
}

export default function EditOrderModal({ order, onClose }: EditOrderModalProps) {
  const editOrder = useOrderStore((s) => s.editOrder);
  const platforms = usePlatformStore((s) => s.platforms);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    platform: order.platform as string,
    orderId: order.orderId,
    productName: order.productName,
    orderDate: order.orderDate,
    orderType: order.orderType,
    totalAmount: String(order.totalAmount),
    sellerLess: String(order.sellerLess),
    mediatorName: order.mediatorName,
    reviewerName: order.reviewerName,
  });
  const [sellerLessMode, setSellerLessMode] = useState<SellerLessMode>(order.sellerLessPercent != null ? 'less_percent' : 'inr');
  const [sellerLessPercentInput, setSellerLessPercentInput] = useState(order.sellerLessPercent != null ? String(order.sellerLessPercent) : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!form.platform || !form.orderId || !form.orderDate) {
      toast.error('Platform, Order ID and Date are required');
      return;
    }
    const totalAmount = parseFloat(form.totalAmount);
    if (isNaN(totalAmount)) {
      toast.error('Enter a valid total amount');
      return;
    }
    const { sellerLess, sellerLessPercent } = computeSellerLess(
      sellerLessMode,
      parseFloat(form.sellerLess) || 0,
      parseFloat(sellerLessPercentInput) || 0,
      totalAmount
    );
    setSaving(true);
    try {
      await editOrder(order.id, {
        platform: form.platform as OrderPlatform,
        orderId: form.orderId,
        productName: form.productName,
        orderDate: form.orderDate,
        orderType: form.orderType,
        totalAmount,
        sellerLess,
        sellerLessPercent,
        mediatorName: form.mediatorName,
        reviewerName: form.reviewerName,
      });
      toast.success('Order updated!');
      onClose();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const ic = "w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none transition";

  const sellerLessHint = (() => {
    if (sellerLessMode === 'inr' || !sellerLessPercentInput || !form.totalAmount) return null;
    const totalAmt = parseFloat(form.totalAmount) || 0;
    const { sellerLess, sellerLessPercent } = computeSellerLess(sellerLessMode, 0, parseFloat(sellerLessPercentInput) || 0, totalAmt);
    const lessPct = sellerLessPercent ?? 0;
    const refundAmt = totalAmt - sellerLess;
    return `Less ${lessPct}% = ₹${sellerLess.toLocaleString('en-IN')} deducted → Refund ${100 - lessPct}% = ₹${refundAmt.toLocaleString('en-IN')} you'll get`;
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-dashboard-card rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-dashboard-border sticky top-0 bg-dashboard-card z-10">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Edit Order</h2>
            <p className="text-xs text-text-muted mt-0.5">Correct order details</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dashboard-bg text-text-secondary hover:text-text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Platform */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Platform</label>
            <select name="platform" value={form.platform} onChange={handleChange} className={ic}>
              {platforms.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Order ID */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Order ID</label>
            <input type="text" name="orderId" value={form.orderId} onChange={handleChange} maxLength={100} className={ic} />
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Product Name</label>
            <input type="text" name="productName" value={form.productName} onChange={handleChange} maxLength={300} className={ic} />
          </div>

          {/* Order Date */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Order Date</label>
            <input type="date" name="orderDate" value={form.orderDate} onChange={handleChange} className={ic} />
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Order Type</label>
            <div className="space-y-2">
              {ORDER_TYPES.map((t) => (
                <label
                  key={t}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                    form.orderType === t
                      ? 'bg-accent-blue/10 border-accent-blue/50'
                      : 'bg-dashboard-bg border-dashboard-border hover:border-accent-blue/30'
                  }`}
                >
                  <span className={`text-sm font-medium ${form.orderType === t ? 'text-accent-blue' : 'text-text-primary'}`}>{t}</span>
                  <input
                    type="radio"
                    name="orderType"
                    value={t}
                    checked={form.orderType === t}
                    onChange={handleChange}
                    className="w-4 h-4 text-accent-blue"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Total Amount */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Total Amount (₹)</label>
            <input
              type="text"
              inputMode="decimal"
              name="totalAmount"
              value={form.totalAmount}
              onChange={handleAmountChange}
              placeholder="0"
              className={ic}
            />
          </div>

          {/* Seller Less */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Seller Less</label>
            <div className="inline-flex flex-wrap gap-1 p-1 mb-1.5 bg-dashboard-bg border border-dashboard-border rounded-lg">
              {([
                { key: 'inr', label: '₹ Amount' },
                { key: 'refund_percent', label: 'Refund %' },
                { key: 'less_percent', label: 'Less %' },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSellerLessMode(opt.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    sellerLessMode === opt.key ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {sellerLessMode === 'inr' ? (
              <input
                type="text"
                inputMode="decimal"
                name="sellerLess"
                value={form.sellerLess}
                onChange={handleAmountChange}
                placeholder="0"
                className={ic}
              />
            ) : (
              <input
                type="text"
                inputMode="decimal"
                value={sellerLessPercentInput}
                onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setSellerLessPercentInput(e.target.value); }}
                placeholder="0"
                className={ic}
              />
            )}
            {sellerLessHint && <p className="text-[11px] text-text-muted mt-1">{sellerLessHint}</p>}
          </div>

          {/* Mediator Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Mediator Name</label>
            <input type="text" name="mediatorName" value={form.mediatorName} onChange={handleChange} maxLength={100} className={ic} />
          </div>

          {/* Reviewer Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Reviewer Name</label>
            <input type="text" name="reviewerName" value={form.reviewerName} onChange={handleChange} maxLength={100} className={ic} />
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3 sticky bottom-0 bg-dashboard-card pt-2 border-t border-dashboard-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-accent-blue text-white font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-dashboard-bg text-text-primary font-medium rounded-lg hover:bg-dashboard-border transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
