'use client';

import { useEffect, useState } from 'react';
import { restartTour, WALKTHROUGH_STORAGE_KEY } from './DemoWalkthrough';

const POST_SIGNUP_KEY = 'orderflow_postsignup_v1';

interface PostSignupTourProps {
  userCreatedAt: string;
}

export default function PostSignupTour({ userCreatedAt }: PostSignupTourProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if user signed up within the last 5 minutes and hasn't dismissed
    const dismissed = localStorage.getItem(POST_SIGNUP_KEY);
    if (dismissed) return;

    const signupAge = Date.now() - new Date(userCreatedAt).getTime();
    const FIVE_MINUTES = 5 * 60 * 1000;
    if (signupAge < FIVE_MINUTES) {
      setShow(true);
    }
  }, [userCreatedAt]);

  const handleStart = () => {
    setShow(false);
    localStorage.setItem(POST_SIGNUP_KEY, 'dismissed');
    localStorage.removeItem(WALKTHROUGH_STORAGE_KEY);
    restartTour();
  };

  const handleSkip = () => {
    setShow(false);
    localStorage.setItem(POST_SIGNUP_KEY, 'dismissed');
  };

  if (!show) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm">
      <div className="rounded-xl border border-dashboard-border bg-dashboard-card shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Want a quick tour?</p>
            <p className="text-xs text-text-muted mt-0.5">
              See how to add orders, track status, store mediator messages, and more.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleStart}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition"
              >
                Start tour
              </button>
              <button
                onClick={handleSkip}
                className="px-3 py-1.5 text-xs rounded-lg text-text-muted hover:text-text-primary hover:bg-dashboard-bg transition"
              >
                Skip
              </button>
            </div>
          </div>
          <button onClick={handleSkip} className="p-1 text-text-muted hover:text-text-primary transition flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
