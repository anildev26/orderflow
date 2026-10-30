'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import OrderCard from '@/components/OrderCard';
import ThemeToggle from '@/components/ThemeToggle';
import type { Order } from '@/types/order';

// Design preview only. Sample orders so the real dashboard cards can be judged
// with and without a WhatsApp icon. Nothing here is saved.

function order(partial: Partial<Order> & Pick<Order, 'id' | 'orderId' | 'platform' | 'productName' | 'status'>): Order {
  return {
    email: 'buyer@example.com',
    brandName: '',
    orderDate: '2026-10-20',
    totalAmount: 999,
    sellerLess: 0,
    sellerLessPercent: null,
    commissionAmount: null,
    mediatorName: '',
    mediatorPhone: null,
    reviewerName: 'Aaditya',
    orderType: 'Review',
    isReplacement: false,
    isExchange: false,
    exchangeProductName: '',
    replacementOrderId: '',
    mediatorMessage: '',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...partial,
  };
}

const ORDERS: Order[] = [
  order({
    id: '1', orderId: 'OD3291847561', platform: 'flipkart', productName: 'Noise Buds N1',
    status: 'delivered', orderDate: '2026-10-20', deliveredDate: '2026-10-26', returnPeriodDays: 7,
    totalAmount: 1299, mediatorName: 'Anil Sahu', mediatorPhone: '919876543210', reviewerName: 'Aaditya',
  }),
  order({
    id: '2', orderId: 'OD4081129033', platform: 'amazon', productName: 'boAt Airdopes 141',
    status: 'ordered', orderDate: '2026-10-28', totalAmount: 999,
    mediatorName: 'Yash', mediatorPhone: null, reviewerName: 'Anil Sahu', orderType: 'Rating',
  }),
  order({
    id: '3', orderId: 'OD7715204481', platform: 'meesho', productName: 'Cotton Bedsheet Set',
    status: 'refund_form_pending', orderDate: '2026-10-08', deliveredDate: '2026-10-12', returnPeriodDays: 7,
    totalAmount: 649, sellerLess: 150, mediatorName: 'Saloni', mediatorPhone: '919000011122', reviewerName: 'Priya',
  }),
  order({
    id: '4', orderId: 'OD5521903348', platform: 'myntra', productName: 'Roadster Checked Shirt',
    status: 'delivered', orderDate: '2026-10-27', deliveredDate: '2026-10-29', returnPeriodDays: 14,
    totalAmount: 1599, mediatorName: '', reviewerName: 'Aaditya', orderType: 'Empty Box',
  }),
  order({
    id: '5', orderId: 'OD6601287740', platform: 'ajio', productName: 'Puma Smash Sneakers',
    status: 'refund_form_filled', orderDate: '2026-10-01', deliveredDate: '2026-10-05',
    refundFormFilledDate: '2026-10-18', totalAmount: 2499,
    mediatorName: 'Farooq', mediatorPhone: '918800776655', reviewerName: 'Anil Sahu',
    refundFormLink: 'https://example.com/refund-form',
  }),
  order({
    id: '6', orderId: 'OD2190048812', platform: 'nykaa', productName: 'Maybelline Fit Me Foundation',
    status: 'informed_mediator', orderDate: '2026-09-22', deliveredDate: '2026-09-26',
    informedMediatorDate: '2026-10-20', totalAmount: 499,
    mediatorName: 'Danish', mediatorPhone: null, reviewerName: 'Priya', orderType: 'Rating',
  }),
  order({
    id: '7', orderId: 'OD8803312291', platform: 'blinkit', productName: 'Fortune Sunflower Oil 1L',
    status: 'ordered', orderDate: '2026-10-29', totalAmount: 189, commissionAmount: 50, sellerLess: 0,
    mediatorName: 'Priyansh', mediatorPhone: '917788990011', reviewerName: 'Aaditya', orderType: 'Order Deal',
  }),
  order({
    id: '8', orderId: 'OD1044928801', platform: 'amazon', productName: 'Kindle Paperwhite Cover',
    status: 'review_rating_submitted', orderDate: '2026-10-15', deliveredDate: '2026-10-18', returnPeriodDays: 10,
    reviewRatingDate: '2026-10-21', totalAmount: 899, sellerLess: 200,
    mediatorName: 'Brand Promotion India', mediatorPhone: '919812345678', reviewerName: 'Anil Sahu',
  }),
];

export default function MediatorDashboardPreview() {
  return (
    <div className="flex min-h-screen bg-dashboard-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="px-6 pt-5">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-text-primary leading-tight">Your Orders</h1>
              <p className="text-xs text-text-muted mt-1 hidden sm:block">Design preview — WhatsApp icon only where a mediator number exists.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ThemeToggle />
              <Link href="/order-form" className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 bg-accent-blue text-white rounded-lg text-sm font-semibold">
                New Order
              </Link>
              <button type="button" className="inline-flex items-center gap-2 px-3 py-2 bg-dashboard-card border border-dashboard-border rounded-lg text-sm font-medium text-text-secondary">
                Filters
              </button>
            </div>
          </div>
          <div className="mb-3">
            <input
              readOnly
              value=""
              placeholder="Search by order ID, product name, reviewer, mediator..."
              className="w-full pl-3 pr-3 py-2 bg-dashboard-card border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted outline-none"
            />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white">All</span>
            <span className="ml-2 text-xs text-text-muted">{ORDERS.length} orders</span>
          </div>
        </div>
        <div className="px-6 pb-8 space-y-3 mt-1">
          {ORDERS.map((item) => (
            <div key={item.id} data-order={item.id}>
              <OrderCard order={item} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
