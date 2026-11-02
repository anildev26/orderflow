import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { collapseReviewerName, reviewerNameKey, type ReviewerRecord } from '@/lib/reviewers';

interface ReviewerStore {
  reviewers: ReviewerRecord[];
  loaded: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  addReviewer: (input: { name: string; nameKey: string }) => Promise<ReviewerRecord>;
  updateReviewer: (id: string, input: { name: string; nameKey: string }) => Promise<void>;
  deleteReviewer: (id: string) => Promise<void>;
}

function mapRow(row: Record<string, unknown>): ReviewerRecord {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    nameKey: (row.name_key as string) || reviewerNameKey((row.name as string) || ''),
  };
}

async function fetchRows(): Promise<ReviewerRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reviewers')
    .select('id, name, name_key')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

let inflight: Promise<void> | null = null;

export const useReviewerStore = create<ReviewerStore>()((set, get) => ({
  reviewers: [],
  loaded: false,

  ensureLoaded: () => {
    if (get().loaded) return Promise.resolve();
    if (inflight) return inflight;
    inflight = get().refresh().finally(() => { inflight = null; });
    return inflight;
  },

  refresh: async () => {
    const reviewers = await fetchRows();
    set({ reviewers, loaded: true });
  },

  addReviewer: async (input) => {
    const supabase = createClient();
    const name = collapseReviewerName(input.name);
    const { data, error } = await supabase
      .from('reviewers')
      .insert({
        name,
        name_key: input.nameKey || reviewerNameKey(name),
      })
      .select('id, name, name_key')
      .single();
    if (error) throw new Error(error.message);
    const created = mapRow(data as Record<string, unknown>);
    set((state) => ({ reviewers: [...state.reviewers, created].sort((a, b) => a.name.localeCompare(b.name)) }));
    return created;
  },

  updateReviewer: async (id, input) => {
    const supabase = createClient();
    const name = collapseReviewerName(input.name);
    const nameKey = input.nameKey || reviewerNameKey(name);
    const { error } = await supabase
      .from('reviewers')
      .update({ name, name_key: nameKey })
      .eq('id', id);
    if (error) throw new Error(error.message);
    set((state) => ({
      reviewers: state.reviewers
        .map((r) => r.id === id ? { ...r, name, nameKey } : r)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  deleteReviewer: async (id) => {
    const supabase = createClient();
    const { error } = await supabase.from('reviewers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((state) => ({ reviewers: state.reviewers.filter((r) => r.id !== id) }));
  },
}));
