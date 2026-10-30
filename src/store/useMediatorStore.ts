import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { collapseMediatorName, mediatorNameKey, type MediatorRecord } from '@/lib/mediators';

interface MediatorStore {
  mediators: MediatorRecord[];
  loaded: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  addMediator: (input: { name: string; nameKey: string; phoneNormalized: string; phoneDisplay: string }) => Promise<MediatorRecord>;
  updateMediator: (id: string, input: { name: string; nameKey: string; phoneNormalized: string; phoneDisplay: string }) => Promise<void>;
  deleteMediator: (id: string) => Promise<void>;
}

function mapRow(row: Record<string, unknown>): MediatorRecord {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    nameKey: (row.name_key as string) || mediatorNameKey((row.name as string) || ''),
    phoneDisplay: (row.phone_display as string) || '',
    phoneNormalized: (row.phone_normalized as string) || '',
  };
}

async function fetchRows(): Promise<MediatorRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('mediators')
    .select('id, name, name_key, phone_display, phone_normalized')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

let inflight: Promise<void> | null = null;

export const useMediatorStore = create<MediatorStore>()((set, get) => ({
  mediators: [],
  loaded: false,

  ensureLoaded: () => {
    if (get().loaded) return Promise.resolve();
    if (inflight) return inflight;
    inflight = get().refresh().finally(() => { inflight = null; });
    return inflight;
  },

  refresh: async () => {
    const mediators = await fetchRows();
    set({ mediators, loaded: true });
  },

  addMediator: async (input) => {
    const supabase = createClient();
    const name = collapseMediatorName(input.name);
    const { data, error } = await supabase
      .from('mediators')
      .insert({
        name,
        name_key: input.nameKey || mediatorNameKey(name),
        phone_normalized: input.phoneNormalized,
        phone_display: input.phoneDisplay || null,
      })
      .select('id, name, name_key, phone_display, phone_normalized')
      .single();
    if (error) throw new Error(error.message);
    const created = mapRow(data as Record<string, unknown>);
    set((state) => ({ mediators: [...state.mediators, created].sort((a, b) => a.name.localeCompare(b.name)) }));
    return created;
  },

  updateMediator: async (id, input) => {
    const supabase = createClient();
    const name = collapseMediatorName(input.name);
    const { error } = await supabase
      .from('mediators')
      .update({
        name,
        name_key: input.nameKey || mediatorNameKey(name),
        phone_normalized: input.phoneNormalized,
        phone_display: input.phoneDisplay || null,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    set((state) => ({
      mediators: state.mediators
        .map((m) => m.id === id ? {
          ...m,
          name,
          nameKey: input.nameKey || mediatorNameKey(name),
          phoneNormalized: input.phoneNormalized,
          phoneDisplay: input.phoneDisplay,
        } : m)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  deleteMediator: async (id) => {
    const supabase = createClient();
    const { error } = await supabase.from('mediators').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((state) => ({ mediators: state.mediators.filter((m) => m.id !== id) }));
  },
}));
