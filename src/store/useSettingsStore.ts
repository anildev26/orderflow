import { create } from 'zustand';
import { createClient } from '@/lib/supabase';

// All platforms available in the system — used for the platform manager
export const ALL_PLATFORMS: { value: string; label: string }[] = [
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'myntra', label: 'Myntra' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'ajio', label: 'Ajio' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'shopsy', label: 'Shopsy' },
  { value: 'nykaa', label: 'Nykaa' },
];

// Default enabled platforms for new users
const DEFAULT_PLATFORMS: { value: string; label: string }[] = [
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'myntra', label: 'Myntra' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'ajio', label: 'Ajio' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'shopsy', label: 'Shopsy' },
  { value: 'nykaa', label: 'Nykaa' },
];

const DEFAULT_ORDER_TYPES = ['Rating', 'Review', 'Empty Box'];

interface SettingsStore {
  platforms: { value: string; label: string }[];
  orderTypes: string[];
  initialized: boolean;
  fetchSettings: () => Promise<void>;
  savePlatforms: (platforms: { value: string; label: string }[]) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  platforms: DEFAULT_PLATFORMS,
  orderTypes: DEFAULT_ORDER_TYPES,
  initialized: false,

  fetchSettings: async () => {
    if (get().initialized) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ initialized: true }); return; }

    const { data } = await supabase
      .from('user_settings')
      .select('platforms, order_types')
      .eq('user_id', user.id)
      .single();

    if (!data) { set({ initialized: true }); return; }

    set({
      initialized: true,
      platforms: Array.isArray(data.platforms) && data.platforms.length > 0 ? data.platforms : DEFAULT_PLATFORMS,
      orderTypes: Array.isArray(data.order_types) && data.order_types.length > 0 ? data.order_types : DEFAULT_ORDER_TYPES,
    });
  },

  savePlatforms: async (platforms) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, platforms }, { onConflict: 'user_id' });

    set({ platforms });
  },
}));
