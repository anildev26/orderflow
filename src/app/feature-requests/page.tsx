'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';
import { matchesSearch } from '@/lib/featureMatch';
import {
  AREAS,
  BOARD_TABS,
  SORT_LABEL,
  isUnread,
  sortRequests,
  type AreaId,
  type BoardTab,
  type PageTab,
  type SortKey,
} from '@/lib/featureRequests';
import { useFeatureRequestStore } from '@/store/useFeatureRequestStore';
import RequestComposer from './_components/RequestComposer';
import RequestCard from './_components/RequestCard';
import RequestDrawer from './_components/RequestDrawer';
import TalkToDeveloper from './_components/TalkToDeveloper';
import { MergeModal, StatusModal } from './_components/AdminModals';
import { MessagesTab, MineTab, SettingsTab, TriageTab } from './_components/Tabs';
import type { AdminAction } from './_components/AdminPanel';
import { btnPrimary, inputClass } from './_components/ui';

export default function FeatureRequestsPage() {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  const status = useFeatureRequestStore((s) => s.status);
  const loadError = useFeatureRequestStore((s) => s.loadError);
  const load = useFeatureRequestStore((s) => s.load);
  const isAdmin = useFeatureRequestStore((s) => s.isAdmin);
  const userId = useFeatureRequestStore((s) => s.userId);
  const requests = useFeatureRequestStore((s) => s.requests);
  const myVotes = useFeatureRequestStore((s) => s.myVotes);
  const seen = useFeatureRequestStore((s) => s.seen);
  const recentVotes = useFeatureRequestStore((s) => s.recentVotes);
  const commentCounts = useFeatureRequestStore((s) => s.commentCounts);
  const pendingVotes = useFeatureRequestStore((s) => s.pendingVotes);
  const priorities = useFeatureRequestStore((s) => s.priorities);
  const myMessages = useFeatureRequestStore((s) => s.myMessages);
  const threads = useFeatureRequestStore((s) => s.threads);
  const toggleVote = useFeatureRequestStore((s) => s.toggleVote);

  const [tab, setTab] = useState<PageTab>('open');
  const [sortByTab, setSortByTab] = useState<Partial<Record<BoardTab, SortKey>>>({});
  const [area, setArea] = useState<AreaId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [talkOpen, setTalkOpen] = useState(false);
  const [talkMode, setTalkMode] = useState<'menu' | 'chat'>('menu');
  const [talkContext, setTalkContext] = useState<string | null>(null);
  const [adminAction, setAdminAction] = useState<AdminAction | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh quietly when the tab comes back into view, so statuses and replies stay current.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && useFeatureRequestStore.getState().status === 'ready') {
        load({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const onVote = useCallback(
    async (id: string) => {
      try {
        const nowVoted = await toggleVote(id);
        if (nowVoted) toast.success('Added your Me too. You will see updates under Mine.', { id: `vote-${id}` });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save your vote.', { id: `vote-${id}` });
      }
    },
    [toggleVote],
  );

  const onTalk = useCallback((requestId: string | null) => {
    setTalkContext(requestId);
    setTalkMode('chat');
    setTalkOpen(true);
  }, []);

  const visible = useMemo(() => requests.filter((r) => !r.mergedInto), [requests]);
  const counts = useMemo(() => {
    const c: Record<BoardTab, number> = { open: 0, planned: 0, in_progress: 0, shipped: 0, closed: 0 };
    for (const r of visible) {
      const t = BOARD_TABS.find((b) => b.statuses.includes(r.status));
      if (t) c[t.id] += 1;
    }
    return c;
  }, [visible]);
  const mineCount = useMemo(() => requests.filter((r) => r.userId === userId || myVotes[r.id]).length, [requests, userId, myVotes]);
  const mineUnread = useMemo(
    () =>
      requests.filter((r) => isUnread(r, { userId, myVoteAt: myVotes[r.id], seenAt: seen[r.id] })).length +
      myMessages.filter((m) => m.fromAdmin && !m.readByUser).length,
    [requests, userId, myVotes, seen, myMessages],
  );
  const triageCount = useMemo(() => visible.filter((r) => r.status === 'new').length, [visible]);
  const messagesUnread = useMemo(() => threads.reduce((n, t) => n + t.unread, 0), [threads]);

  const boardTab = BOARD_TABS.find((t) => t.id === tab);
  const sort: SortKey = boardTab ? sortByTab[boardTab.id] ?? boardTab.defaultSort : 'trending';
  const list = useMemo(() => {
    if (!boardTab) return [];
    let l = visible.filter((r) => boardTab.statuses.includes(r.status));
    if (area !== 'all') l = l.filter((r) => r.area === area);
    if (search.trim()) l = l.filter((r) => matchesSearch(search, `${r.title} ${r.details ?? ''} ${r.statusNote ?? ''}`));
    return sortRequests(l, sort, { recentVotes: new Map(Object.entries(recentVotes)) });
  }, [boardTab, visible, area, search, sort, recentVotes]);

  const switchTab = (t: PageTab) => {
    setTab(t);
    setSearch('');
    setArea('all');
  };

  const tabButton = (id: PageTab, label: string, count?: number, badge?: number, admin = false) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => switchTab(id)}
      className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition inline-flex items-center gap-1.5 ${
        tab === id
          ? admin
            ? 'border-accent-orange text-accent-orange font-semibold'
            : 'border-accent-blue text-text-primary font-semibold'
          : admin
            ? 'border-transparent text-accent-orange/80 hover:text-accent-orange'
            : 'border-transparent text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
      {count !== undefined && <span className="text-xs font-normal text-text-muted tabular-nums">{count}</span>}
      {badge ? (
        <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold grid place-items-center ${admin ? 'bg-accent-orange' : 'bg-accent-red'}`}>
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="min-h-screen">
      {/* Top bar — matches dashboard style */}
      <div className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border">
        <div className="flex items-center justify-end px-4 md:px-6 h-14 gap-2 pl-14 md:pl-6">
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Account menu"
              className="w-9 h-9 rounded-full bg-accent-blue flex items-center justify-center text-white font-bold text-xs hover:ring-2 hover:ring-accent-blue/50 transition"
            >
              {authUser?.initials || '??'}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-11 z-[70] w-48 bg-dashboard-card border border-dashboard-border rounded-xl shadow-2xl py-2 overflow-hidden">
                  <div className="px-4 py-3 border-b border-dashboard-border">
                    <p className="text-sm font-semibold text-text-primary">{authUser?.displayName || 'User'}</p>
                    <p className="text-xs text-text-muted truncate">{authUser?.email || ''}</p>
                  </div>
                  <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`${tab === 'triage' || tab === 'messages' || tab === 'settings' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-4 py-6 space-y-5 pb-28`}>
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-text-primary">Feature Requests</h1>
          <p className="text-sm text-text-muted mt-0.5">Help shape OrderFlow by suggesting features and voting on ideas.</p>
        </div>

        {/* How it works */}
        <div className="p-4 bg-accent-blue/5 border border-accent-blue/15 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-accent-blue uppercase tracking-wide">How it works</p>
          <ul className="space-y-1.5 text-xs text-text-secondary">
            {[
              'Type what you want to do. If OrderFlow already does it, or someone already asked, you will see it right away.',
              'Tap Me too on requests you want. Each person counts once, so similar ideas add up instead of splitting.',
              'The developer reads every request and replies with a status: planned, in progress, shipped, or why not.',
              'Follow your requests under Mine. Want to explain more? Use Talk to the developer.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 text-accent-blue">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {(status === 'idle' || status === 'loading') && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" aria-label="Loading" />
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-text-secondary">{loadError ?? 'Could not load feature requests.'}</p>
            <button type="button" className={btnPrimary} onClick={() => load()}>Try again</button>
          </div>
        )}

        {status === 'needs_upgrade' && (
          <div className="rounded-xl border border-accent-yellow/30 bg-accent-yellow/10 p-4 space-y-1">
            <p className="text-sm font-semibold text-text-primary">Feature Requests is being upgraded</p>
            <p className="text-xs text-text-secondary">
              {isAdmin
                ? 'Run supabase/migrations/zz_feature_requests_hybrid.sql in the Supabase SQL editor, then reload this page.'
                : 'Please check back in a few minutes.'}
            </p>
          </div>
        )}

        {status === 'ready' && (
          <>
            <RequestComposer onOpen={setOpenId} onVote={onVote} onTalk={onTalk} />

            <div className="flex overflow-x-auto border-b border-dashboard-border -mx-4 px-4 [scrollbar-width:none]" role="tablist" aria-label="Feature request lists">
              {BOARD_TABS.map((t) => tabButton(t.id, t.label, counts[t.id]))}
              {!isAdmin && tabButton('mine', 'Mine', mineCount, mineUnread)}
              {isAdmin && (
                <>
                  <span className="w-px bg-dashboard-border my-2 mx-1 flex-shrink-0" aria-hidden="true" />
                  {tabButton('triage', 'Triage', undefined, triageCount, true)}
                  {tabButton('messages', 'Messages', undefined, messagesUnread, true)}
                  {tabButton('settings', 'Settings', undefined, undefined, true)}
                </>
              )}
            </div>

            {boardTab && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search requests…"
                    aria-label="Search requests"
                    className={`${inputClass} flex-1 min-w-0 py-2`}
                  />
                  <select
                    value={sort}
                    onChange={(e) => setSortByTab({ ...sortByTab, [boardTab.id]: e.target.value as SortKey })}
                    aria-label="Sort"
                    className="px-3 py-2 bg-dashboard-card border border-dashboard-border rounded-xl text-xs text-text-secondary outline-none focus:ring-2 focus:ring-accent-blue"
                  >
                    {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                      <option key={k} value={k}>{SORT_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]" aria-label="Filter by area">
                  {[{ id: 'all' as const, label: 'All areas' }, ...AREAS].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={area === a.id}
                      onClick={() => setArea(a.id)}
                      className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition ${
                        area === a.id
                          ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                          : 'border-dashboard-border bg-dashboard-card text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                {list.length === 0 ? (
                  <p className="text-center py-12 text-sm text-text-muted">
                    {search || area !== 'all'
                      ? 'No requests match. Try other words, or post it above.'
                      : {
                          open: 'Nothing open yet. Be the first to suggest something.',
                          planned: 'Nothing planned right now.',
                          in_progress: 'Nothing in progress right now.',
                          shipped: 'Nothing shipped from requests yet.',
                          closed: 'Nothing closed.',
                        }[boardTab.id]}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {list.map((r) => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        voted={Boolean(myVotes[r.id])}
                        pending={Boolean(pendingVotes[r.id])}
                        unread={!isAdmin && isUnread(r, { userId, myVoteAt: myVotes[r.id], seenAt: seen[r.id] })}
                        commentCount={commentCounts[r.id] ?? 0}
                        priority={isAdmin ? priorities[r.id] : undefined}
                        isMine={r.userId === userId}
                        onOpen={setOpenId}
                        onVote={onVote}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'mine' && !isAdmin && <MineTab onOpen={setOpenId} onTalk={onTalk} />}
            {tab === 'triage' && isAdmin && <TriageTab onOpen={setOpenId} onAdminAction={setAdminAction} />}
            {tab === 'messages' && isAdmin && <MessagesTab />}
            {tab === 'settings' && isAdmin && <SettingsTab />}
          </>
        )}
      </div>

      {status === 'ready' && !isAdmin && (
        <TalkToDeveloper
          open={talkOpen}
          mode={talkMode}
          contextRequestId={talkContext ?? openId}
          onOpenChange={(o) => {
            setTalkOpen(o);
            if (!o) setTalkContext(null);
          }}
          onModeChange={setTalkMode}
        />
      )}

      {openId && (
        <RequestDrawer
          key={openId}
          requestId={openId}
          onClose={() => setOpenId(null)}
          onOpen={setOpenId}
          onVote={onVote}
          onAdminAction={setAdminAction}
          onTalk={onTalk}
        />
      )}

      {adminAction?.kind === 'status' && (
        <StatusModal requestId={adminAction.requestId} preset={adminAction.preset} onClose={() => setAdminAction(null)} />
      )}
      {adminAction?.kind === 'merge' && (
        <MergeModal
          sourceId={adminAction.requestId}
          presetTargetId={adminAction.targetId}
          onClose={() => setAdminAction(null)}
          onMerged={(targetId) => {
            setAdminAction(null);
            if (openId) setOpenId(targetId);
          }}
        />
      )}
    </div>
  );
}
