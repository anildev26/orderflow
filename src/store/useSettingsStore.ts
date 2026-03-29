import { create } from 'zustand';
import { createClient } from '@/lib/supabase';

const DEFAULT_PLATFORMS = [
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'myntra', label: 'Myntra' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'ajio', label: 'Ajio' },
  { value: 'blinkit', label: 'Blinkit' },
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

    if (!data) {
      set({ initialized: true });
      return;
    }

    set({
      initialized: true,
      platforms: Array.isArray(data.platforms) && data.platforms.length > 0 ? data.platforms : DEFAULT_PLATFORMS,
      mediators: Array.isArray(data.mediators) ? data.mediators : DEFAULT_MEDIATORS,
      reviewers: Array.isArray(data.reviewers) ? data.reviewers : DEFAULT_REVIEWERS,
      banks: Array.isArray(data.banks) ? data.banks : DEFAULT_BANKS,
      orderTypes: Array.isArray(data.order_types) ? data.order_types : DEFAULT_ORDER_TYPES,
    });
  },

  saveSettings: async (platforms, mediators, reviewers, banks, orderTypes) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { console.error('saveSettings: No user found'); return; }

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          platforms,
          mediators,
          reviewers,
          banks,
          order_types: orderTypes,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('saveSettings error:', error);
    } else {
      set({ platforms, mediators, reviewers, banks, orderTypes });
    }
  },
}));
