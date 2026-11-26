import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { ADMIN_EMAIL } from '@/store/usePlatformStore';
import {
  DEFAULT_SETTINGS,
  LIMITS,
  cleanText,
  friendlyError,
  isDuplicateError,
  isMissingSchemaError,
  makeTitle,
  validateLength,
  validateRequestText,
  type AdminThread,
  type AreaId,
  type Availability,
  type BoardSettings,
  type DevMessage,
  type FeatureRequest,
  type Priority,
  type RequestComment,
  type RequestPerson,
  type RequestStatus,
  type StatusEvent,
} from '@/lib/featureRequests';

export { ADMIN_EMAIL };

const REQUEST_COLS =
  'id, user_id, user_email_masked, title, content, details, area, status, status_note, shipped_version, exists_feature, merged_into, likes, created_at, last_update_at';
const COMMENT_COLS = 'id, request_id, user_id, author_label, is_admin, body, created_at';
const EVENT_COLS = 'id, request_id, status, note, created_at';
const MESSAGE_COLS = 'id, thread_user_id, from_admin, thread_label, body, page, request_id, read_by_user, read_by_admin, created_at';
const SETTINGS_COLS = 'availability, away_note, whatsapp_enabled, telegram_enabled, inapp_enabled, call_url';
const TRENDING_WINDOW_DAYS = 14;

type Row = Record<string, unknown>;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

function toRequest(r: Row): FeatureRequest {
  const content = str(r.content);
  return {
    id: str(r.id),
    userId: str(r.user_id),
    userEmailMasked: str(r.user_email_masked),
    title: str(r.title) || makeTitle(content),
    content,
    details: strOrNull(r.details),
    area: strOrNull(r.area) as AreaId | null,
    status: (strOrNull(r.status) ?? 'new') as RequestStatus,
    statusNote: strOrNull(r.status_note),
    shippedVersion: strOrNull(r.shipped_version),
    existsFeature: strOrNull(r.exists_feature),
    mergedInto: strOrNull(r.merged_into),
    likes: Math.max(0, num(r.likes)),
    createdAt: str(r.created_at),
    lastUpdateAt: strOrNull(r.last_update_at),
  };
}

function toComment(r: Row): RequestComment {
  return {
    id: str(r.id),
    requestId: str(r.request_id),
    userId: str(r.user_id),
    authorLabel: str(r.author_label, 'user'),
    isAdmin: r.is_admin === true,
    body: str(r.body),
    createdAt: str(r.created_at),
  };
}

function toEvent(r: Row): StatusEvent {
  return {
    id: str(r.id),
    requestId: str(r.request_id),
    status: (strOrNull(r.status) ?? 'new') as RequestStatus,
    note: strOrNull(r.note),
    createdAt: str(r.created_at),
  };
}

function toMessage(r: Row): DevMessage {
  return {
    id: str(r.id),
    threadUserId: str(r.thread_user_id),
    fromAdmin: r.from_admin === true,
    threadLabel: str(r.thread_label),
    body: str(r.body),
    page: strOrNull(r.page),
    requestId: strOrNull(r.request_id),
    readByUser: r.read_by_user === true,
    readByAdmin: r.read_by_admin === true,
    createdAt: str(r.created_at),
  };
}

function toSettings(r: Row | null): BoardSettings {
  if (!r) return DEFAULT_SETTINGS;
  const availability = str(r.availability);
  return {
    availability: (['available', 'busy', 'away'].includes(availability) ? availability : 'available') as Availability,
    awayNote: strOrNull(r.away_note),
    whatsappEnabled: r.whatsapp_enabled !== false,
    telegramEnabled: r.telegram_enabled !== false,
    inappEnabled: r.inapp_enabled !== false,
    callUrl: strOrNull(r.call_url),
  };
}

