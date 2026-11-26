'use client';

import { useEffect, useRef, useState } from 'react';

// C · OrderFlow logo, shown once when the app opens (first visit or a refresh).
//
// It is part of the HTML the server sends, so it appears before any JavaScript has
// downloaded (the slow part on a weak phone connection). As soon as the app is
// running it fades out, and the page's own skeleton takes over. Moving between
// pages inside the app never shows it again. A CSS safety net hides it after 8 s
// even if scripts fail, so it can never block the app.

let booted = false;

export default function BootSplash() {
  const ref = useRef<HTMLDivElement>(null);
  // Decided once per mount. On the server and on the first hydration this is
  // `true` for both, so the markup always matches.
  const [show] = useState(() => !booted);

  useEffect(() => {
    if (!show) return;
    booted = true;
    const el = ref.current;
    if (!el) return;
    // React owns this element, so it is hidden with an attribute, never removed by hand.
    const frame = requestAnimationFrame(() => el.setAttribute('data-state', 'leaving'));
    const done = window.setTimeout(() => el.setAttribute('data-state', 'gone'), 400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div ref={ref} className="of-splash" role="status" aria-label="Loading OrderFlow">
      <svg className="of-splash-logo" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="of-splash-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#of-splash-grad)" />
        <path d="M13 16V14C13 10.134 16.134 7 20 7C23.866 7 27 10.134 27 14V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <rect x="10" y="16" width="20" height="17" rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
        <path className="of-splash-check" d="M15 25L18 28L25 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-base font-bold text-text-primary tracking-tight">OrderFlow</span>
      <span className="of-dots" style={{ fontSize: 5 }} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
