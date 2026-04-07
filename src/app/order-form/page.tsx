'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useOrderStore } from '@/store/useOrderStore';
import { useSettingsStore, ALL_PLATFORMS } from '@/store/useSettingsStore';
import { useAuth } from '@/hooks/useAuth';
import { OrderPlatform } from '@/types/order';
import ThemeToggle from '@/components/ThemeToggle';

const ORDER_TYPES = ['Rating', 'Review', 'Empty Box'];

export default function OrderFormPage() {
  const addOrder = useOrderStore((s) => s.addOrder);
  const settingsPlatforms = useSettingsStore((s) => s.platforms);
  const savePlatforms = useSettingsStore((s) => s.savePlatforms);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const { user: authUser } = useAuth();

  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

  const [submitted, setSubmitted] = useState(false);
  const [managePlatformsOpen, setManagePlatformsOpen] = useState(false);
  const [platformDraft, setPlatformDraft] = useState<string[]>([]);

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
    mediatorNameCustom: '',
    reviewerNameCustom: '',
    isReplacement: false,
    replacementOrderId: '',
    mediatorMessage: '',
    confirmed: false,
  });

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill only registered email
  useEffect(() => {
    if (authUser?.email && !form.email) {
      setForm((prev) => ({ ...prev, email: authUser.email }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.email]);

  // Extract refund form link from mediator message
  const extractRefundLink = (message: string): string | null => {
    // Try to find a URL with "refund" or "form" in it
    const refundUrl = message.match(/(https?:\/\/[^\s]*(?:refund|form)[^\s]*)/i);
    if (refundUrl) return refundUrl[1];
    // Fall back to any URL
    const anyUrl = message.match(/(https?:\/\/[^\s]+)/i);
    return anyUrl ? anyUrl[1] : null;
  };

  const refundLink = form.mediatorMessage ? extractRefundLink(form.mediatorMessage) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
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
    try {
      await addOrder({
        orderId: form.orderId,
        platform: form.platform as OrderPlatform,
        email: form.email,
        brandName: '',
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
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit order');
    }
    setSubmitting(false);
  };

  const handleReset = () => {
    const email = authUser?.email ?? '';
    setForm({
      platform: '',
      email,
      orderId: '',
      productName: '',
      orderDate: today,
      orderType: 'Rating',
      isExchange: false,
      exchangeProductName: '',
      totalAmount: '',
      sellerLess: '',
      mediatorNameCustom: '',
      reviewerNameCustom: '',
      isReplacement: false,
      replacementOrderId: '',
      mediatorMessage: '',
      confirmed: false,
    });
    setSubmitted(false);
  };

  const openManagePlatforms = () => {
    setPlatformDraft(settingsPlatforms.map((p) => p.value));
    setManagePlatformsOpen(true);
  };

  const saveManagedPlatforms = async () => {
    const selected = ALL_PLATFORMS.filter((p) => platformDraft.includes(p.value));
    await savePlatforms(selected.length > 0 ? selected : ALL_PLATFORMS);
    setManagePlatformsOpen(false);
  };

  const inputClass = "w-full bg-form-input-bg border border-form-border rounded-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue focus:border-accent-blue outline-none transition";
  const labelClass = "block text-sm font-semibold text-form-label mb-1";

  return (
    <div className="min-h-screen bg-form-bg">
      {/* Header */}
      <header className="bg-form-header-bg shadow-sm border-b border-form-header-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#logo-grad-form)" />
              <defs>
                <linearGradient id="logo-grad-form" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <path d="M13 16V14C13 10.134 16.134 7 20 7C23.866 7 27 10.134 27 14V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <rect x="10" y="16" width="20" height="17" rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
              <path d="M15 25L18 28L25 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-form-header-text font-semibold text-sm leading-tight">OrderFlow<br /><span className="font-normal text-xs opacity-70">E-commerce Order Manager</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-dashboard-card text-text-secondary text-sm font-medium rounded-full hover:bg-dashboard-card-hover hover:text-text-primary transition border border-dashboard-border">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Manage Platforms modal */}
      {managePlatformsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setManagePlatformsOpen(false)} />
          <div className="relative bg-dashboard-card border border-dashboard-border rounded-2xl p-5 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-text-primary mb-1">Manage Platforms</h3>
            <p className="text-xs text-text-muted mb-4">Select which platforms appear in the order form.</p>
            <div className="space-y-2 mb-5">
              {ALL_PLATFORMS.map((p) => (
                <label key={p.value} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-dashboard-bg transition">
                  <input
                    type="checkbox"
                    checked={platformDraft.includes(p.value)}
                    onChange={(e) => {
                      setPlatformDraft((prev) =>
                        e.target.checked ? [...prev, p.value] : prev.filter((v) => v !== p.value)
                      );
                    }}
                    className="w-4 h-4 rounded text-accent-blue"
                  />
                  <span className="text-sm text-text-primary">{p.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setManagePlatformsOpen(false)} className="flex-1 py-2 text-sm text-text-muted hover:text-text-primary border border-dashboard-border rounded-lg transition">Cancel</button>
              <button onClick={saveManagedPlatforms} className="flex-1 py-2 text-sm bg-accent-blue text-white rounded-lg hover:bg-blue-600 transition">Save</button>
            </div>
          </div>
        </div>
      )}

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
              <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-600 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                </svg>
                View Dashboard
              </Link>
              <button onClick={handleReset} className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-dashboard-card text-text-secondary font-semibold rounded-lg hover:bg-dashboard-card-hover hover:text-text-primary transition border border-dashboard-border">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Another Order
              </button>
            </div>
            {/* Telegram Bot CTA */}
            <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a2535] border border-[#2d4a7a]">
              <svg className="w-5 h-5 flex-shrink-0 text-[#5ba3e0]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.973 13.89l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.945-.001.001-.001.001.341-.276z"/>
              </svg>
              <div className="text-left min-w-0">
                <p className="text-xs font-semibold text-[#8ab4d4]">Track this order on Telegram</p>
                <p className="text-[11px] text-[#4a6a8a] mt-0.5">Send your Order ID to our bot for instant details anytime.</p>
              </div>
              <a href={`https://t.me/orderflow_orders_bot?start=${form.orderId}`} target="_blank" rel="noopener noreferrer" className="ml-auto flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#5ba3e0] text-white hover:bg-[#4a92cf] transition">
                Open Bot
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-form-card rounded-xl shadow-lg border border-form-border p-6 md:p-8">
            <p className="text-sm text-form-hint mb-2">OrderFlow / Order Form</p>
            <h1 className="text-2xl font-bold text-text-primary text-center mb-2">Order Form</h1>
            <div className="text-center mb-6">
              <p className="text-sm text-text-muted">
                Want to track orders?{' '}
                <Link href="/dashboard" className="text-form-link hover:underline">View Dashboard</Link>
              </p>
            </div>
            <p className="text-sm text-accent-red font-medium mb-6">* Important fields are required</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. Platform */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>
                    Order Platform <span className="text-accent-red">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={openManagePlatforms}
                    className="text-xs text-accent-blue hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Manage
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settingsPlatforms.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, platform: opt.value as OrderPlatform }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                        form.platform === opt.value
                          ? 'bg-accent-blue text-white border-accent-blue'
                          : 'bg-form-input-bg border-form-border text-form-text hover:border-accent-blue/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {!form.platform && (
                  <p className="text-xs text-form-hint mt-1.5">Select the platform this order is from.</p>
                )}
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
                <p className="text-xs text-form-hint mt-1">Your registered email is auto-filled.</p>
              </div>

              {/* 3. Order ID */}
              <div>
                <label className={labelClass}>Order ID <span className="text-accent-red">*</span></label>
                <input type="text" name="orderId" value={form.orderId} onChange={handleChange} maxLength={100} placeholder="Copy and paste the ORDER ID directly to avoid errors." required className={inputClass} />
                <p className="text-xs text-form-hint mt-1">Enter the exact order ID as shown on the order page.</p>
              </div>

              {/* 4. Product Name */}
              <div>
                <label className={labelClass}>Product Name</label>
                <input type="text" name="productName" value={form.productName} onChange={handleChange} maxLength={300} placeholder="Enter product name" className={inputClass} />
              </div>

              {/* 5. Order Date */}
              <div>
                <label className={labelClass}>Order Date <span className="text-accent-red">*</span></label>
                <input type="date" name="orderDate" value={form.orderDate} onChange={handleChange} required max={today} className={inputClass} />
                <p className="text-xs text-form-hint mt-1">Defaults to today. Pick a past date if backfilling an older order.</p>
              </div>

              {/* 6. Order Type — checkbox style (single select) */}
              <div>
                <label className={`${labelClass} mb-2`}>Order Type <span className="text-accent-red">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {ORDER_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, orderType: type }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition flex items-center gap-1.5 ${
                        form.orderType === type
                          ? 'bg-accent-blue text-white border-accent-blue'
                          : 'bg-form-input-bg border-form-border text-form-text hover:border-accent-blue/60'
                      }`}
                    >
                      {form.orderType === type && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 7. Exchange Deal */}
              <div>
                <label className={`${labelClass} mb-2`}>Exchange Deal? <span className="text-accent-red">*</span></label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="isExchange" value="yes" checked={form.isExchange} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                    <span className="text-text-primary">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="isExchange" value="no" checked={!form.isExchange} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                    <span className="text-text-primary">No</span>
                  </label>
                </div>
              </div>

              {form.isExchange && (
                <div>
                  <label className={labelClass}>Exchange product name that you will receive</label>
                  <input type="text" name="exchangeProductName" value={form.exchangeProductName} onChange={handleChange} placeholder="Enter exchange product name" className={`${inputClass} bg-form-highlight-bg`} />
                </div>
              )}

              {/* 8. Total Amount */}
              <div>
                <label className={labelClass}>Total Order Amount <span className="text-accent-red">*</span></label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-form-currency-bg border border-r-0 border-form-currency-border rounded-l-lg text-form-currency-text">&#8377;</span>
                  <input type="number" name="totalAmount" value={form.totalAmount} onChange={handleChange} placeholder="Amount" required min="0" className="flex-1 bg-form-input-bg border border-form-border rounded-r-lg px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition" />
                </div>
                <p className="text-xs text-form-hint mt-1">Enter the exact total order amount from the order page.</p>
              </div>

              {/* 9. Seller Less */}
              <div>
                <label className={labelClass}>Seller&apos;s Less <span className="text-accent-red">*</span></label>
                <div className="flex min-w-0">
                  <span className="inline-flex items-center px-3 bg-form-currency-bg border border-r-0 border-form-currency-border rounded-l-lg text-form-currency-text flex-shrink-0">&#8377;</span>
                  <input type="number" name="sellerLess" value={form.sellerLess} onChange={handleChange} placeholder="0" min="0" className="min-w-0 flex-1 bg-form-input-bg border border-form-border px-4 py-2.5 text-form-text placeholder-form-placeholder focus:ring-2 focus:ring-accent-blue outline-none transition" />
                  <span className="inline-flex items-center px-2 bg-form-currency-bg border border-l-0 border-form-currency-border rounded-r-lg text-form-currency-text text-xs flex-shrink-0">Less</span>
                </div>
                <p className="text-xs text-form-hint mt-1">For FULL REFUND type &quot;0&quot;. Do not make a mistake here.</p>
              </div>

              {/* 10. Mediator Name */}
              <div>
                <label className={labelClass}>Mediator Name <span className="text-accent-red">*</span></label>
                <input type="text" name="mediatorNameCustom" value={form.mediatorNameCustom} onChange={handleChange} maxLength={100} placeholder="Type mediator name" className={inputClass} />
              </div>

              {/* 11. Reviewer Name */}
              <div>
                <label className={labelClass}>Reviewer Name <span className="text-accent-red">*</span></label>
                <input type="text" name="reviewerNameCustom" value={form.reviewerNameCustom} onChange={handleChange} maxLength={100} placeholder="Type reviewer name" className={inputClass} />
              </div>

              {/* 12. Replacement Order */}
              <div>
                <label className={`${labelClass} mb-2`}>Replacement Order? <span className="text-accent-red">*</span></label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="isReplacement" value="yes" checked={form.isReplacement} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                    <span className="text-text-primary">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="isReplacement" value="no" checked={!form.isReplacement} onChange={handleChange} className="w-4 h-4 text-accent-blue" />
                    <span className="text-text-primary">No</span>
                  </label>
                </div>
              </div>

              {form.isReplacement && (
                <div>
                  <label className={labelClass}>New Replacement Order ID</label>
                  <input type="text" name="replacementOrderId" value={form.replacementOrderId} onChange={handleChange} maxLength={100} placeholder="Enter new replacement order ID" className={`${inputClass} bg-form-highlight-bg`} />
                </div>
              )}

              {/* 13. Mediator Message */}
              <div>
                <label className={labelClass}>Mediator Message</label>
                <textarea
                  name="mediatorMessage"
                  value={form.mediatorMessage}
                  onChange={handleChange}
                  placeholder="Paste the full mediator message here. We will automatically detect the refund form link."
                  rows={4}
                  maxLength={5000}
                  className={`${inputClass} resize-none`}
                />
                <p className="text-xs text-form-hint mt-1">
                  Paste the complete message — the refund form link will be extracted automatically and shown on your dashboard.
                </p>
                {refundLink && (
                  <div className="mt-2 p-3 bg-form-success-bg border border-form-success-border rounded-lg">
                    <p className="text-xs font-semibold text-form-success-text mb-1">Refund Form Link Detected:</p>
                    <a href={refundLink} target="_blank" rel="noopener noreferrer" className="text-xs text-form-link hover:underline break-all">{refundLink}</a>
                  </div>
                )}
              </div>

              {/* 14. Confirm */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-form-confirm-bg border border-form-confirm-border">
                <input type="checkbox" name="confirmed" checked={form.confirmed} onChange={handleChange} className="w-4 h-4 mt-0.5 text-accent-blue rounded" />
                <label className="text-sm text-form-confirm-text">I confirm that all the details provided by me are correct.</label>
              </div>

              {/* 15. Buttons */}
              <div className="space-y-3 pt-2">
                <button type="submit" disabled={submitting} className="w-full py-3 bg-accent-blue text-white font-semibold rounded-lg hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-accent-blue/20 disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit form'}
                </button>
                <button type="button" onClick={handleReset} className="w-full py-3 bg-accent-red text-white font-semibold rounded-lg hover:bg-red-600 active:scale-[0.98] transition-all">
                  Reset
                </button>
              </div>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-text-muted mt-6">2026 &copy; OrderFlow</p>
      </div>
    </div>
  );
}
