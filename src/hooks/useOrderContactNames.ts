'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useOrderStore } from '@/store/useOrderStore';

export interface OrderContactNames {
  mediatorNames: string[];
  reviewerNames: string[];
}

const EMPTY_NAMES: OrderContactNames = { mediatorNames: [], reviewerNames: [] };

let cached: OrderContactNames | null = null;
let inflight: Promise<OrderContactNames> | null = null;

function namesFromOrders(orders: { mediatorName?: string | null; reviewerName?: string | null }[]): OrderContactNames {
  return {
    mediatorNames: orders.map((order) => order.mediatorName || ''),
    reviewerNames: orders.map((order) => order.reviewerName || ''),
  };
}

function fetchOrderContactNames(): Promise<OrderContactNames> {
  const state = useOrderStore.getState();
  if (state.initialized) return Promise.resolve(namesFromOrders(state.orders));
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('orders')
      .select('mediator_name, reviewer_name')
      .order('order_date', { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { mediator_name?: string | null; reviewer_name?: string | null }[];
    const names: OrderContactNames = {
      mediatorNames: rows.map((row) => row.mediator_name || ''),
      reviewerNames: rows.map((row) => row.reviewer_name || ''),
    };
    cached = names;
    return names;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function useOrderContactNames(): OrderContactNames {
  const initialized = useOrderStore((s) => s.initialized);
  const orders = useOrderStore((s) => s.orders);
  const [fetched, setFetched] = useState<OrderContactNames | null>(null);

  useEffect(() => {
    if (initialized) return;
    let cancelled = false;
    fetchOrderContactNames()
      .then((names) => {
        if (!cancelled) setFetched(names);
      })
      .catch(() => {
        if (!cancelled) setFetched(EMPTY_NAMES);
      });
    return () => {
      cancelled = true;
    };
  }, [initialized]);

  return useMemo(() => {
    if (initialized) return namesFromOrders(orders);
    const fromStore = namesFromOrders(orders);
    if (!fetched) return fromStore.mediatorNames.length === 0 && fromStore.reviewerNames.length === 0
      ? EMPTY_NAMES
      : fromStore;
    if (fromStore.mediatorNames.length === 0 && fromStore.reviewerNames.length === 0) return fetched;
    // Orders added in this session sit in front of the column fetch so a name
    // just saved on the form is suggested before the next full reload.
    return {
      mediatorNames: [...fromStore.mediatorNames, ...fetched.mediatorNames],
      reviewerNames: [...fromStore.reviewerNames, ...fetched.reviewerNames],
    };
  }, [initialized, orders, fetched]);
}
