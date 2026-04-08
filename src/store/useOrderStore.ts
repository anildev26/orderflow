import { create } from 'zustand';
import { Order, OrderStatus, OrderPlatform } from '@/types/order';
import { createClient } from '@/lib/supabase';

interface OrderStore {
  orders: Order[];
  loading: boolean;
  initialized: boolean;
  fetchOrders: () => Promise<void>;
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus, extras?: Partial<Order>) => Promise<void>;
  getOrder: (orderId: string) => Order | undefined;
  getActiveOrders: (status?: OrderStatus | 'all', search?: string, searchField?: string, platform?: string, month?: string) => Order[];
  getArchivedOrders: (search?: string, platform?: string) => Order[];
  getStats: (platform?: string) => {
    totalOrders: number;
    totalAmount: number;
    actualSpent: number;
    refundFormPending: number;
    refundFormFilled: number;
    archivedOrders: number;
  };
  exportData: () => string;
  importData: (jsonString: string) => Promise<boolean>;
}

// Map DB row (snake_case) to Order (camelCase)
function dbToOrder(row: Record<string, unknown>): Order {
  // Handle legacy status values - map old statuses to new ones
  let status = row.status as string;
  if (status === 'paid') status = 'payment_received';
  if (status === 'cancelled') status = 'order_cancelled';
  if (status === 'rating_review_submitted') status = 'review_rating_submitted';
  if (status === 'rating_form_filled' || status === 'review_form_filled') status = 'refund_form_filled';

  return {
    id: row.id as string,
    orderId: row.order_id as string,
    platform: row.platform as OrderPlatform,
    email: (row.email as string) || '',
    brandName: (row.brand_name as string) || '',
    productName: (row.product_name as string) || '',
    orderDate: row.order_date as string,
    totalAmount: Number(row.total_amount) || 0,
    sellerLess: Number(row.seller_less) || 0,
    mediatorName: (row.mediator_name as string) || '',
    reviewerName: (row.reviewer_name as string) || '',
    orderType: (row.order_type as string) || 'Rating',
    isReplacement: (row.is_replacement as boolean) || false,
    isExchange: (row.is_exchange as boolean) || false,
    exchangeProductName: (row.exchange_product_name as string) || '',
    replacementOrderId: (row.replacement_order_id as string) || '',
    mediatorMessage: (row.mediator_message as string) || '',
    refundFormLink: (row.refund_form_link as string) || undefined,
    status: status as OrderStatus,
    deliveredDate: (row.delivered_date as string) || undefined,
    returnPeriodDays: row.return_period_days != null ? Number(row.return_period_days) : undefined,
    reviewRatingDate: (row.review_rating_date as string) || undefined,
    refundFormFilledDate: (row.refund_form_filled_date as string) || undefined,
    informedMediatorDate: (row.informed_mediator_date as string) || undefined,
    paymentReceivedDate: (row.payment_received_date as string) || (row.payment_date as string) || undefined,
    paymentBank: (row.payment_bank as string) || undefined,
    isNewOrder: (row.is_new_order as boolean) || false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Map Order (camelCase) to DB insert (snake_case)
function orderToDb(order: Partial<Order> & { userId?: string }) {
  const result: Record<string, unknown> = {};
  if (order.userId) result.user_id = order.userId;
  if (order.orderId !== undefined) result.order_id = order.orderId;
  if (order.platform !== undefined) result.platform = order.platform;
  if (order.email !== undefined) result.email = order.email;
  if (order.brandName !== undefined) result.brand_name = order.brandName;
  if (order.productName !== undefined) result.product_name = order.productName;
  if (order.orderDate !== undefined) result.order_date = order.orderDate;
  if (order.totalAmount !== undefined) result.total_amount = order.totalAmount;
  if (order.sellerLess !== undefined) result.seller_less = order.sellerLess;
  if (order.mediatorName !== undefined) result.mediator_name = order.mediatorName;
  if (order.reviewerName !== undefined) result.reviewer_name = order.reviewerName;
  if (order.orderType !== undefined) result.order_type = order.orderType;
  if (order.isReplacement !== undefined) result.is_replacement = order.isReplacement;
  if (order.isExchange !== undefined) result.is_exchange = order.isExchange;
  if (order.exchangeProductName !== undefined) result.exchange_product_name = order.exchangeProductName;
  if (order.replacementOrderId !== undefined) result.replacement_order_id = order.replacementOrderId;
  if (order.mediatorMessage !== undefined) result.mediator_message = order.mediatorMessage;
  if (order.refundFormLink !== undefined) result.refund_form_link = order.refundFormLink || null;
  if (order.status !== undefined) result.status = order.status;
  if (order.deliveredDate !== undefined) result.delivered_date = order.deliveredDate;
  if (order.returnPeriodDays !== undefined) result.return_period_days = order.returnPeriodDays;
  if (order.reviewRatingDate !== undefined) result.review_rating_date = order.reviewRatingDate;
  if (order.refundFormFilledDate !== undefined) result.refund_form_filled_date = order.refundFormFilledDate;
  if (order.informedMediatorDate !== undefined) result.informed_mediator_date = order.informedMediatorDate;
  if (order.paymentReceivedDate !== undefined) result.payment_received_date = order.paymentReceivedDate;
  if (order.paymentBank !== undefined) result.payment_bank = order.paymentBank;
  if (order.isNewOrder !== undefined) result.is_new_order = order.isNewOrder;
  return result;
}

export const useOrderStore = create<OrderStore>()((set, get) => ({
  orders: [],
  loading: true,
  initialized: false,

  fetchOrders: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, initialized: true }); return; }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (!error && data) {
      const orders = data.map(dbToOrder);
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;

      // 1. Auto-deliver: orders still in 'ordered' status after 30 days from order date
      const autoDeliverOrders = orders.filter((o) => {
        if (o.status !== 'ordered') return false;
        const orderTime = new Date(o.orderDate).getTime();
        return now > orderTime + 30 * DAY_MS;
      });

      if (autoDeliverOrders.length > 0) {
        for (const o of autoDeliverOrders) {
          const deliveredDate = new Date(new Date(o.orderDate).getTime() + 30 * DAY_MS)
            .toISOString().split('T')[0];
          await supabase
            .from('orders')
            .update({ status: 'delivered', delivered_date: deliveredDate, return_period_days: o.returnPeriodDays || 7 })
            .eq('order_id', o.orderId);
          o.status = 'delivered';
          o.deliveredDate = deliveredDate;
          if (!o.returnPeriodDays) o.returnPeriodDays = 7;
        }
      }

      // 2. Auto-refund-pending: orders still in 'delivered' status whose return period has expired
      const expiredOrders = orders.filter((o) => {
        if (o.status !== 'delivered' || !o.deliveredDate) return false;
        const returnDays = o.returnPeriodDays || 7;
        const returnEnd = new Date(o.deliveredDate).getTime() + returnDays * DAY_MS;
        return now > returnEnd;
      });

      if (expiredOrders.length > 0) {
        const expiredIds = expiredOrders.map((o) => o.orderId);
        await supabase
          .from('orders')
          .update({ status: 'refund_form_pending' })
          .in('order_id', expiredIds);

        for (const o of orders) {
          if (expiredIds.includes(o.orderId)) {
            o.status = 'refund_form_pending';
          }
        }
      }

      set({ orders, loading: false, initialized: true });
    } else {
      set({ loading: false, initialized: true });
    }
  },

  addOrder: async (orderData) => {
    const duplicate = get().orders.find((o) => o.orderId === orderData.orderId);
    if (duplicate) {
      throw new Error(`Order ID "${orderData.orderId}" already exists`);
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dbRow = orderToDb({
      ...orderData,
      status: 'ordered',
      isNewOrder: true,
      userId: user.id,
    } as Order & { userId: string });

    const { data, error } = await supabase
      .from('orders')
      .insert(dbRow)
      .select()
      .single();

    if (!error && data) {
      const newOrder = dbToOrder(data);
      set((state) => ({ orders: [newOrder, ...state.orders] }));
    }
  },

  updateOrderStatus: async (id, status, extras = {}) => {
    const supabase = createClient();
    const updateData: Record<string, unknown> = { status };

    // Map extras to snake_case
    if (extras.deliveredDate !== undefined) updateData.delivered_date = extras.deliveredDate;
    if (extras.returnPeriodDays !== undefined) updateData.return_period_days = extras.returnPeriodDays;
    if (extras.reviewRatingDate !== undefined) updateData.review_rating_date = extras.reviewRatingDate;
    if (extras.refundFormFilledDate !== undefined) updateData.refund_form_filled_date = extras.refundFormFilledDate;
    if (extras.informedMediatorDate !== undefined) updateData.informed_mediator_date = extras.informedMediatorDate;
    if (extras.paymentReceivedDate !== undefined) updateData.payment_received_date = extras.paymentReceivedDate;
    if (extras.paymentBank !== undefined) updateData.payment_bank = extras.paymentBank;
    if (extras.mediatorMessage !== undefined) updateData.mediator_message = extras.mediatorMessage;
    if (extras.refundFormLink !== undefined) updateData.refund_form_link = extras.refundFormLink || null;
    if (extras.sellerLess !== undefined) updateData.seller_less = extras.sellerLess;
    if (extras.isReplacement !== undefined) updateData.is_replacement = extras.isReplacement;
    if (extras.replacementOrderId !== undefined) updateData.replacement_order_id = extras.replacementOrderId;
    if (extras.totalAmount !== undefined) updateData.total_amount = extras.totalAmount;

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id);

    if (!error) {
      set((state) => ({
        orders: state.orders.map((order) =>
          order.id === id
            ? { ...order, ...extras, status, updatedAt: new Date().toISOString() }
            : order
        ),
      }));
    }
  },

  getOrder: (orderId) => get().orders.find((o) => o.orderId === orderId),

  getActiveOrders: (status = 'all', search = '', searchField = 'orderid', platform = 'all', month = 'all') => {
    // Active = everything except payment_received and order_cancelled
    let filtered = get().orders.filter((o) => o.status !== 'payment_received' && o.status !== 'order_cancelled');
    if (status && status !== 'all') filtered = filtered.filter((o) => o.status === status);
    if (platform && platform !== 'all') filtered = filtered.filter((o) => o.platform === platform);
    if (month && month !== 'all') {
      filtered = filtered.filter((o) => {
        const d = new Date(o.orderDate);
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const y = d.getFullYear().toString();
        return `${y}-${m}` === month;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((o) => {
        if (searchField === 'all') {
          return o.orderId.toLowerCase().includes(q) ||
            o.productName.toLowerCase().includes(q) ||
            o.reviewerName.toLowerCase().includes(q) ||
            o.mediatorName.toLowerCase().includes(q) ||
            o.brandName.toLowerCase().includes(q);
        }
        if (searchField === 'orderid') return o.orderId.toLowerCase().includes(q);
        if (searchField === 'product_name') return o.productName.toLowerCase().includes(q);
        if (searchField === 'reviewer_name') return o.reviewerName.toLowerCase().includes(q);
        return o.orderId.toLowerCase().includes(q);
      });
    }
    return filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  },

  getArchivedOrders: (search = '', platform = 'all') => {
    let filtered = get().orders.filter((o) => o.status === 'payment_received');
    if (platform && platform !== 'all') filtered = filtered.filter((o) => o.platform === platform);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((o) =>
        o.orderId.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q)
      );
    }
    return filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  },

  getStats: (platform = 'all') => {
    let orders = get().orders;
    if (platform && platform !== 'all') orders = orders.filter((o) => o.platform === platform);
    const activeOrders = orders.filter((o) => o.status !== 'payment_received' && o.status !== 'order_cancelled');
    const totalAmount = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const actualSpent = activeOrders.reduce((sum, o) => sum + o.sellerLess, 0);
    return {
      totalOrders: activeOrders.length,
      totalAmount,
      actualSpent,
      refundFormPending: orders.filter((o) => o.status === 'refund_form_pending').length,
      refundFormFilled: orders.filter((o) => o.status === 'refund_form_filled').length,
      archivedOrders: orders.filter((o) => o.status === 'payment_received').length,
    };
  },

  exportData: () => {
    const orders = get().orders;
    return JSON.stringify({ orders, exportedAt: new Date().toISOString(), version: '2.0' }, null, 2);
  },

  importData: async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (!data.orders || !Array.isArray(data.orders)) return false;

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const dbRows = data.orders.map((o: Order) => ({
        ...orderToDb({ ...o, userId: user.id } as Order & { userId: string }),
        user_id: user.id,
      }));

      const { error } = await supabase.from('orders').insert(dbRows);
      if (error) return false;

      await get().fetchOrders();
      return true;
    } catch {
      return false;
    }
  },
}));
