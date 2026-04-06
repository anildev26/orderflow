'use client';

import { useState, useEffect, useRef } from 'react';
import { useFeatureRequestStore, FeatureRequest } from '@/store/useFeatureRequestStore';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/ThemeToggle';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
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
  accountAgeDays,
  onVote,
  onDelete,
}: {
  request: FeatureRequest;
  currentUserId: string | null;
  accountAgeDays: number;
  onVote: (id: string, vote: 'like' | 'dislike') => void;
  onDelete: (id: string) => void;
}) {
  const canVote = accountAgeDays >= 15;
  const isOwn = currentUserId === request.userId;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm text-text-primary leading-relaxed">{request.content}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-muted">{maskEmail(request.userEmail)}</span>
          <span className="text-[11px] text-text-muted">{timeAgo(request.createdAt)}</span>
          {isOwn && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-muted">Delete?</span>
                <button
                  onClick={() => onDelete(request.id)}
                  className="text-[11px] text-red-400 hover:text-red-300 font-medium transition"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[11px] text-text-muted hover:text-text-primary transition"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[11px] text-text-muted hover:text-red-400 transition"
                title="Delete your request"
              >
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
  const { requests, loading, initialized, fetchRequests, addRequest, vote, deleteRequest } = useFeatureRequestStore();
  const { user: authUser } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [voteError, setVoteError] = useState('');
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountAgeDays = (() => {
    if (!authUser?.createdAt) return 0;
    return Math.floor((Date.now() - new Date(authUser.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 10) {
      setSubmitError('Request must be at least 10 characters.');
      return;
    }
    if (trimmed.length > 500) {
      setSubmitError('Request must be 500 characters or less.');
      return;
    }
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
    try {
      await vote(id, v);
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : 'Vote failed. Try again.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRequest(id);
    } catch {
      // silently ignore — shouldn't happen
    }
  };

  if (!mounted || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <div className="text-text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Sort by net votes (likes - dislikes) descending, then by newest
  const sorted = [...requests].sort((a, b) => {
    const netA = a.likes - a.dislikes;
    const netB = b.likes - b.dislikes;
    if (netB !== netA) return netB - netA;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border">
        <div className="flex items-center justify-between px-6 h-14 gap-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h1 className="text-sm font-semibold text-text-primary">Feature Requests</h1>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Submit form */}
        <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-1">Suggest a Feature</h2>
          <p className="text-xs text-text-muted mb-4">Got an idea? Share it with the community. Be specific and concise.</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
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
            {submitError && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}
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

        {/* Vote gate notice */}
        {accountAgeDays < 15 && (
          <div className="flex items-start gap-3 p-3.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-yellow-300">
              Voting is available to accounts older than 15 days.
              Your account is <strong>{accountAgeDays} day{accountAgeDays !== 1 ? 's' : ''}</strong> old.
              {accountAgeDays < 15 && ` ${15 - accountAgeDays} more day${15 - accountAgeDays !== 1 ? 's' : ''} to go.`}
            </p>
          </div>
        )}

        {voteError && (
          <p className="text-xs text-red-400 px-1">{voteError}</p>
        )}

        {/* Requests list */}
        {loading && requests.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">Loading requests...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-text-muted">No requests yet. Be the first to suggest a feature!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-text-muted px-1">{sorted.length} request{sorted.length !== 1 ? 's' : ''} · sorted by most liked</p>
            {sorted.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                currentUserId={authUser?.id ?? null}
                accountAgeDays={accountAgeDays}
                onVote={handleVote}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
