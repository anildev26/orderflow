'use client';

import { useEffect, useRef, useCallback } from 'react';

export const WALKTHROUGH_STORAGE_KEY = 'orderflow_walkthrough_v1';

export const TOUR_STEPS = [
  {
    element: '[data-tour="welcome"]',
    popover: {
      title: 'Welcome to OrderFlow',
      description:
        'This is a live demo of OrderFlow — an order management platform built for users who take orders through agencies, mediators, and marketing workflows. Use the Next button to explore each feature.',
    },
  },
  {
    element: '[data-tour="kpi-cards"]',
    popover: {
      title: 'Order Summary at a Glance',
      description:
        'These KPI cards show your active orders, pending refund count, payment received count, and total order amount. Click any card to instantly filter the order list below.',
    },
  },
  {
    element: '[data-tour="search-filter"]',
    popover: {
      title: 'Search & Filter Orders',
      description:
        'Search by order ID, product name, or mediator name. Use the Filter button to narrow orders by status, platform, or month. A Reset button clears all filters instantly.',
    },
  },
  {
    element: '[data-tour="add-order"]',
    popover: {
      title: 'Add a New Order',
      description:
        'When you receive a new order from your mediator, click "New Order" to open the order form. Fill in the platform, order ID, product details, mediator info, and the order is saved to your dashboard.',
    },
  },
  {
    element: '[data-tour="import-orders"]',
    popover: {
      title: 'Import Previous Orders',
      description:
        'Have old order history? Download the Excel template, fill it with your previous orders, and upload it here. All your historical orders will appear in the dashboard immediately.',
    },
  },
  {
    element: '[data-tour="order-list"]',
    popover: {
      title: 'Your Order List',
      description:
        'Each order card shows the platform badge, product name, order ID, mediator, order amount, and current status. The left border colour changes with the status so you can spot urgent orders at a glance.',
    },
  },
  {
    element: '[data-tour="order-card-status"]',
    popover: {
      title: 'Update Order Status',
      description:
        'Click "Update Status" on any order to move it through the workflow: Ordered → Delivered → Review Submitted → Refund Form Pending → Refund Form Filled → Informed Mediator → Payment Received.',
    },
  },
  {
    element: '[data-tour="order-card-edit"]',
    popover: {
      title: 'Edit Order Details',
      description:
        'Need to fix a detail after saving? Click the edit icon to update any field — platform, product name, amount, mediator, and more — without creating a duplicate.',
    },
  },
  {
    element: '[data-tour="mediator-message"]',
    popover: {
      title: 'Mediator Message & Refund Link',
      description:
        'Each order stores the full mediator message and refund form link. Paste the WhatsApp message from your mediator directly here so you always have it on record. The refund link is stored as a one-click button.',
    },
  },
  {
    element: '[data-tour="payment-archive"]',
    popover: {
      title: 'Mark Payment & Archive',
      description:
        'Once payment is received, mark the order as "Payment Received". It will automatically move to the Archive section so your active dashboard stays clean.',
    },
  },
  {
    element: '[data-tour="sidebar-archive"]',
    popover: {
      title: 'Archive',
      description:
        'The Archive section stores all completed (payment received) orders. You can still search, view, and export archived orders — nothing is ever deleted.',
    },
  },
  {
    element: '[data-tour="sidebar-analytics"]',
    popover: {
      title: 'Customer Analytics',
      description:
        'The Analytics section shows monthly order trends, platform-wise breakdown, top mediators, and top reviewers — helping you understand your order patterns over time.',
    },
  },
  {
    element: '[data-tour="export-data"]',
    popover: {
      title: 'Export Data',
      description:
        'Export all your orders as Excel/CSV for sharing with mediators or agencies, or download a full JSON backup. You can also export only the current filtered view.',
    },
  },
  {
    element: '[data-tour="telegram-track"]',
    popover: {
      title: 'Track on Telegram',
      description:
        'After adding an order, connect to the OrderFlow Telegram bot to track status updates directly from Telegram — no need to open the dashboard each time.',
    },
  },
  {
    element: '[data-tour="sidebar-features"]',
    popover: {
      title: 'Feature Requests & What\'s New',
      description:
        'Have an idea or want a new feature? Submit a feature request and vote on requests from other users. Check "What\'s New" to see the latest updates and improvements.',
    },
  },
  {
    element: '[data-tour="demo-cta"]',
    popover: {
      title: 'Ready to manage your own orders?',
      description:
        'You\'ve seen how OrderFlow works. Create your free account now and start organising your orders from day one. It only takes a minute.',
    },
  },
];

interface DemoWalkthroughProps {
  autoStart?: boolean;
  onComplete?: () => void;
}

export default function DemoWalkthrough({ autoStart = false, onComplete }: DemoWalkthroughProps) {
  const driverRef = useRef<unknown>(null);

  const startTour = useCallback(async () => {
    const { driver } = await import('driver.js');
    await import('driver.js/dist/driver.css');

    if (driverRef.current) {
      (driverRef.current as { destroy: () => void }).destroy();
    }

    const d = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0,0,0,0.65)',
      smoothScroll: true,
      allowClose: true,
      stagePadding: 8,
      stageRadius: 10,
      popoverClass: 'orderflow-tour-popover',
      nextBtnText: 'Next →',
      prevBtnText: '← Prev',
      doneBtnText: 'Finish tour',
      progressText: 'Step {{current}} of {{total}}',
      steps: TOUR_STEPS.map((s) => ({
        element: s.element,
        popover: {
          title: s.popover.title,
          description: s.popover.description,
          side: 'bottom' as const,
          align: 'start' as const,
        },
      })),
      onDestroyStarted: () => {
        localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'completed');
        d.destroy();
        onComplete?.();
      },
    });

    driverRef.current = d;
    d.drive();
  }, [onComplete]);

  // Auto-start on mount if requested and not already seen
  useEffect(() => {
    if (!autoStart) return;
    const seen = localStorage.getItem(WALKTHROUGH_STORAGE_KEY);
    if (seen) return;
    // Small delay so the page elements render first
    const t = setTimeout(() => startTour(), 800);
    return () => clearTimeout(t);
  }, [autoStart, startTour]);

  // Expose start globally so other components can trigger it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__orderflow_start_tour__ = startTour;
    return () => {
      delete (window as unknown as Record<string, unknown>).__orderflow_start_tour__;
    };
  }, [startTour]);

  return null;
}

// Helper for other components to restart the tour
export function restartTour() {
  localStorage.removeItem(WALKTHROUGH_STORAGE_KEY);
  const fn = (window as unknown as Record<string, unknown>).__orderflow_start_tour__;
  if (typeof fn === 'function') {
    (fn as () => void)();
  }
}
