export type OrderPlatform = 'flipkart' | 'amazon' | 'meesho' | 'myntra' | 'jio' | 'blinkit' | 'ajio' | 'shopsy' | 'nykaa' | 'other';

export type OrderStatus =
  | 'ordered'
  | 'delivered'
  | 'review_rating_submitted'
  | 'refund_form_pending'
  | 'refund_form_filled'
  | 'informed_mediator'
  | 'payment_received'
  | 'order_cancelled';

export interface Order {
  id: string;
  orderId: string;
  platform: OrderPlatform;
  email: string;
  brandName: string;
  productName: string;
  orderDate: string;
  totalAmount: number;
  sellerLess: number;
  mediatorName: string;
  reviewerName: string;
  orderType: string;
  isReplacement: boolean;
  isExchange: boolean;
  exchangeProductName: string;
  replacementOrderId: string;
  mediatorMessage: string;
  refundFormLink?: string;
  status: OrderStatus;
  // Dedicated date fields per status
  deliveredDate?: string;
  returnPeriodDays?: number;
  reviewRatingDate?: string;
  refundFormFilledDate?: string;
  informedMediatorDate?: string;
  paymentReceivedDate?: string;
  paymentBank?: string;
  isNewOrder?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderFormData {
  platform: OrderPlatform;
  email: string;
  orderId: string;
  productName: string;
  orderType: string;
  isExchange: boolean;
  exchangeProductName: string;
  sellerLess: number;
  mediatorName: string;
  reviewerName: string;
  isReplacement: boolean;
  replacementOrderId: string;
  totalAmount: number;
  mediatorMessage: string;
  refundFormLink?: string;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  ordered: 'Ordered',
  delivered: 'Delivered',
  review_rating_submitted: 'Review/Rating Submitted',
  refund_form_pending: 'Refund Form Pending',
  refund_form_filled: 'Refund Form Filled',
  informed_mediator: 'Informed Mediator',
  payment_received: 'Payment Received',
  order_cancelled: 'Order Cancelled',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  ordered: 'bg-blue-500',
  delivered: 'bg-cyan-500',
  review_rating_submitted: 'bg-purple-500',
  refund_form_pending: 'bg-red-500',
  refund_form_filled: 'bg-green-500',
  informed_mediator: 'bg-teal-500',
  payment_received: 'bg-emerald-600',
  order_cancelled: 'bg-gray-500',
};

// Status options for Update Order dropdown AND Filter panel
export const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'review_rating_submitted', label: 'Review/Rating Submitted' },
  { value: 'refund_form_pending', label: 'Refund Form Pending' },
  { value: 'refund_form_filled', label: 'Refund Form Filled' },
  { value: 'informed_mediator', label: 'Informed Mediator' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'order_cancelled', label: 'Order Cancelled' },
];

export const PLATFORM_OPTIONS: { value: OrderPlatform; label: string }[] = [
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'myntra', label: 'Myntra' },
  { value: 'jio', label: 'Jio' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'ajio', label: 'Ajio' },
  { value: 'shopsy', label: 'Shopsy' },
  { value: 'nykaa', label: 'Nykaa' },
  { value: 'other', label: 'Other' },
];

export const MEDIATOR_NAMES = [
  'Anil Sahu',
  'Yash',
  'Saloni',
  'Mood Off',
  'Farooq',
  'Nikhil Raj',
  'Priyansh',
  'Raj Khan',
  'Anshu Batwal',
  'Danish',
  'Shanaya',
  'Chandani Katyal',
  'Ritik Jindal',
  'Apka Bazaar',
  'Brand Promotion India',
  'Other',
];

export const REVIEWER_NAMES = [
  'Aaditya',
  'Anil Sahu',
  'Anil Sahu Meesho',
  'Other',
];
