'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id="lp-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#lp-grad)" />
      <path d="M12 14h16M12 20h10M12 26h13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="29" cy="26" r="4" fill="white" opacity="0.9" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Centralised Order Dashboard',
    desc: 'All your orders across Flipkart, Amazon, Meesho, Myntra and more — in one clean view.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    title: 'Import Previous Orders',
    desc: 'Upload your old order history from an Excel template and see everything in the dashboard instantly.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Status & Payment Tracking',
    desc: 'Move orders through each stage — ordered, delivered, review submitted, refund, payment received.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: 'Mediator Message Storage',
    desc: 'Paste and save the full mediator message and refund form link directly inside each order.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Analytics & Insights',
    desc: 'Monthly trends, platform-wise breakdown, top mediators and reviewers — all in one analytics view.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    title: 'Export Data Anytime',
    desc: 'Download your orders as Excel/CSV or a full JSON backup to share with your team or mediators.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    title: 'Telegram Order Tracking',
    desc: 'Track your order updates via your personal Telegram bot — right from the order details.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    title: 'Archive Completed Orders',
    desc: 'Keep your active dashboard clean by archiving paid orders without losing any history.',
  },
];

const PLATFORMS = ['Flipkart', 'Amazon', 'Meesho', 'Myntra', 'Ajio', 'Nykaa', 'Blinkit', 'Shopsy', 'Jio', 'Other'];

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const { theme } = useTheme();

  // If user is already logged in, send to dashboard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace('/dashboard');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-bg">
        <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard-bg text-text-primary">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-dashboard-border bg-dashboard-bg/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={32} />
            <span className="font-semibold text-sm leading-tight">
              OrderFlow<br />
              <span className="font-normal text-xs text-text-muted">Order Manager</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-dashboard-border bg-dashboard-card text-xs text-text-muted mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Built for review-based order workflows
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
          Manage all your{' '}
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            agency orders
          </span>
          <br />
          from one place
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-text-secondary mb-10">
          OrderFlow is a purpose-built order management platform for users who take orders through
          agencies, mediators, and marketing workflows. Track status, store mediator messages,
          manage refunds, and export data — all in one dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 shadow-lg shadow-blue-500/20 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View live demo
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border border-dashboard-border text-text-primary hover:bg-dashboard-card transition"
          >
            Create free account
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Platform badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-text-muted mr-1">Works with:</span>
          {PLATFORMS.map((p) => (
            <span
              key={p}
              className="px-2.5 py-0.5 rounded-full border border-dashboard-border bg-dashboard-card text-xs text-text-secondary"
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* DASHBOARD PREVIEW (placeholder) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative rounded-2xl border border-dashboard-border bg-dashboard-card overflow-hidden shadow-2xl shadow-black/20">
          {/* Fake browser chrome */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-dashboard-border bg-dashboard-bg/60">
            <span className="w-3 h-3 rounded-full bg-red-400/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
            <span className="w-3 h-3 rounded-full bg-green-400/70" />
            <span className="flex-1 mx-3 h-5 rounded-md bg-dashboard-border/50 text-[10px] text-text-muted flex items-center px-3">
              orderflow-manager.vercel.app/dashboard
            </span>
          </div>
          {/* Mock KPI row */}
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Active Orders', value: '24', color: 'text-yellow-400' },
                { label: 'Pending Refund', value: '6', color: 'text-red-400' },
                { label: 'Payment Received', value: '11', color: 'text-emerald-400' },
                { label: 'Total Amount', value: '₹18,450', color: 'text-blue-400' },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-dashboard-border bg-dashboard-bg p-3.5">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">{k.label}</p>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
            {/* Mock order cards */}
            <div className="space-y-2">
              {[
                { id: 'FK-8821', platform: 'Flipkart', product: 'Noise Buds N1', status: 'Review Submitted', color: 'border-l-purple-500', badge: 'bg-blue-500/20 text-blue-400' },
                { id: 'AMZ-3342', platform: 'Amazon', product: 'boAt Bassheads 100', status: 'Delivered', color: 'border-l-cyan-500', badge: 'bg-amber-500/20 text-amber-400' },
                { id: 'MSH-1190', platform: 'Meesho', product: 'Cotton Bedsheet Set', status: 'Refund Form Filled', color: 'border-l-green-500', badge: 'bg-rose-500/20 text-rose-400' },
              ].map((o) => (
                <div key={o.id} className={`rounded-lg border border-dashboard-border border-l-4 ${o.color} bg-dashboard-bg p-3 flex items-center gap-3`}>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${o.badge} border-current/30`}>{o.platform}</span>
                  <span className="text-sm text-text-primary font-medium flex-1 truncate">{o.product}</span>
                  <span className="text-xs text-text-muted">{o.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-dashboard-card text-text-secondary">{o.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline"
              >
                Open interactive demo
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Everything you need, nothing you don&apos;t</h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Purpose-built for review-order workflows — no bloat, just the tools that matter.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-dashboard-border bg-dashboard-card p-5 hover:border-accent-blue/30 transition group"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-3 group-hover:bg-accent-blue/20 transition">
                {f.icon}
              </div>
              <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
              <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-dashboard-border bg-dashboard-card/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How it works</h2>
            <p className="text-text-secondary">From order to payment — every step covered.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Add or import orders', desc: 'Fill the order form manually for new orders, or upload your old history using the Excel template.' },
              { step: '02', title: 'Track status at every stage', desc: 'Update each order as it moves — delivered, review submitted, refund form filled, payment received.' },
              { step: '03', title: 'Export and share data', desc: 'Download your orders as Excel or JSON to share with mediators, agencies, or your team.' },
            ].map((s) => (
              <div key={s.step} className="rounded-xl border border-dashboard-border bg-dashboard-card p-6 relative">
                <span className="text-4xl font-black text-text-muted/20 absolute top-4 right-5 select-none">{s.step}</span>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="rounded-2xl border border-dashboard-border bg-gradient-to-br from-blue-500/5 to-violet-500/5 p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to get organised?</h2>
          <p className="text-text-secondary mb-8 max-w-lg mx-auto">
            Start managing your orders the smart way. Free to get started — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/demo"
              className="px-6 py-3 rounded-xl border border-dashboard-border text-sm font-medium text-text-primary hover:bg-dashboard-card transition"
            >
              Try the demo first
            </Link>
            <Link
              href="/signup"
              className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 shadow-lg shadow-blue-500/20 transition"
            >
              Create your workspace →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-dashboard-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <BrandLogo size={20} />
            <span>OrderFlow Manager</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-text-primary transition">Log in</Link>
            <Link href="/signup" className="hover:text-text-primary transition">Sign up</Link>
            <Link href="/contact" className="hover:text-text-primary transition">Contact</Link>
            <Link href="/demo" className="hover:text-text-primary transition">Demo</Link>
          </div>
          <span>© {new Date().getFullYear()} OrderFlow</span>
        </div>
      </footer>
    </div>
  );
}
