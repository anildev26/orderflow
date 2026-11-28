'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Order, OrderPlatform, ORDER_TYPES, SellerLessMode, computeSellerLess, parseCommissionAmount } from '@/types/order';
import { useOrderStore } from '@/store/useOrderStore';
import { usePlatformStore } from '@/store/usePlatformStore';
import { useMediatorStore } from '@/store/useMediatorStore';
import { MediatorFields, mediatorFieldsFromOrder, type MediatorFieldValue } from '@/components/MediatorFields';
import { ReviewerFields, type ReviewerFieldValue } from '@/components/ReviewerFields';
import { commitMediatorDraft } from '@/lib/commitMediator';
import { commitReviewerDraft } from '@/lib/commitReviewer';
import { useReviewerStore } from '@/store/useReviewerStore';

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
  /** Called after a successful save, so the window underneath can pick up the new values. */
  onSaved?: () => void;
}

export default function EditOrderModal({ order, onClose, onSaved }: EditOrderModalProps) {
  const editOrder = useOrderStore((s) => s.editOrder);
  const platforms = usePlatformStore((s) => s.platforms);
  const fetchPlatforms = usePlatformStore((s) => s.fetchPlatforms);
  useEffect(() => { void fetchPlatforms(); }, [fetchPlatforms]);
  // Always offer the order's own platform, even if it is not in the list (yet).
  const platformOptions = platforms.some((p) => p.value === order.platform)
    ? platforms
    : [...platforms, { id: 'current', value: order.platform, label: order.platform.charAt(0).toUpperCase() + order.platform.slice(1), active: true, sortOrder: 999 }];
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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
  });
  const [sellerLessMode, setSellerLessMode] = useState<SellerLessMode>(order.sellerLessPercent != null ? 'less_percent' : 'inr');
  const [sellerLessPercentInput, setSellerLessPercentInput] = useState(order.sellerLessPercent != null ? String(order.sellerLessPercent) : '');
  const mediators = useMediatorStore((s) => s.mediators);
  const addMediator = useMediatorStore((s) => s.addMediator);
  const reviewers = useReviewerStore((s) => s.reviewers);
  const addReviewer = useReviewerStore((s) => s.addReviewer);
  const [mediator, setMediator] = useState<MediatorFieldValue>(() => mediatorFieldsFromOrder(order, false));
  const [reviewer, setReviewer] = useState<ReviewerFieldValue>({
    name: order.reviewerName || '',
    reviewerId: null,
    saveToList: false,
  });
  const [isCommission, setIsCommission] = useState(order.commissionAmount != null);
  const [commissionInput, setCommissionInput] = useState(order.commissionAmount != null ? String(order.commissionAmount) : '');

  // Everything the user can change, as one string, to tell whether anything was edited.
  const snapshot = JSON.stringify([form, sellerLessMode, sellerLessPercentInput, isCommission, commissionInput, mediator.name, mediator.phoneInput, mediator.mediatorId, mediator.saveToList, reviewer.name, reviewer.reviewerId, reviewer.saveToList]);
  const [initialSnapshot] = useState(snapshot);
  const dirty = snapshot !== initialSnapshot;
  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

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
    if (saving) return;
    const newOrderId = form.orderId.trim();
    if (!form.platform || !newOrderId || !form.orderDate) {
      toast.error('Platform, Order ID and Date are required');
      return;
    }
    const clash = useOrderStore.getState().orders.find((o) => o.id !== order.id && o.orderId.trim().toLowerCase() === newOrderId.toLowerCase());
    if (clash) {
      toast.error(`You already have an order with ID ${clash.orderId}. Check the ID and try again.`);
      return;
    }
    const totalAmount = parseFloat(form.totalAmount);
    if (isNaN(totalAmount)) {
      toast.error('Enter a valid total amount');
      return;
    }
    const commissionAmount = isCommission ? parseCommissionAmount(commissionInput) : null;
    if (isCommission && commissionAmount == null) {
      toast.error('Please enter the commission amount');
      return;
    }
    const { sellerLess, sellerLessPercent } = isCommission
      ? { sellerLess: 0, sellerLessPercent: null }
      : computeSellerLess(
          sellerLessMode,
          parseFloat(form.sellerLess) || 0,
          parseFloat(sellerLessPercentInput) || 0,
          totalAmount
        );
    setSaving(true);
    let savedMediator;
    try {
      savedMediator = await commitMediatorDraft({
        name: mediator.name,
        phoneInput: mediator.phoneInput,
        saveToList: mediator.saveToList,
        pickedId: mediator.mediatorId,
        list: mediators,
        create: addMediator,
      });
    } catch (err) {
      setSaving(false);
      toast.error(err instanceof Error ? err.message : 'Check the mediator number');
      return;
    }
    let savedReviewer;
    try {
      savedReviewer = await commitReviewerDraft({
        name: reviewer.name,
        saveToList: reviewer.saveToList,
        pickedId: reviewer.reviewerId,
        list: reviewers,
        create: addReviewer,
      });
    } catch (err) {
      setSaving(false);
      toast.error(err instanceof Error ? err.message : 'Could not save the reviewer');
      return;
    }
    try {
      await editOrder(order.id, {
        platform: form.platform as OrderPlatform,
        orderId: newOrderId,
        productName: form.productName,
        orderDate: form.orderDate,
        orderType: form.orderType,
        totalAmount,
        sellerLess,
        sellerLessPercent,
        commissionAmount,
        mediatorName: savedMediator.name,
        mediatorId: savedMediator.mediatorId,
        mediatorPhone: savedMediator.mediatorPhone,
        reviewerName: savedReviewer.name,
      });
      toast.success('Order updated!');
      setSaving(false);
      onSaved?.();
      onClose();
    } catch (err) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : '';
      toast.error(/duplicate|unique/i.test(msg) ? 'You already have an order with this ID.' : msg ? `Failed to save changes: ${msg}` : 'Failed to save changes');
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

  const commissionHint = (() => {
    const totalAmt = parseFloat(form.totalAmount);
    const commission = parseCommissionAmount(commissionInput);
    if (!Number.isFinite(totalAmt) || commission == null) {
      return 'Flat ₹ the mediator pays on top of the order amount. No percentage.';
    }
    const payout = totalAmt + commission;
    return `You'll get ₹${payout.toLocaleString('en-IN')} — order ₹${totalAmt.toLocaleString('en-IN')} plus ₹${commission.toLocaleString('en-IN')} commission.`;
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={requestClose}>
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
          <button onClick={requestClose} aria-label="Close" className="p-1 rounded-lg hover:bg-dashboard-bg text-text-secondary hover:text-text-primary">
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
              {platformOptions.map((p) => (
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

          {/* Seller's Less (default) or a flat commission. Either one, never both. */}
          <div>
            {isCommission ? (
              <>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Commission (₹)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={commissionInput}
                  onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setCommissionInput(e.target.value); }}
                  placeholder="0"
                  className={ic}
                />
                <p className="text-[11px] text-text-muted mt-1">{commissionHint}</p>
                <button type="button" onClick={() => setIsCommission(false)} className="mt-1.5 text-xs font-medium text-accent-blue hover:underline">
                  Use seller&apos;s less instead
                </button>
              </>
            ) : (
              <>
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
                <button type="button" onClick={() => setIsCommission(true)} className="mt-1.5 text-xs font-medium text-accent-blue hover:underline">
                  Commission deal instead?
                </button>
              </>
            )}
          </div>

          <MediatorFields tone="dashboard" value={mediator} onChange={setMediator} idPrefix="edit-mediator" />

          <ReviewerFields tone="dashboard" value={reviewer} onChange={setReviewer} idPrefix="edit-reviewer" />

        </div>

        {/* Footer */}
        <div className="px-5 pb-5 sticky bottom-0 bg-dashboard-card pt-2 border-t border-dashboard-border">
        {confirmDiscard && (
          <div role="alert" className="mb-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm font-semibold text-text-primary">Discard your changes?</p>
            <p className="text-xs text-text-secondary mt-0.5">The details you edited are not saved yet.</p>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium bg-dashboard-bg text-text-primary border border-dashboard-border">Discard</button>
              <button type="button" onClick={() => setConfirmDiscard(false)} className="flex-1 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white">Keep editing</button>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-accent-blue text-white font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={requestClose} disabled={saving} className="px-5 py-2.5 bg-dashboard-bg text-text-primary font-medium rounded-lg hover:bg-dashboard-border transition disabled:opacity-50">
            Cancel
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
