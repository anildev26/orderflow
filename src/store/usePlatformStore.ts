import { create } from 'zustand';
import { createClient } from '@/lib/supabase';

export const ADMIN_EMAIL = 'anilsahu2672000@gmail.com';

export interface GlobalPlatform {
  id: string;
  value: string;
  label: string;
  active: boolean;
  sortOrder: number;
}

// Fallback list shown while DB loads
const FALLBACK: GlobalPlatform[] = [
  { id: 'f1', value: 'flipkart', label: 'Flipkart', active: true, sortOrder: 1 },
  { id: 'f2', value: 'amazon',   label: 'Amazon',   active: true, sortOrder: 2 },
  { id: 'f3', value: 'myntra',   label: 'Myntra',   active: true, sortOrder: 3 },
  { id: 'f4', value: 'meesho',   label: 'Meesho',   active: true, sortOrder: 4 },
  { id: 'f5', value: 'ajio',     label: 'Ajio',     active: true, sortOrder: 5 },
  { id: 'f6', value: 'blinkit',  label: 'Blinkit',  active: true, sortOrder: 6 },
  { id: 'f7', value: 'shopsy',   label: 'Shopsy',   active: true, sortOrder: 7 },
  { id: 'f8', value: 'nykaa',    label: 'Nykaa',    active: true, sortOrder: 8 },
];

function dbRow(row: Record<string, unknown>): GlobalPlatform {
  return {
    id:        row.id as string,
    value:     row.value as string,
    label:     row.label as string,
    active:    row.active as boolean,
    sortOrder: Number(row.sort_order) || 0,
  };
}

interface PlatformStore {
  platforms: GlobalPlatform[];
  initialized: boolean;
  fetchPlatforms: () => Promise<void>;
  refetch: () => Promise<void>;
  // Admin mutations
  addPlatform:    (value: string, label: string) => Promise<void>;
  toggleActive:   (id: string, active: boolean) => Promise<void>;
  updateLabel:    (id: string, label: string) => Promise<void>;
  deletePlatform: (id: string) => Promise<void>;
}

export const usePlatformStore = create<PlatformStore>()((set, get) => ({
  platforms: FALLBACK,
  initialized: false,

  fetchPlatforms: async () => {
    if (get().initialized) return;
    await get().refetch();
  },

  refetch: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('global_platforms')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      set({ platforms: data.map(dbRow), initialized: true });
    }
  },

  addPlatform: async (value, label) => {
    const supabase = createClient();
    const maxOrder = Math.max(0, ...get().platforms.map((p) => p.sortOrder));
    const { data, error } = await supabase
      .from('global_platforms')
      .insert({ value: value.toLowerCase().trim(), label: label.trim(), active: true, sort_order: maxOrder + 1 })
      .select()
      .single();

    if (error) throw new Error(error.message);
    set((s) => ({ platforms: [...s.platforms, dbRow(data)] }));
  },

  toggleActive: async (id, active) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('global_platforms')
      .update({ active })
      .eq('id', id);

    if (error) throw new Error(error.message);
    set((s) => ({
      platforms: s.platforms.map((p) => p.id === id ? { ...p, active } : p),
    }));
  },

  updateLabel: async (id, label) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('global_platforms')
      .update({ label: label.trim() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    set((s) => ({
      platforms: s.platforms.map((p) => p.id === id ? { ...p, label } : p),
    }));
  },

  deletePlatform: async (id) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('global_platforms')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    set((s) => ({ platforms: s.platforms.filter((p) => p.id !== id) }));
  },
}));
