import { create } from 'zustand';
import { createClient } from '@/lib/supabase';

export interface DemoOrder {
  id: string;
  platform: string;
  orderId: string;
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
  refundFormLink: string;
  status: string;
  deliveredDate?: string;
  returnPeriodDays: number;
  reviewRatingDate?: string;
  refundFormFilledDate?: string;
  informedMediatorDate?: string;
  paymentReceivedDate?: string;
  paymentBank: string;
  isVisible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type DemoOrderFormData = Omit<DemoOrder, 'id' | 'createdAt' | 'updatedAt'>;

function fromRow(row: Record<string, unknown>): DemoOrder {
  return {
    id: row.id as string,
    platform: row.platform as string,
    orderId: row.order_id as string,
    brandName: row.brand_name as string,
    productName: row.product_name as string,
    orderDate: row.order_date as string,
    totalAmount: row.total_amount as number,
    sellerLess: row.seller_less as number,
    mediatorName: row.mediator_name as string,
    reviewerName: row.reviewer_name as string,
    orderType: row.order_type as string,
    isReplacement: row.is_replacement as boolean,
    isExchange: row.is_exchange as boolean,
    exchangeProductName: row.exchange_product_name as string,
    replacementOrderId: row.replacement_order_id as string,
    mediatorMessage: row.mediator_message as string,
    refundFormLink: row.refund_form_link as string,
    status: row.status as string,
    deliveredDate: row.delivered_date as string | undefined,
    returnPeriodDays: (row.return_period_days as number) ?? 7,
    reviewRatingDate: row.review_rating_date as string | undefined,
    refundFormFilledDate: row.refund_form_filled_date as string | undefined,
    informedMediatorDate: row.informed_mediator_date as string | undefined,
    paymentReceivedDate: row.payment_received_date as string | undefined,
    paymentBank: row.payment_bank as string,
    isVisible: row.is_visible as boolean,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toRow(data: DemoOrderFormData): Record<string, unknown> {
  return {
    platform: data.platform,
    order_id: data.orderId,
    brand_name: data.brandName,
    product_name: data.productName,
    order_date: data.orderDate,
    total_amount: data.totalAmount,
    seller_less: data.sellerLess,
    mediator_name: data.mediatorName,
    reviewer_name: data.reviewerName,
    order_type: data.orderType,
    is_replacement: data.isReplacement,
    is_exchange: data.isExchange,
    exchange_product_name: data.exchangeProductName,
    replacement_order_id: data.replacementOrderId,
    mediator_message: data.mediatorMessage,
    refund_form_link: data.refundFormLink,
    status: data.status,
    delivered_date: data.deliveredDate || null,
    return_period_days: data.returnPeriodDays,
    review_rating_date: data.reviewRatingDate || null,
    refund_form_filled_date: data.refundFormFilledDate || null,
    informed_mediator_date: data.informedMediatorDate || null,
    payment_received_date: data.paymentReceivedDate || null,
    payment_bank: data.paymentBank,
    is_visible: data.isVisible,
    sort_order: data.sortOrder,
  };
}

interface DemoOrderStore {
  orders: DemoOrder[];
  loading: boolean;
  // Fetch all (admin gets hidden too via separate RLS policy)
  fetchAll: () => Promise<void>;
  // Fetch only visible (public demo page)
  fetchVisible: () => Promise<void>;
  create: (data: DemoOrderFormData) => Promise<void>;
  update: (id: string, data: Partial<DemoOrderFormData>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useDemoOrderStore = create<DemoOrderStore>((set) => ({
  orders: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from('demo_orders')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) {
      set({ orders: data.map(fromRow) });
    }
    set({ loading: false });
  },

  fetchVisible: async () => {
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from('demo_orders')
      .select('*')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    if (!error && data) {
      set({ orders: data.map(fromRow) });
    }
    set({ loading: false });
  },

  create: async (data) => {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from('demo_orders')
      .insert(toRow(data))
      .select()
      .single();
    if (!error && row) {
      set((s) => ({ orders: [...s.orders, fromRow(row as Record<string, unknown>)] }));
    } else if (error) {
      throw error;
    }
  },

  update: async (id, data) => {
    const supabase = createClient();
    const partialRow = toRow(data as DemoOrderFormData);
    // Remove keys whose values are undefined so we only patch changed fields
    Object.keys(partialRow).forEach((k) => partialRow[k] === undefined && delete partialRow[k]);
    const { data: row, error } = await supabase
      .from('demo_orders')
      .update(partialRow)
      .eq('id', id)
      .select()
      .single();
    if (!error && row) {
      set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? fromRow(row as Record<string, unknown>) : o)),
      }));
    } else if (error) {
      throw error;
    }
  },

  remove: async (id) => {
    const supabase = createClient();
    const { error } = await supabase.from('demo_orders').delete().eq('id', id);
    if (!error) {
      set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }));
    } else {
      throw error;
    }
  },
}));
