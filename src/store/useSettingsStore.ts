import { create } from 'zustand';
import { createClient } from '@/lib/supabase';

const DEFAULT_PLATFORMS = [
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'myntra', label: 'Myntra' },
];

const DEFAULT_MEDIATORS: string[] = [];

const DEFAULT_REVIEWERS: string[] = [];

const DEFAULT_BANKS: string[] = [];

const DEFAULT_ORDER_TYPES = ['Rating', 'Review'];

interface SettingsStore {
  platforms: { value: string; label: string }[];
  mediators: string[];
  reviewers: string[];
  banks: string[];
  orderTypes: string[];
  initialized: boolean;
  fetchSettings: () => Promise<void>;
  saveSettings: (platforms: { value: string; label: string }[], mediators: string[], reviewers: string[], banks: string[], orderTypes: string[]) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  platforms: DEFAULT_PLATFORMS,
  mediators: DEFAULT_MEDIATORS,
  reviewers: DEFAULT_REVIEWERS,
  banks: DEFAULT_BANKS,
  orderTypes: DEFAULT_ORDER_TYPES,
  initialized: false,

  fetchSettings: async () => {
    if (get().initialized) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ initialized: true }); return; }

    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const updates: Partial<SettingsStore> = { initialized: true };

    if (data?.platforms) {
      try {
        const platforms = typeof data.platforms === 'string' ? JSON.parse(data.platforms) : data.platforms;
        if (Array.isArray(platforms) && platforms.length > 0) updates.platforms = platforms;
      } catch { /* fallback */ }
    }

    if (data?.mediators) {
      try {
        const mediators = typeof data.mediators === 'string' ? JSON.parse(data.mediators) : data.mediators;
        if (Array.isArray(mediators) && mediators.length > 0) updates.mediators = mediators;
      } catch { /* fallback */ }
    }

    if (data?.reviewers) {
      try {
        const reviewers = typeof data.reviewers === 'string' ? JSON.parse(data.reviewers) : data.reviewers;
        if (Array.isArray(reviewers) && reviewers.length > 0) updates.reviewers = reviewers;
      } catch { /* fallback */ }
    }

    if (data?.banks) {
      try {
        const banks = typeof data.banks === 'string' ? JSON.parse(data.banks) : data.banks;
        if (Array.isArray(banks) && banks.length > 0) updates.banks = banks;
      } catch { /* fallback */ }
    }

    if (data?.order_types) {
      try {
        const orderTypes = typeof data.order_types === 'string' ? JSON.parse(data.order_types) : data.order_types;
        if (Array.isArray(orderTypes) && orderTypes.length > 0) updates.orderTypes = orderTypes;
      } catch { /* fallback */ }
    }

    set(updates);
  },

  saveSettings: async (platforms, mediators, reviewers, banks, orderTypes) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          platforms: JSON.stringify(platforms),
          mediators: JSON.stringify(mediators),
          reviewers: JSON.stringify(reviewers),
          banks: JSON.stringify(banks),
          order_types: JSON.stringify(orderTypes),
        },
        { onConflict: 'user_id' }
      );

    if (!error) {
      set({ platforms, mediators, reviewers, banks, orderTypes });
    }
  },
}));