/** Log the real error for debugging; give the UI a message a person can act on. */
function fail(err: unknown, context: string): never {
  console.error(`[feature-requests] ${context}`, err);
  throw new Error(friendlyError(err));
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'needs_upgrade';

interface FeatureRequestStore {
  status: LoadStatus;
  loadError: string | null;
  userId: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  requests: FeatureRequest[];
  /** requestId → when I said Me too */
  myVotes: Record<string, string>;
  /** requestId → Me toos in the last 14 days */
  recentVotes: Record<string, number>;
  /** requestId → when I last opened it */
  seen: Record<string, string>;
  commentCounts: Record<string, number>;
  myReasons: Record<string, string>;
  settings: BoardSettings;
  myMessages: DevMessage[];
  comments: Record<string, RequestComment[]>;
  events: Record<string, StatusEvent[]>;
  pendingVotes: Record<string, boolean>;
  // admin
  priorities: Record<string, Priority>;
  people: Record<string, RequestPerson[]>;
  threads: AdminThread[];
  threadMessages: Record<string, DevMessage[]>;

  load: (opts?: { silent?: boolean }) => Promise<void>;
  submitRequest: (input: { text: string; details: string; area: AreaId | null; contactOk: boolean }) => Promise<FeatureRequest>;
  toggleVote: (requestId: string) => Promise<boolean>;
  saveReason: (requestId: string, reason: string) => Promise<void>;
  deleteRequest: (requestId: string) => Promise<void>;
  loadDetail: (requestId: string) => Promise<void>;
  addComment: (requestId: string, body: string) => Promise<void>;
  deleteComment: (requestId: string, commentId: string) => Promise<void>;
  markSeen: (requestId: string) => Promise<void>;
  sendMessage: (body: string, ctx: { page: string; requestId: string | null }) => Promise<void>;
  refreshMyMessages: () => Promise<void>;
  markMyMessagesRead: () => Promise<void>;
  // admin
  setStatus: (requestId: string, status: RequestStatus, note: string, version: string, feature: string | null) => Promise<void>;
  merge: (sourceId: string, targetId: string) => Promise<void>;
  setPriority: (requestId: string, priority: Priority | null) => Promise<void>;
  loadPeople: (requestId: string) => Promise<void>;
  loadThreads: () => Promise<void>;
  loadThread: (threadUserId: string) => Promise<void>;
  replyToThread: (threadUserId: string, body: string, requestId?: string | null) => Promise<void>;
  updateSettings: (patch: Partial<BoardSettings>) => Promise<void>;
}

let loadToken = 0;

export const useFeatureRequestStore = create<FeatureRequestStore>((set, get) => ({
  status: 'idle',
  loadError: null,
  userId: null,
  userEmail: null,
  isAdmin: false,
  requests: [],
  myVotes: {},
  recentVotes: {},
  seen: {},
  commentCounts: {},
  myReasons: {},
  settings: DEFAULT_SETTINGS,
  myMessages: [],
  comments: {},
  events: {},
  pendingVotes: {},
  priorities: {},
  people: {},
  threads: [],
  threadMessages: {},

  load: async (opts) => {
    const token = ++loadToken;
    if (!opts?.silent) set({ status: 'loading', loadError: null });
    try {
      const supabase = createClient();
      // The session is already in the browser, so reading it costs no network round trip.
      // Every query below is still checked by the database (RLS) against the signed-in user.
      const { data: sessionData } = await supabase.auth.getSession();
      let authUser = sessionData.session?.user ?? null;
      if (!authUser) {
        const { data: fresh } = await supabase.auth.getUser();
        authUser = fresh.user ?? null;
      }
      if (!authUser) {
        set({ status: 'error', loadError: 'Your session has expired. Refresh the page or sign in again.' });
        return;
      }
      const uid = authUser.id;
      const email = authUser.email ?? '';
      const isAdmin = email === ADMIN_EMAIL;
      const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 86_400_000).toISOString();
      const empty = Promise.resolve({ data: [] as Row[], error: null });

      // Start everything at once. The list appears as soon as the two queries it needs
      // are back; counts, dots, settings and messages fill in right after.
      const reqP = supabase.from('feature_requests').select(REQUEST_COLS).order('created_at', { ascending: false }).limit(2000);
      const myVotesP = supabase.from('feature_votes').select('request_id, created_at').eq('user_id', uid);
      const secondaryP = Promise.all([
        supabase.from('feature_votes').select('request_id').gte('created_at', since).limit(10000),
        supabase.from('feature_seen').select('request_id, seen_at').eq('user_id', uid),
        supabase.from('feature_comments').select('request_id').limit(20000),
        supabase.from('feature_request_reasons').select('request_id, reason').eq('user_id', uid),
        supabase.from('feature_board_settings').select(SETTINGS_COLS).eq('id', 1).maybeSingle(),
        isAdmin
          ? empty
          : supabase.from('feature_messages').select(MESSAGE_COLS).eq('thread_user_id', uid).order('created_at', { ascending: true }).limit(500),
        isAdmin ? supabase.from('feature_admin_meta').select('request_id, priority') : empty,
      ]);

      const [reqRes, myVotesRes] = await Promise.all([reqP, myVotesP]);
      if (token !== loadToken) return;
      if ([reqRes, myVotesRes].some((r) => r.error && isMissingSchemaError(r.error))) {
        console.error('[feature-requests] database not upgraded', reqRes.error ?? myVotesRes.error);
        set({ status: 'needs_upgrade', loadError: null, userId: uid, userEmail: email, isAdmin });
        return;
      }
      if (reqRes.error) fail(reqRes.error, 'load requests');
      if (myVotesRes.error) console.error('[feature-requests] my votes failed', myVotesRes.error);

      const myVotes: Record<string, string> = {};
      for (const v of (myVotesRes.data ?? []) as Row[]) myVotes[str(v.request_id)] = str(v.created_at);
      set({
        status: 'ready',
        loadError: null,
        userId: uid,
        userEmail: email,
        isAdmin,
        requests: ((reqRes.data ?? []) as Row[]).map(toRequest),
        myVotes,
      });

      const [recentRes, seenRes, countsRes, reasonsRes, settingsRes, msgRes, prioRes] = await secondaryP;
      if (token !== loadToken) return;
      const secondary = [recentRes, seenRes, countsRes, reasonsRes, settingsRes, msgRes, prioRes];
      if (secondary.some((r) => r.error && isMissingSchemaError(r.error))) {
        console.error('[feature-requests] database not upgraded', secondary.map((r) => r.error).filter(Boolean));
        set({ status: 'needs_upgrade' });
        return;
      }
      // Secondary data: keep what we had if one of these fails, and log it.
      for (const r of secondary) if (r.error) console.error('[feature-requests] secondary load failed', r.error);

      const patch: Partial<FeatureRequestStore> = {};
      if (!recentRes.error) {
        const recentVotes: Record<string, number> = {};
        for (const v of (recentRes.data ?? []) as Row[]) {
          const id = str(v.request_id);
          recentVotes[id] = (recentVotes[id] ?? 0) + 1;
        }
        patch.recentVotes = recentVotes;
      }
      if (!seenRes.error) {
        const seen: Record<string, string> = {};
        for (const x of (seenRes.data ?? []) as Row[]) seen[str(x.request_id)] = str(x.seen_at);
        patch.seen = seen;
      }
      if (!countsRes.error) {
        const commentCounts: Record<string, number> = {};
        for (const c of (countsRes.data ?? []) as Row[]) {
          const id = str(c.request_id);
          commentCounts[id] = (commentCounts[id] ?? 0) + 1;
        }
        patch.commentCounts = commentCounts;
      }
      if (!reasonsRes.error) {
        const myReasons: Record<string, string> = {};
        for (const r of (reasonsRes.data ?? []) as Row[]) myReasons[str(r.request_id)] = str(r.reason);
        patch.myReasons = myReasons;
      }
      if (!settingsRes.error) patch.settings = toSettings((settingsRes.data as Row | null) ?? null);
      if (!msgRes.error) patch.myMessages = ((msgRes.data ?? []) as Row[]).map(toMessage);
      if (!prioRes.error) {
        const priorities: Record<string, Priority> = {};
        for (const x of (prioRes.data ?? []) as Row[]) {
          const pr = str(x.priority);
          if (pr === 'nice' || pr === 'important' || pr === 'must') priorities[str(x.request_id)] = pr;
        }
        patch.priorities = priorities;
      }
      set(patch);
    } catch (err) {
      if (token !== loadToken) return;
      console.error('[feature-requests] load failed', err);
      if (isMissingSchemaError(err)) {
        set({ status: 'needs_upgrade', loadError: null });
      } else if (!opts?.silent || get().status !== 'ready') {
        set({ status: 'error', loadError: err instanceof Error ? err.message : friendlyError(err) });
      }
    }
  },

  submitRequest: async ({ text, details, area, contactOk }) => {
    const { userId, userEmail, requests } = get();
    if (!userId) throw new Error('Your session has expired. Refresh the page or sign in again.');
    const problem = validateRequestText(text);
    if (problem) throw new Error(problem);
    const cleanDetails = cleanText(details);
    if (cleanDetails.length > LIMITS.detailsMax) throw new Error(`Keep the details under ${LIMITS.detailsMax} characters.`);
    const content = cleanText(text);

    // Guard against a double tap or a retry after a slow network.
    const title = makeTitle(content).toLowerCase();
    const recentDuplicate = requests.find(
      (r) => r.userId === userId && r.title.toLowerCase() === title && Date.now() - Date.parse(r.createdAt) < 10 * 60_000,
    );
    if (recentDuplicate) throw new Error('You just posted this request. It is in the list below.');

    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_requests')
      .insert({
        user_id: userId,
        user_email: userEmail ?? '',
        content,
        details: cleanDetails || null,
        area,
        contact_ok: contactOk,
      })
      .select(REQUEST_COLS)
      .single();
    if (error || !data) fail(error ?? new Error('no row'), 'submit request');

    let created = toRequest(data as Row);
    // The server adds the poster's own Me too right after insert; read the final count.
    const { data: fresh } = await supabase.from('feature_requests').select(REQUEST_COLS).eq('id', created.id).maybeSingle();
    if (fresh) created = toRequest(fresh as Row);
    if (created.likes < 1) created = { ...created, likes: 1 };

    const now = new Date().toISOString();
    set((s) => ({
      requests: [created, ...s.requests.filter((r) => r.id !== created.id)],
      myVotes: { ...s.myVotes, [created.id]: now },
      recentVotes: { ...s.recentVotes, [created.id]: (s.recentVotes[created.id] ?? 0) + 1 },
      seen: { ...s.seen, [created.id]: now },
    }));
    return created;
  },

  toggleVote: async (requestId) => {
    const { userId, pendingVotes, myVotes, requests } = get();
    if (!userId) throw new Error('Your session has expired. Refresh the page or sign in again.');
    if (pendingVotes[requestId]) return Boolean(myVotes[requestId]);
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error('This request no longer exists. Refresh the page.');
    const wasVoted = Boolean(myVotes[requestId]);
    const prevLikes = req.likes;
    const prevVoteAt = myVotes[requestId];
    const now = new Date().toISOString();

    set((s) => {
      const nextVotes = { ...s.myVotes };
      if (wasVoted) delete nextVotes[requestId];
      else nextVotes[requestId] = now;
      return {
        pendingVotes: { ...s.pendingVotes, [requestId]: true },
        myVotes: nextVotes,
        requests: s.requests.map((r) => (r.id === requestId ? { ...r, likes: Math.max(0, r.likes + (wasVoted ? -1 : 1)) } : r)),
        recentVotes: { ...s.recentVotes, [requestId]: Math.max(0, (s.recentVotes[requestId] ?? 0) + (wasVoted ? -1 : 1)) },
      };
    });

    const supabase = createClient();
    try {
      if (wasVoted) {
        const { error } = await supabase.from('feature_votes').delete().eq('user_id', userId).eq('request_id', requestId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feature_votes').insert({ user_id: userId, request_id: requestId });
        if (error && !isDuplicateError(error)) throw error;
      }
      // Reconcile with the server's count (other people may have voted meanwhile).
      const { data } = await supabase.from('feature_requests').select('likes').eq('id', requestId).maybeSingle();
      set((s) => {
        const pending = { ...s.pendingVotes };
        delete pending[requestId];
        return {
          pendingVotes: pending,
          requests: data
            ? s.requests.map((r) => (r.id === requestId ? { ...r, likes: Math.max(0, num((data as Row).likes)) } : r))
            : s.requests,
        };
      });
      return !wasVoted;
    } catch (err) {
      set((s) => {
        const pending = { ...s.pendingVotes };
        delete pending[requestId];
        const votes = { ...s.myVotes };
        if (wasVoted && prevVoteAt) votes[requestId] = prevVoteAt;
        else delete votes[requestId];
        return {
          pendingVotes: pending,
          myVotes: votes,
          requests: s.requests.map((r) => (r.id === requestId ? { ...r, likes: prevLikes } : r)),
          recentVotes: { ...s.recentVotes, [requestId]: Math.max(0, (s.recentVotes[requestId] ?? 0) + (wasVoted ? 1 : -1)) },
        };
      });
      fail(err, 'toggle vote');
    }
  },

  saveReason: async (requestId, reason) => {
    const { userId } = get();
    if (!userId) throw new Error('Your session has expired. Refresh the page or sign in again.');
    const clean = cleanText(reason);
    const supabase = createClient();
    if (!clean) {
      const { error } = await supabase.from('feature_request_reasons').delete().eq('request_id', requestId).eq('user_id', userId);
      if (error) fail(error, 'clear reason');
      set((s) => {
        const next = { ...s.myReasons };
        delete next[requestId];
        return { myReasons: next };
      });
      return;
    }
    const problem = validateLength(clean, LIMITS.reasonMax, 'Write a reason first.');
    if (problem) throw new Error(problem);
    const { error } = await supabase
      .from('feature_request_reasons')
      .upsert({ request_id: requestId, user_id: userId, reason: clean }, { onConflict: 'request_id,user_id' });
    if (error) fail(error, 'save reason');
    set((s) => ({ myReasons: { ...s.myReasons, [requestId]: clean } }));
  },

  deleteRequest: async (requestId) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('feature_requests').delete().eq('id', requestId).select('id');
    if (error) fail(error, 'delete request');
    if (!data || data.length === 0) {
      throw new Error('This request can no longer be deleted because the developer has already responded to it.');
    }
    set((s) => ({ requests: s.requests.filter((r) => r.id !== requestId && r.mergedInto !== requestId) }));
  },

  loadDetail: async (requestId) => {
    const supabase = createClient();
    const [c, e] = await Promise.all([
      supabase.from('feature_comments').select(COMMENT_COLS).eq('request_id', requestId).order('created_at', { ascending: true }).limit(500),
      supabase.from('feature_status_events').select(EVENT_COLS).eq('request_id', requestId).order('created_at', { ascending: false }).limit(100),
    ]);
    if (c.error) fail(c.error, 'load comments');
    if (e.error) fail(e.error, 'load history');
    const comments = ((c.data ?? []) as Row[]).map(toComment);
    set((s) => ({
      comments: { ...s.comments, [requestId]: comments },
      events: { ...s.events, [requestId]: ((e.data ?? []) as Row[]).map(toEvent) },
      commentCounts: { ...s.commentCounts, [requestId]: comments.length },
    }));
  },

  addComment: async (requestId, body) => {
    const { userId } = get();
    if (!userId) throw new Error('Your session has expired. Refresh the page or sign in again.');
    const clean = cleanText(body);
    const problem = validateLength(clean, LIMITS.commentMax, 'Write a comment first.');
    if (problem) throw new Error(problem);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_comments')
      .insert({ request_id: requestId, user_id: userId, body: clean })
      .select(COMMENT_COLS)
      .single();
    if (error || !data) fail(error ?? new Error('no row'), 'add comment');
    const comment = toComment(data as Row);
    set((s) => {
      const list = [...(s.comments[requestId] ?? []), comment];
      return {
        comments: { ...s.comments, [requestId]: list },
        commentCounts: { ...s.commentCounts, [requestId]: list.length },
        requests: comment.isAdmin
          ? s.requests.map((r) => (r.id === requestId ? { ...r, lastUpdateAt: comment.createdAt } : r))
          : s.requests,
      };
    });
  },

  deleteComment: async (requestId, commentId) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('feature_comments').delete().eq('id', commentId).select('id');
    if (error) fail(error, 'delete comment');
    if (!data || data.length === 0) throw new Error('You can only delete your own comments.');
    set((s) => {
      const list = (s.comments[requestId] ?? []).filter((c) => c.id !== commentId);
      return { comments: { ...s.comments, [requestId]: list }, commentCounts: { ...s.commentCounts, [requestId]: list.length } };
    });
  },

  markSeen: async (requestId) => {
    const { userId } = get();
    if (!userId) return;
    const now = new Date().toISOString();
    set((s) => ({ seen: { ...s.seen, [requestId]: now } }));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('feature_seen')
        .upsert({ user_id: userId, request_id: requestId, seen_at: now }, { onConflict: 'user_id,request_id' });
      if (error) console.error('[feature-requests] mark seen', error);
    } catch (err) {
      // Not worth interrupting the user over; the dot simply returns on next visit.
      console.error('[feature-requests] mark seen', err);
    }
  },

  sendMessage: async (body, ctx) => {
    const { userId } = get();
    if (!userId) throw new Error('Your session has expired. Refresh the page or sign in again.');
    const clean = cleanText(body);
    const problem = validateLength(clean, LIMITS.messageMax, 'Write a message first.');
    if (problem) throw new Error(problem);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_messages')
      .insert({
        thread_user_id: userId,
        sender_id: userId,
        body: clean,
        page: ctx.page.slice(0, 200),
        request_id: ctx.requestId,
      })
      .select(MESSAGE_COLS)
      .single();
    if (error || !data) fail(error ?? new Error('no row'), 'send message');
    set((s) => ({ myMessages: [...s.myMessages, toMessage(data as Row)] }));
  },

  refreshMyMessages: async () => {
    const { userId, isAdmin } = get();
    if (!userId || isAdmin) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_messages')
      .select(MESSAGE_COLS)
      .eq('thread_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) fail(error, 'refresh messages');
    set({ myMessages: ((data ?? []) as Row[]).map(toMessage) });
  },

  markMyMessagesRead: async () => {
    const { myMessages } = get();
    if (!myMessages.some((m) => m.fromAdmin && !m.readByUser)) return;
    set((s) => ({ myMessages: s.myMessages.map((m) => (m.fromAdmin ? { ...m, readByUser: true } : m)) }));
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('fr_mark_messages_read', { p_thread_user: null });
      if (error) console.error('[feature-requests] mark messages read', error);
    } catch (err) {
      console.error('[feature-requests] mark messages read', err);
    }
  },

  // ───────── Admin ─────────

  setStatus: async (requestId, status, note, version, feature) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('fr_admin_set_status', {
      p_request_id: requestId,
      p_status: status,
      p_note: cleanText(note) || null,
      p_version: version.trim() || null,
      p_feature: feature,
    });
    if (error) fail(error, 'set status');
    const [row, ev] = await Promise.all([
      supabase.from('feature_requests').select(REQUEST_COLS).eq('id', requestId).maybeSingle(),
      supabase.from('feature_status_events').select(EVENT_COLS).eq('request_id', requestId).order('created_at', { ascending: false }).limit(100),
    ]);
    set((s) => ({
      requests: row.data ? s.requests.map((r) => (r.id === requestId ? toRequest(row.data as Row) : r)) : s.requests,
      events: ev.data ? { ...s.events, [requestId]: ((ev.data ?? []) as Row[]).map(toEvent) } : s.events,
    }));
  },

  merge: async (sourceId, targetId) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('fr_admin_merge', { p_source: sourceId, p_target: targetId });
    if (error) fail(error, 'merge');
    set((s) => {
      const people = { ...s.people };
      delete people[sourceId];
      delete people[targetId];
      return { people };
    });
    await get().load({ silent: true });
  },

  setPriority: async (requestId, priority) => {
    const supabase = createClient();
    const { error } = priority
      ? await supabase.from('feature_admin_meta').upsert({ request_id: requestId, priority, updated_at: new Date().toISOString() }, { onConflict: 'request_id' })
      : await supabase.from('feature_admin_meta').delete().eq('request_id', requestId);
    if (error) fail(error, 'set priority');
    set((s) => {
      const next = { ...s.priorities };
      if (priority) next[requestId] = priority;
      else delete next[requestId];
      return { priorities: next };
    });
  },

  loadPeople: async (requestId) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fr_admin_request_people', { p_request_id: requestId });
    if (error) fail(error, 'load people');
    const people: RequestPerson[] = ((data ?? []) as Row[]).map((p) => ({
      userId: str(p.user_id),
      label: str(p.label, 'user'),
      email: strOrNull(p.email),
      role: p.role === 'requester' ? 'requester' : 'me_too',
      reason: strOrNull(p.reason),
      active: p.active === true,
      joinedAt: str(p.joined_at),
    }));
    set((s) => ({ people: { ...s.people, [requestId]: people } }));
  },

  loadThreads: async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fr_admin_threads');
    if (error) fail(error, 'load conversations');
    set({
      threads: ((data ?? []) as Row[]).map((t) => ({
        threadUserId: str(t.thread_user_id),
        label: str(t.label, 'user'),
        email: strOrNull(t.email),
        lastBody: str(t.last_body),
        lastAt: str(t.last_at),
        lastFromAdmin: t.last_from_admin === true,
        unread: num(t.unread),
        total: num(t.total),
      })),
    });
  },

  loadThread: async (threadUserId) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_messages')
      .select(MESSAGE_COLS)
      .eq('thread_user_id', threadUserId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) fail(error, 'load conversation');
    set((s) => ({
      threadMessages: { ...s.threadMessages, [threadUserId]: ((data ?? []) as Row[]).map(toMessage) },
      threads: s.threads.map((t) => (t.threadUserId === threadUserId ? { ...t, unread: 0 } : t)),
    }));
    const { error: readError } = await supabase.rpc('fr_mark_messages_read', { p_thread_user: threadUserId });
    if (readError) console.error('[feature-requests] mark thread read', readError);
  },

  replyToThread: async (threadUserId, body, requestId = null) => {
    const { userId } = get();
    if (!userId) throw new Error('Your session has expired. Refresh the page or sign in again.');
    const clean = cleanText(body);
    const problem = validateLength(clean, LIMITS.messageMax, 'Write a message first.');
    if (problem) throw new Error(problem);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_messages')
      .insert({ thread_user_id: threadUserId, sender_id: userId, body: clean, request_id: requestId })
      .select(MESSAGE_COLS)
      .single();
    if (error || !data) fail(error ?? new Error('no row'), 'reply');
    const msg = toMessage(data as Row);
    set((s) => {
      const existing = s.threads.find((t) => t.threadUserId === threadUserId);
      const thread: AdminThread = existing
        ? { ...existing, lastBody: msg.body, lastAt: msg.createdAt, lastFromAdmin: true, total: existing.total + 1 }
        : { threadUserId, label: msg.threadLabel || 'user', email: null, lastBody: msg.body, lastAt: msg.createdAt, lastFromAdmin: true, unread: 0, total: 1 };
      return {
        threadMessages: { ...s.threadMessages, [threadUserId]: [...(s.threadMessages[threadUserId] ?? []), msg] },
        threads: [thread, ...s.threads.filter((t) => t.threadUserId !== threadUserId)],
      };
    });
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_board_settings')
      .update({
        availability: next.availability,
        away_note: next.awayNote?.trim() ? next.awayNote.trim().slice(0, LIMITS.awayNoteMax) : null,
        whatsapp_enabled: next.whatsappEnabled,
        telegram_enabled: next.telegramEnabled,
        inapp_enabled: next.inappEnabled,
        call_url: next.callUrl?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select(SETTINGS_COLS)
      .maybeSingle();
    if (error) fail(error, 'update settings');
    if (!data) throw new Error('Settings were not saved. Refresh the page and try again.');
    set({ settings: toSettings(data as Row) });
  },
}));
