'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useId, useEffect } from 'react';
import {
  HiOutlineClipboardList,
  HiOutlineDocumentText,
  HiOutlineArchive,
  HiOutlineChartBar,
  HiOutlineMail,
  HiOutlineBell,
  HiOutlineLightBulb,
} from 'react-icons/hi';
import WhatsNewModal, { WHATS_NEW_STORAGE_KEY, LATEST_VERSION } from './WhatsNewModal';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  desktopOnly?: boolean;
  onClick?: () => void;
  badge?: boolean;
  newTab?: boolean;
}

const buildMainNav = (onWhatsNew: () => void, hasNew: boolean): NavItem[] => [
  {
    label: 'Orders Dashboard',
    href: '/dashboard',
    icon: <HiOutlineClipboardList className="w-5 h-5" />,
  },
  {
    label: 'Order Form',
    href: '/order-form',
    icon: <HiOutlineDocumentText className="w-5 h-5" />,
    newTab: true,
  },
  {
    label: 'Archive',
    href: '/archive',
    icon: <HiOutlineArchive className="w-5 h-5" />,
  },
  {
    label: 'My Order Analytics',
    href: '/analytics',
    icon: <HiOutlineChartBar className="w-5 h-5" />,
  },
  {
    label: 'Feature Requests',
    href: '/feature-requests',
    icon: <HiOutlineLightBulb className="w-5 h-5" />,
  },
  {
    label: "What's New",
    icon: <HiOutlineBell className="w-5 h-5" />,
    onClick: onWhatsNew,
    badge: hasNew,
  },
  {
    label: 'Contact',
    href: '/contact',
    icon: <HiOutlineMail className="w-5 h-5" />,
  },
];

// Brand Logo SVG component
function BrandLogo({ size = 32 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill={`url(#${gradientId})`} />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M13 16V14C13 10.134 16.134 7 20 7C23.866 7 27 10.134 27 14V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <rect x="10" y="16" width="20" height="17" rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
      <path d="M15 25L18 28L25 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
    setHasNew(seen !== LATEST_VERSION);
  }, []);

  const handleWhatsNew = () => {
    setWhatsNewOpen(true);
    setHasNew(false);
    setMobileOpen(false);
  };

  const mainNav = buildMainNav(handleWhatsNew, hasNew);

  const isActive = (href: string) => pathname === href;

  // Desktop: collapsed by default (icons only), expands on hover
  const expanded = hovered;

  return (
    <>
      {/* Mobile hamburger button - only show when sidebar is CLOSED */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-dashboard-card border border-dashboard-border text-text-secondary hover:text-text-primary md:hidden"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ====== MOBILE SIDEBAR ====== */}
      <aside
        className={[
          'fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar-bg border-r border-dashboard-border flex flex-col transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Mobile header: Logo + X close */}
        <div className="flex items-center justify-between p-4 border-b border-dashboard-border h-16">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <BrandLogo size={34} />
            <span className="text-text-primary font-semibold text-sm leading-tight">
              OrderFlow<br /><span className="font-normal text-xs opacity-70">Order Manager</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-dashboard-card text-text-secondary hover:text-text-primary"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {mainNav.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noopener noreferrer' : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth ${
                      isActive(item.href)
                        ? 'bg-sidebar-active text-white'
                        : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'
                    }`}
                  >
                    <span className="relative flex-shrink-0">
                      {item.icon}
                      {item.badge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-blue rounded-full" />}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth text-text-secondary hover:bg-dashboard-card hover:text-text-primary"
                  >
                    <span className="relative flex-shrink-0">
                      {item.icon}
                      {item.badge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-blue rounded-full" />}
                    </span>
                    <span>{item.label}</span>
                    {item.badge && <span className="ml-auto text-[10px] font-semibold bg-accent-blue text-white px-1.5 py-0.5 rounded-full">New</span>}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-dashboard-border">
          <p className="text-[10px] text-text-muted text-center">
            OrderFlow
          </p>
        </div>
      </aside>

      {/* ====== DESKTOP SIDEBAR — hover to expand ====== */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={[
          'fixed left-0 top-0 z-40 h-screen bg-sidebar-bg border-r border-dashboard-border flex-col transition-all duration-300 ease-in-out hidden md:flex',
          expanded ? 'w-60' : 'w-16',
        ].join(' ')}
      >
        {/* Desktop logo */}
        <div className="flex items-center h-16 border-b border-dashboard-border px-3 overflow-hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
            <BrandLogo size={32} />
            <span
              className={`text-text-primary font-semibold text-sm leading-tight whitespace-nowrap transition-opacity duration-200 ${
                expanded ? 'opacity-100' : 'opacity-0 w-0'
              }`}
            >
              OrderFlow<br /><span className="font-normal text-xs opacity-70">Order Manager</span>
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {expanded && (
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Main
            </span>
          )}
          <ul className="mt-2 space-y-1">
            {mainNav.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noopener noreferrer' : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth ${
                      isActive(item.href)
                        ? 'bg-sidebar-active text-white'
                        : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'
                    } ${!expanded ? 'justify-center' : ''}`}
                    title={!expanded ? (item.newTab ? `${item.label} (opens in new tab)` : item.label) : undefined}
                  >
                    <span className="relative flex-shrink-0">
                      {item.icon}
                      {item.badge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-blue rounded-full" />}
                    </span>
                    {expanded && (
                      <span className="whitespace-nowrap flex-1 flex items-center gap-1.5">
                        {item.label}
                        {item.newTab && (
                          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </span>
                    )}
                  </Link>
                ) : (
                  <button
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth text-text-secondary hover:bg-dashboard-card hover:text-text-primary ${!expanded ? 'justify-center' : ''}`}
                    title={!expanded ? item.label : undefined}
                  >
                    <span className="relative flex-shrink-0">
                      {item.icon}
                      {item.badge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-blue rounded-full" />}
                    </span>
                    {expanded && (
                      <>
                        <span className="whitespace-nowrap flex-1 text-left">{item.label}</span>
                        {item.badge && <span className="text-[10px] font-semibold bg-accent-blue text-white px-1.5 py-0.5 rounded-full">New</span>}
                      </>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop footer */}
        <div className="p-3 border-t border-dashboard-border">
          {expanded && (
            <p className="text-[10px] text-text-muted text-center">
              OrderFlow
            </p>
          )}
        </div>
      </aside>

      {/* Desktop spacer — always collapsed width, content shifts on hover via sidebar overlay */}
      <div className="hidden md:block flex-shrink-0 w-16" />

      <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </>
  );
}
