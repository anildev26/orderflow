import { create } from 'zustand';
import { createClient } from '@/lib/supabase';

export const ADMIN_EMAIL = 'anilsahu2672000@gmail.com';

export interface FeatureRequest {
  id: string;
  userId: string;
  userEmail: string;
  content: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  userVote: 'like' | 'dislike' | null;
  completed: boolean;
  adminComment: string | null;
}

interface FeatureRequestStore {
  requests: FeatureRequest[];
  loading: boolean;
  initialized: boolean;
  fetchRequests: () => Promise<void>;
  addRequest: (content: string) => Promise<void>;
  vote: (requestId: string, vote: 'like' | 'dislike') => Promise<void>;
  deleteRequest: (requestId: string) => Promise<void>;
  adminMarkCompleted: (requestId: string, completed: boolean) => Promise<void>;
  adminSetComment: (requestId: string, comment: string) => Promise<void>;
}

export const useFeatureRequestStore = create<FeatureRequestStore>((set, get) => ({
  requests: [],
  loading: false,
  initialized: false,

  fetchRequests: async () => {
    set({ loading: true });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: requests, error } = await supabase
      .from('feature_requests')
      .select('id, user_id, user_email, content, created_at, likes, dislikes, completed, admin_comment')
      .order('created_at', { ascending: false });

    if (error || !requests) {
      set({ loading: false, initialized: true });
      return;
    }

    let myVotes: Record<string, 'like' | 'dislike'> = {};
    if (user) {
      const { data: votes } = await supabase
        .from('feature_votes')
        .select('request_id, vote')
        .eq('user_id', user.id);
      if (votes) {
        votes.forEach((v) => { myVotes[v.request_id] = v.vote as 'like' | 'dislike'; });
      }
    }

    const mapped: FeatureRequest[] = requests.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      content: r.content,
      createdAt: r.created_at,
      likes: r.likes ?? 0,
      dislikes: r.dislikes ?? 0,
      userVote: myVotes[r.id] ?? null,
      completed: r.completed ?? false,
      adminComment: r.admin_comment ?? null,
    }));

    set({ requests: mapped, loading: false, initialized: true });
  },

  addRequest: async (content: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('feature_requests')
      .insert({ content, user_id: user.id, user_email: user.email })
      .select('id, user_id, user_email, content, created_at, likes, dislikes, completed, admin_comment')
      .single();

    if (error) throw new Error(error.message);

    const newRequest: FeatureRequest = {
      id: data.id,
      userId: data.user_id,
      userEmail: data.user_email,
      content: data.content,
      createdAt: data.created_at,
      likes: data.likes ?? 0,
      dislikes: data.dislikes ?? 0,
      userVote: null,
      completed: false,
      adminComment: null,
    };

    set((s) => ({ requests: [newRequest, ...s.requests] }));
  },

  vote: async (requestId: string, vote: 'like' | 'dislike') => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const current = get().requests.find((r) => r.id === requestId);
    if (!current) return;
    const prevVote = current.userVote;

    set((s) => ({
      requests: s.requests.map((r) => {
        if (r.id !== requestId) return r;
        let likes = r.likes;
        let dislikes = r.dislikes;
        let userVote: 'like' | 'dislike' | null = vote;
        if (prevVote === vote) {
          if (vote === 'like') likes = Math.max(0, likes - 1);
          else dislikes = Math.max(0, dislikes - 1);
          userVote = null;
        } else {
          if (prevVote === 'like') likes = Math.max(0, likes - 1);
          if (prevVote === 'dislike') dislikes = Math.max(0, dislikes - 1);
          if (vote === 'like') likes += 1;
          else dislikes += 1;
        }
        return { ...r, likes, dislikes, userVote };
      }),
    }));

    if (prevVote === vote) {
      await supabase.from('feature_votes').delete().eq('user_id', user.id).eq('request_id', requestId);
    } else {
      await supabase.from('feature_votes').upsert({ user_id: user.id, request_id: requestId, vote }, { onConflict: 'user_id,request_id' });
    }
    await supabase.rpc('update_vote_counts', { p_request_id: requestId });
  },

  deleteRequest: async (requestId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('feature_requests').delete().eq('id', requestId);
    if (error) throw new Error(error.message);
    set((s) => ({ requests: s.requests.filter((r) => r.id !== requestId) }));
  },

  adminMarkCompleted: async (requestId: string, completed: boolean) => {
    const supabase = createClient();
    await supabase.rpc('admin_mark_completed', { p_request_id: requestId, p_completed: completed });
    set((s) => ({
      requests: s.requests.map((r) => r.id === requestId ? { ...r, completed } : r),
    }));
  },

  adminSetComment: async (requestId: string, comment: string) => {
    const supabase = createClient();
    await supabase.rpc('admin_set_comment', { p_request_id: requestId, p_comment: comment });
    set((s) => ({
      requests: s.requests.map((r) => r.id === requestId ? { ...r, adminComment: comment || null } : r),
    }));
  },
}));
