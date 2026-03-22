'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useOrderStore } from '@/store/useOrderStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuth } from '@/hooks/useAuth';
import { OrderPlatform } from '@/types/order';
import ThemeToggle from '@/components/ThemeToggle';

const FORM_DRAFT_KEY = 'orderflow_form_draft';

export default function OrderFormPage() {
  const router = useRouter();
  const addOrder = useOrderStore((s) => s.addOrder);
  const settingsPlatforms = useSettingsStore((s) => s.platforms);
  const settingsMediators = useSettingsStore((s) => s.mediators);
  const settingsReviewers = useSettingsStore((s) => s.reviewers);
  const settingsOrderTypes = useSettingsStore((s) => s.orderTypes);
  const { user: authUser } = useAuth();

  const today = new Date().toISOString().split('T')[0];

  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    platform: '' as OrderPlatform | '',
    email: '',
    orderId: '',
    productName: '',
    orderDate: today,
    orderType: 'Rating',
    isExchange: false,
    exchangeProductName: '',
    totalAmount: '',
    sellerLess: '',
    mediatorName: '',
    mediatorNameCustom: '',
    reviewerName: '',
    reviewerNameCustom: '',
    isReplacement: false,
    replacementOrderId: '',
    mediatorMessage: '',
    confirmed: false,
  });

  const [draftRestored, setDraftRestored] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORM_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        // Merge saved draft into form (keep today's date if no saved date)
        setForm((prev) => ({ ...prev, ...draft, orderDate: draft.orderDate || prev.orderDate }));
        setDraftRestored(true);
        // Auto-hide the "draft restored" message after 3 seconds
        setTimeout(() => setDraftRestored(false), 3000);
      }
    } catch {
      // Ignore corrupt localStorage data
    }
  }, []);

  // Auto-save form to localStorage on every change (debounced 500ms)
  const saveFormDraft = useCallback((formData: typeof form) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        // Don't save the 'confirmed' checkbox state
        const { confirmed, ...dataToSave } = formData;
        localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(dataToSave));
      } catch {
        // Ignore storage errors
      }
    }, 500);
  }, []);

  // Watch form changes and auto-save
  useEffect(() => {
    saveFormDraft(form);
  }, [form, saveFormDraft]);

  // Clear draft from localStorage (called on successful submit or reset)
  const clearDraft = () => {
    try { localStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ }
  };

  // Auto-fill email from logged-in user
  useEffect(() => {
    if (authUser?.email && !form.email) {
      setForm((prev) => ({ ...prev, email: authUser.email }));
    }
  }, [authUser?.email]);

  // Extract refund form link from mediator message
  const extractRefundLink = (message: string): string | null => {
    const urlRegex = /(https?:\/\/[^\s]+refund[^\s]*)/i;
    const match = message.match(urlRegex);
    if (match) return match[1];
    const generalUrl = /(https?:\/\/[^\s]+)/i;
    const generalMatch = message.match(generalUrl);
    return generalMatch ? generalMatch[1] : null;
  };

  // Extract brand name from mediator message
  const extractBrandName = (message: string): string => {
    const brandPatterns = [
      /brand[:\s]+([^\n,]+)/i,
      /product[:\s]+([^\n,]+)/i,
    ];
    for (const pattern of brandPatterns) {
      const match = message.match(pattern);
      if (match) return match[1].trim();
    }
    return '';
  };

  const refundLink = form.mediatorMessage ? extractRefundLink(form.mediatorMessage) : null;
  const extractedBrand = form.mediatorMessage ? extractBrandName(form.mediatorMessage) : '';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else if (type === 'radio') {
      if (name === 'isReplacement' || name === 'isExchange') {
        setForm((prev) => ({ ...prev, [name]: value === 'yes' }));
      } else {
        setForm((prev) => ({ ...prev, [name]: value }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.platform || !form.email || !form.orderId || !form.orderDate) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!form.totalAmount) {
      toast.error('Please enter the total order amount');
      return;
    }
    if (!form.confirmed) {
      toast.error('Please confirm the details before submitting');
      return;
    }

    setSubmitting(true);
    await addOrder({
      orderId: form.orderId,
      platform: form.platform as OrderPlatform,
      email: form.email,
      brandName: extractedBrand,
      productName: form.productName || 'Custom Product',
      orderDate: form.orderDate,
      totalAmount: parseFloat(form.totalAmount),
      sellerLess: parseFloat(form.sellerLess) || 0,
      mediatorName: form.mediatorNameCustom || '',
      reviewerName: form.reviewerNameCustom || '',
      orderType: form.orderType,
      isReplacement: form.isReplacement,
      isExchange: form.isExchange,
      exchangeProductName: form.isExchange ? form.exchangeProductName : '',
      replacementOrderId: form.isReplacement ? form.replacementOrderId : '',
      mediatorMessage: form.mediatorMessage,
    });

    setSubmitting(false);
    setSubmitted(true);
    clearDraft();
  };

  const handleReset = () => {
    setForm({
      platform: '',
      email: '',
      orderId: '',
      productName: '',
      orderDate: today,
      orderType: 'Rating',
      isExchange: false,
      exchangeProductName: '',
      totalAmount: '',
      sellerLess: '',
      mediatorName: '',
      mediatorNameCustom: '',
      reviewerName: '',
      reviewerNameCustom: '',
      isReplacement: false,
      replacementOrderId: '',
      mediatorMessage: '',
      confirmed: false,
    });
    setSubmitted(false);
    clearDraft();
  };

  const inputClass = "w-full bg-form-input-bg border border-form-border rounded-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue focus:border-accent-blue outline-none transition";
  const labelClass = "block text-sm font-semibold text-form-label mb-1";

  return (
    <div className="min-h-screen bg-form-bg">
      {/* Header */}
      <header className="bg-form-header-bg shadow-sm border-b border-form-header-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="url(#logo-grad-form)" />
              <defs>
                <linearGradient id="logo-grad-form" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <path d="M13 16V14C13 10.134 16.134 7 20 7C23.866 7 27 10.134 27 14V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <rect x="10" y="16" width="20" height="17" rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
              <path d="M15 25L18 28L25 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-form-header-text font-semibold text-sm leading-tight">OrderFlow<br/><span className="font-normal text-xs opacity-70">E-commerce Order Manager</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-dashboard-card text-text-secondary text-sm font-medium rounded-full hover:bg-dashboard-card-hover hover:text-text-primary transition border border-dashboard-border"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {submitted ? (
          <div className="bg-form-card rounded-xl shadow-lg border border-form-border p-8 md:p-12 text-center animate-in fade-in duration-500">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Order submitted!</h2>
            <p className="text-text-muted mb-6">Your order has been recorded successfully.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-600 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                </svg>
                View Dashboard
              </Link>
              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-dashboard-card text-text-secondary font-semibold rounded-lg hover:bg-dashboard-card-hover hover:text-text-primary transition border border-dashboard-border"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Another Order
              </button>
            </div>
          </div>
        ) : (
        <div className="bg-form-card rounded-xl shadow-lg border border-form-border p-6 md:p-8">
          {/* Breadcrumb */}
          <p className="text-sm text-form-hint mb-2">OrderFlow / Order Form</p>

          <h1 className="text-2xl font-bold text-text-primary text-center mb-2">
            Order Form
          </h1>

          <div className="text-center mb-4">
            <p className="text-sm text-text-muted">
              Want to Track Orders?{' '}
              <Link href="/dashboard" className="text-form-link hover:underline">
                View Dashboard
              </Link>
            </p>
          </div>

          <p className="text-sm text-text-muted mb-2">
            Fields are auto filled based on previous form details.
          </p>
          <p className="text-sm text-accent-red font-medium mb-6">* Important</p>

          {/* Draft restored notification */}
          {draftRestored && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-green-500/10 border border-green-500/30 rounded-lg animate-in fade-in duration-300">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-500 font-medium">Draft restored! Your previous form data has been loaded.</p>
              <button type="button" onClick={() => setDraftRestored(false)} className="ml-auto text-green-500/70 hover:text-green-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Order Platform */}
            <div>
              <label className={labelClass}>
                Order Platform <span className="text-accent-red">*</span>
              </label>
              <select
                name="platform"
                value={form.platform}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    e.target.value = form.platform || '';
                    window.open('/account-settings?tab=dropdowns', '_blank');
                    return;
                  }
                  handleChange(e);
                }}
                required
                className={inputClass}
              >
                <option value="">Select Platform</option>
                {settingsPlatforms.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="__add_new__">+ Add New Platform</option>
              </select>
            </div>

            {/* 2. Email */}
            <div>
              <label className="block text-sm font-semibold text-form-link mb-1">
                Email <span className="text-accent-red">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                required
                className={inputClass}
              />
              <p className="text-xs text-form-hint mt-1">
                We&apos;ll never share your email with anyone else.
              </p>
            </div>

            {/* 3. Order ID */}
            <div>
              <label className={labelClass}>
                Order ID <span className="text-accent-red">*</span>
              </label>
              <input
                type="text"
                name="orderId"
                value={form.orderId}
                onChange={handleChange}
                placeholder="Copy and paste the ORDER ID directly to avoid errors."
                required
                className={inputClass}
              />
              <p className="text-xs text-form-hint mt-1">
                Please enter the exact order ID as shown on the order page.
              </p>
            </div>

            {/* 4. Product Name */}
            <div>
              <label className={labelClass}>Product Name</label>
              <input
                type="text"
                name="productName"
                value={form.productName}
                onChange={handleChange}
                placeholder="Enter product name"
                className={inputClass}
              />
            </div>

            {/* 4b. Order Date */}
            <div>
              <label className={labelClass}>
                Order Date <span className="text-accent-red">*</span>
              </label>
              <input
                type="date"
                name="orderDate"
                value={form.orderDate}
                onChange={handleChange}
                required
                max={today}
                className={inputClass}
              />
              <p className="text-xs text-form-hint mt-1">
                Defaults to today. Pick a past date if backfilling an older order.
              </p>
            </div>

            {/* 5. Order Type */}
            <div>
              <label className={`${labelClass} mb-2`}>
                Order Type <span className="text-accent-red">*</span>
              </label>
              <div className="flex flex-wrap gap-4">
                {(settingsOrderTypes.length > 0 ? settingsOrderTypes : ['Rating', 'Review']).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="orderType" value={type} checked={form.orderType === type} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                    <span className="text-text-primary">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 6. Exchange Deal */}
            <div>
              <label className={`${labelClass} mb-2`}>
                Exchange Deal? <span className="text-accent-red">*</span>
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="isExchange" value="yes" checked={form.isExchange === true} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                  <span className="text-text-primary">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="isExchange" value="no" checked={form.isExchange === false} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                  <span className="text-text-primary">No</span>
                </label>
              </div>
            </div>

            {/* 6a. Exchange Product Name (conditional) */}
            {form.isExchange && (
              <div>
                <label className={labelClass}>
                  Exchange product name that you will receive
                </label>
                <input
                  type="text"
                  name="exchangeProductName"
                  value={form.exchangeProductName}
                  onChange={handleChange}
                  placeholder="Enter exchange product name"
                  className={`${inputClass} bg-form-highlight-bg`}
                />
              </div>
            )}

            {/* 7. Total Order Amount */}
            <div>
              <label className={labelClass}>
                Total Order Amount <span className="text-accent-red">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-form-currency-bg border border-r-0 border-form-currency-border rounded-l-lg text-form-currency-text">
                  &#8377;
                </span>
                <input
                  type="number"
                  name="totalAmount"
                  value={form.totalAmount}
                  onChange={handleChange}
                  placeholder="Amount"
                  required
                  min="0"
                  className="flex-1 bg-form-input-bg border border-form-border rounded-r-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition"
                />
              </div>
              <p className="text-xs text-form-hint mt-1">
                Enter the exact total order amount from the order page.
              </p>
            </div>

            {/* 8. Seller's Less */}
            <div>
              <label className={labelClass}>
                Seller&apos;s Less <span className="text-accent-red">*</span>
              </label>
              <div className="flex min-w-0">
                <span className="inline-flex items-center px-3 bg-form-currency-bg border border-r-0 border-form-currency-border rounded-l-lg text-form-currency-text flex-shrink-0">
                  &#8377;
                </span>
                <input
                  type="number"
                  name="sellerLess"
                  value={form.sellerLess}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className="min-w-0 flex-1 bg-form-input-bg border border-form-border px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition"
                />
                <span className="inline-flex items-center px-2 bg-form-currency-bg border border-l-0 border-form-currency-border rounded-r-lg text-form-currency-text text-xs flex-shrink-0">
                  Less
                </span>
              </div>
              <p className="text-xs text-form-hint mt-1">
                Important: Please type the less. For FULL REFUND type
                &quot;0&quot;. Please do not make mistake here.
              </p>
            </div>

            {/* 9. Mediator Name */}
            <div>
              <label className={labelClass}>
                Mediator Name <span className="text-accent-red">*</span>
              </label>
              <input
                type="text"
                name="mediatorNameCustom"
                value={form.mediatorNameCustom}
                onChange={handleChange}
                placeholder="Type mediator name"
                className={inputClass}
              />
            </div>

            {/* 10. Reviewer Name */}
            <div>
              <label className={labelClass}>
                Reviewer Name <span className="text-accent-red">*</span>
              </label>
              <input
                type="text"
                name="reviewerNameCustom"
                value={form.reviewerNameCustom}
                onChange={handleChange}
                placeholder="Type reviewer name"
                className={inputClass}
              />
            </div>

            {/* 11. Replacement Order */}
            <div>
              <label className={`${labelClass} mb-2`}>
                Replacement Order? <span className="text-accent-red">*</span>
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="isReplacement" value="yes" checked={form.isReplacement === true} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                  <span className="text-text-primary">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="isReplacement" value="no" checked={form.isReplacement === false} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                  <span className="text-text-primary">No</span>
                </label>
              </div>
            </div>

            {/* 11a. Replacement Order ID (conditional) */}
            {form.isReplacement && (
              <div>
                <label className={labelClass}>New Replacement Order ID</label>
                <input
                  type="text"
                  name="replacementOrderId"
                  value={form.replacementOrderId}
                  onChange={handleChange}
                  placeholder="Enter new replacement order ID"
                  className={`${inputClass} bg-form-highlight-bg`}
                />
              </div>
            )}

            {/* 12. Mediator Message */}
            <div>
              <label className={labelClass}>Mediator Message</label>
              <textarea
                name="mediatorMessage"
                value={form.mediatorMessage}
                onChange={handleChange}
                placeholder="Paste the whole mediator given message below. We will fetch the refund form link and you can fill the refund form from dashboard."
                rows={4}
                className={`${inputClass} resize-none`}
              />
              <p className="text-xs text-form-hint mt-1">
                Paste the full mediator message to auto-extract refund form link and brand name.
              </p>
              {refundLink && (
                <div className="mt-2 p-3 bg-form-success-bg border border-form-success-border rounded-lg">
                  <p className="text-xs font-semibold text-form-success-text mb-1">Refund Form Link Found:</p>
                  <a
                    href={refundLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-form-link hover:underline break-all"
                  >
                    {refundLink}
                  </a>
                </div>
              )}
              {extractedBrand && (
                <div className="mt-2 p-2 bg-form-info-bg border border-form-info-border rounded-lg">
                  <p className="text-xs text-form-info-text">
                    <span className="font-semibold">Brand detected:</span> {extractedBrand}
                  </p>
                </div>
              )}
            </div>

            {/* 15. Confirmation */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-form-confirm-bg border border-form-confirm-border">
              <input
                type="checkbox"
                name="confirmed"
                checked={form.confirmed}
                onChange={handleChange}
                className="w-4 h-4 mt-0.5 text-accent-blue rounded"
              />
              <label className="text-sm text-form-confirm-text">
                I confirm that all the details provided by me are correct.
              </label>
            </div>

            {/* 16. Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-accent-blue/20 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit form'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3 bg-accent-red text-white font-semibold rounded-lg hover:bg-red-600 active:scale-[0.98] transition-all"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        )}

        {/* Footer */}
        <p className="text-center text-xs text-text-muted mt-6">
          2026 &copy; OrderFlow
        </p>
      </div>
    </div>
  );
}
