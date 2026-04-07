'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFeatureRequestStore, FeatureRequest, ADMIN_EMAIL } from '@/store/useFeatureRequestStore';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';

type FilterOption = 'most_liked' | 'most_disliked' | 'admin_commented';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RequestCard({
  request,
  currentUserId,
  isAdmin,
  accountAgeDays,
  onVote,
  onDelete,
  onAdminComment,
  onAdminComplete,
}: {
  request: FeatureRequest;
  currentUserId: string | null;
  isAdmin: boolean;
  accountAgeDays: number;
  onVote: (id: string, vote: 'like' | 'dislike') => void;
  onDelete: (id: string) => void;
  onAdminComment: (id: string, comment: string) => void;
  onAdminComplete: (id: string, completed: boolean) => void;
}) {
  const canVote = accountAgeDays >= 15;
  const isOwn = currentUserId === request.userId;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingComment, setEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState(request.adminComment ?? '');

  return (
    <div className={`bg-dashboard-card border rounded-xl p-4 flex flex-col gap-3 ${request.completed ? 'border-green-500/40' : 'border-dashboard-border'}`}>
      {/* Completed badge */}
      {request.completed && (
        <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Implemented
        </div>
      )}

      <p className="text-sm text-text-primary leading-relaxed">{request.content}</p>

      {/* Admin comment */}
      {request.adminComment && !editingComment && (
        <div className="flex items-start gap-2 p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
          <svg className="w-3.5 h-3.5 text-accent-blue mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <div>
            <p className="text-[11px] font-semibold text-accent-blue mb-0.5">OrderFlow Dev Team</p>
            <p className="text-xs text-text-secondary">{request.adminComment}</p>
          </div>
        </div>
      )}

      {/* Admin comment editor */}
      {isAdmin && editingComment && (
        <div className="space-y-2">
          <textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            rows={2}
            placeholder="Add a comment as OrderFlow Dev Team..."
            className="w-full px-3 py-2 bg-dashboard-bg border border-dashboard-border rounded-lg text-xs text-text-primary placeholder-text-muted focus:ring-1 focus:ring-accent-blue outline-none resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditingComment(false)} className="px-3 py-1 text-xs text-text-muted hover:text-text-primary transition">Cancel</button>
            <button
              onClick={() => { onAdminComment(request.id, commentDraft.trim()); setEditingComment(false); }}
              className="px-3 py-1 bg-accent-blue text-white text-xs rounded-lg hover:bg-blue-600 transition"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Like */}
          <button
            onClick={() => canVote && onVote(request.id, 'like')}
            title={canVote ? 'Like' : 'Account must be 15+ days old to vote'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              request.userVote === 'like'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-dashboard-bg border border-dashboard-border text-text-secondary hover:border-green-500/40 hover:text-green-400'
            } ${!canVote ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <svg className="w-3.5 h-3.5" fill={request.userVote === 'like' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            {request.likes}
          </button>

          {/* Dislike */}
          <button
            onClick={() => canVote && onVote(request.id, 'dislike')}
            title={canVote ? 'Dislike' : 'Account must be 15+ days old to vote'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              request.userVote === 'dislike'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-dashboard-bg border border-dashboard-border text-text-secondary hover:border-red-500/40 hover:text-red-400'
            } ${!canVote ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <svg className="w-3.5 h-3.5" fill={request.userVote === 'dislike' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
            {request.dislikes}
          </button>

          {/* Admin controls */}
          {isAdmin && (
            <>
              <button
                onClick={() => onAdminComplete(request.id, !request.completed)}
                title={request.completed ? 'Mark as pending' : 'Mark as implemented'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                  request.completed
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-dashboard-bg border-dashboard-border text-text-muted hover:border-green-500/40 hover:text-green-400'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {request.completed ? 'Done' : 'Mark Done'}
              </button>
              <button
                onClick={() => { setCommentDraft(request.adminComment ?? ''); setEditingComment(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition bg-dashboard-bg border border-dashboard-border text-text-muted hover:border-accent-blue/40 hover:text-accent-blue"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Comment
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-[11px] text-text-muted">{maskEmail(request.userEmail)}</span>
          <span className="text-[11px] text-text-muted">{timeAgo(request.createdAt)}</span>
          {(isOwn || isAdmin) && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-muted">Delete?</span>
                <button onClick={() => onDelete(request.id)} className="text-[11px] text-red-400 hover:text-red-300 font-medium transition">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-text-muted hover:text-text-primary transition">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-[11px] text-text-muted hover:text-red-400 transition" title="Delete">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeatureRequestsPage() {
  const { requests, loading, initialized, fetchRequests, addRequest, vote, deleteRequest, adminMarkCompleted, adminSetComment } = useFeatureRequestStore();
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [voteError, setVoteError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<FilterOption>('most_liked');
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = authUser?.email === ADMIN_EMAIL;

  const accountAgeDays = (() => {
    if (!authUser?.createdAt) return 0;
    return Math.floor((Date.now() - new Date(authUser.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  })();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 10) { setSubmitError('Request must be at least 10 characters.'); return; }
    if (trimmed.length > 500) { setSubmitError('Request must be 500 characters or less.'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      await addRequest(trimmed);
      setContent('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (id: string, v: 'like' | 'dislike') => {
    setVoteError('');
    try { await vote(id, v); } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : 'Vote failed.');
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteRequest(id); } catch { /* ignore */ }
  };

  const handleAdminComment = async (id: string, comment: string) => {
    try { await adminSetComment(id, comment); } catch { /* ignore */ }
  };

  const handleAdminComplete = async (id: string, completed: boolean) => {
    try { await adminMarkCompleted(id, completed); } catch { /* ignore */ }
  };

  if (!mounted || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-bg">
        <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sorted = [...requests].sort((a, b) => {
    if (filter === 'most_liked') return (b.likes - b.dislikes) - (a.likes - a.dislikes) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (filter === 'most_disliked') return b.dislikes - a.dislikes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (filter === 'admin_commented') return (b.adminComment ? 1 : 0) - (a.adminComment ? 1 : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  const filterLabels: Record<FilterOption, string> = {
    most_liked: 'Most Liked',
    most_disliked: 'Most Disliked',
    admin_commented: 'Dev Team Responded',
  };

  return (
    <div className="min-h-screen">
      {/* Top bar — matches dashboard style */}
      <div className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border">
        <div className="flex items-center justify-end px-4 md:px-6 h-14 gap-2 pl-14 md:pl-6">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
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
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-20 md:pb-6">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-text-primary">Feature Requests</h1>
          <p className="text-sm text-text-muted mt-0.5">Help shape OrderFlow by suggesting features and voting on ideas.</p>
        </div>

        {/* How it works */}
        <div className="p-4 bg-accent-blue/5 border border-accent-blue/15 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-accent-blue uppercase tracking-wide">How it works</p>
          <ul className="space-y-1.5 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent-blue">•</span>
              Users can request features that may help the wider community.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent-blue">•</span>
              The development team reviews the most liked requests regularly.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent-blue">•</span>
              If a request is feasible and valuable, it may be implemented in a future update.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-accent-blue">•</span>
              Voting requires your account to be at least 15 days old to prevent abuse.
            </li>
          </ul>
        </div>

        {/* Submit form */}
        <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-1">Suggest a Feature</h2>
          <p className="text-xs text-text-muted mb-4">Be specific and concise. Describe the problem and how this feature helps.</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. Add bulk status update for multiple orders at once..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 bg-dashboard-bg border border-dashboard-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue focus:border-accent-blue outline-none resize-none transition"
              />
              <span className={`absolute bottom-2.5 right-3 text-[10px] ${content.length > 450 ? 'text-yellow-400' : 'text-text-muted'}`}>
                {content.length}/500
              </span>
            </div>
            {submitError && <p className="text-xs text-red-400">{submitError}</p>}
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-text-muted">Your email will be partially hidden (e.g. jo***@gmail.com)</p>
              <button
                type="submit"
                disabled={submitting || content.trim().length < 10}
                className="px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>

        {/* Vote gate */}
        {accountAgeDays < 15 && (
          <div className="flex items-start gap-3 p-3.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-yellow-300">
              Voting opens after 15 days. Your account is <strong>{accountAgeDays} day{accountAgeDays !== 1 ? 's' : ''}</strong> old.
              {` ${15 - accountAgeDays} more day${15 - accountAgeDays !== 1 ? 's' : ''} to go.`}
            </p>
          </div>
        )}

        {voteError && <p className="text-xs text-red-400 px-1">{voteError}</p>}

        {/* Filter + count bar */}
        {sorted.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">{sorted.length} request{sorted.length !== 1 ? 's' : ''}</p>
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterOption)}
                className="pl-3 pr-7 py-1.5 bg-dashboard-card border border-dashboard-border rounded-lg text-xs text-text-secondary appearance-none outline-none focus:ring-1 focus:ring-accent-blue cursor-pointer"
              >
                <option value="most_liked">Most Liked</option>
                <option value="most_disliked">Most Disliked</option>
                <option value="admin_commented">Dev Team Responded</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* List */}
        {loading && requests.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">Loading requests...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-text-muted">No requests yet — be the first to suggest a feature!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                currentUserId={authUser?.id ?? null}
                isAdmin={isAdmin}
                accountAgeDays={accountAgeDays}
                onVote={handleVote}
                onDelete={handleDelete}
                onAdminComment={handleAdminComment}
                onAdminComplete={handleAdminComplete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
