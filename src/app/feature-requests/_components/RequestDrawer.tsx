'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { findCatalogFeature } from '@/lib/featureCatalog';
import {
  LIMITS,
  STATUS_META,
  areaLabel,
  isOpenForVotes,
  shortDate,
  timeAgo,
  whatsAppLink,
  whatsAppText,
} from '@/lib/featureRequests';
import { useFeatureRequestStore } from '@/store/useFeatureRequestStore';
import { WhatsAppGlyph } from '@/components/WhatsAppChatLink';
import AdminPanel, { type AdminAction } from './AdminPanel';
import { MeTooButton } from './RequestCard';
import { CharCount, CloseButton, Drawer, StatusPill, btnPrimary, btnSmall, inputClass } from './ui';
import { LoadingDots } from '@/components/loading/LoadingDots';

export default function RequestDrawer({
  requestId,
  onClose,
  onOpen,
  onVote,
  onAdminAction,
  onTalk,
}: {
  requestId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onVote: (id: string) => void;
  onAdminAction: (a: AdminAction) => void;
  onTalk: (requestId: string | null) => void;
}) {
  const request = useFeatureRequestStore((s) => s.requests.find((r) => r.id === requestId));
  const target = useFeatureRequestStore((s) => (request?.mergedInto ? s.requests.find((r) => r.id === request.mergedInto) : undefined));
  const userId = useFeatureRequestStore((s) => s.userId);
  const isAdmin = useFeatureRequestStore((s) => s.isAdmin);
  const voted = useFeatureRequestStore((s) => Boolean(s.myVotes[requestId]));
  const pending = useFeatureRequestStore((s) => Boolean(s.pendingVotes[requestId]));
  const myReason = useFeatureRequestStore((s) => s.myReasons[requestId] ?? '');
  const comments = useFeatureRequestStore((s) => s.comments[requestId]);
  const events = useFeatureRequestStore((s) => s.events[requestId]);
  const settings = useFeatureRequestStore((s) => s.settings);
  const loadDetail = useFeatureRequestStore((s) => s.loadDetail);
  const markSeen = useFeatureRequestStore((s) => s.markSeen);
  const addComment = useFeatureRequestStore((s) => s.addComment);
  const deleteComment = useFeatureRequestStore((s) => s.deleteComment);
  const saveReason = useFeatureRequestStore((s) => s.saveReason);
  const deleteRequest = useFeatureRequestStore((s) => s.deleteRequest);

  // Error is tagged with the request it belongs to, so switching requests never shows a stale one.
  const [detailErr, setDetailErr] = useState<{ id: string; msg: string } | null>(null);
  const detailError = detailErr?.id === requestId ? detailErr.msg : '';
  const detailLoading = !comments && !detailError;
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDetail(requestId).catch((err) => {
      if (!cancelled) setDetailErr({ id: requestId, msg: err instanceof Error ? err.message : 'Could not load this request.' });
    });
    markSeen(requestId);
    return () => {
      cancelled = true;
    };
  }, [requestId, loadDetail, markSeen]);

  const retryDetail = () => {
    setDetailErr(null);
    loadDetail(requestId).catch((err) => setDetailErr({ id: requestId, msg: err instanceof Error ? err.message : 'Could not load this request.' }));
  };

  if (!request) {
    return (
      <Drawer onClose={onClose} labelId="fr-drawer-title">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dashboard-border">
          <h2 id="fr-drawer-title" className="text-sm font-semibold text-text-primary">Request not found</h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="p-5 text-sm text-text-secondary">This request was deleted or is no longer available.</p>
      </Drawer>
    );
  }

  const r = request;
  const mine = r.userId === userId;
  const open = isOpenForVotes(r.status) && !r.mergedInto;
  const feature = r.status === 'already_exists' ? findCatalogFeature(r.existsFeature) : undefined;
  const canDelete = mine && !isAdmin && r.status === 'new' && !r.mergedInto && (comments?.length ?? 0) === 0;

  const submitComment = async () => {
    if (sending) return;
    setSending(true);
    setCommentError('');
    try {
      await addComment(r.id, comment);
      setComment('');
      toast.success(isAdmin ? 'Reply posted. Everyone following gets an update.' : 'Comment posted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not post your comment.';
      setCommentError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteRequest(r.id);
      toast.success('Request deleted');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the request.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const history = [...(events ?? [])];

  return (
    <Drawer onClose={onClose} labelId="fr-drawer-title">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-dashboard-border">
        <div className="flex items-center gap-2 min-w-0">
          <StatusPill status={r.status} version={r.shippedVersion} />
          {areaLabel(r.area) && <span className="text-xs text-text-muted truncate">{areaLabel(r.area)}</span>}
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="space-y-1.5">
          <h2 id="fr-drawer-title" className="text-base font-bold text-text-primary break-words">{r.title}</h2>
          {r.content !== r.title && <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{r.content}</p>}
          {r.details && <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{r.details}</p>}
          <p className="text-[11px] text-text-muted">Posted by {mine ? 'you' : r.userEmailMasked} · {timeAgo(r.createdAt)}</p>
        </div>

        {r.mergedInto && (
          <div className="rounded-xl border border-accent-blue/30 bg-accent-blue/5 p-3 space-y-2">
            <p className="text-sm text-text-primary">This request was combined with a similar one, so all the votes count in one place.</p>
            {target ? (
              <button type="button" className={btnSmall} onClick={() => onOpen(target.id)}>Open &ldquo;{target.title}&rdquo; →</button>
            ) : (
              <p className="text-xs text-text-muted">The combined request is no longer available.</p>
            )}
          </div>
        )}

        {isAdmin && !r.mergedInto && (
          <div className="rounded-xl border border-dashed border-accent-orange/60 bg-accent-orange/5 p-3 space-y-2">
            <p className="text-[10.5px] font-mono uppercase tracking-wider text-accent-orange">Admin only</p>
            <AdminPanel request={r} onAction={onAdminAction} onDeleted={onClose} />
          </div>
        )}

        {!isAdmin && !r.mergedInto && (
          <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-3 space-y-3">
            <div className="flex items-center gap-3">
              <MeTooButton count={r.likes} voted={voted} pending={pending} disabled={!open} onClick={() => onVote(r.id)} size="lg" />
              <p className="text-xs text-text-secondary flex-1">
                {!open ? 'Voting is closed for this request.' : voted ? 'You are following this. You will see updates under Mine.' : 'Want this too? Tap Me too to follow it.'}
              </p>
            </div>
            {feature && (
              <Link href={feature.href} className={`${btnPrimary} w-full`}>{feature.cta} →</Link>
            )}
            {voted && open && <ReasonEditor key={`${r.id}:${myReason}`} requestId={r.id} saved={myReason} onSave={saveReason} />}
          </div>
        )}

        {r.statusNote && (
          <div className="border-l-2 border-accent-blue bg-accent-blue/5 rounded-r-lg px-3 py-2">
            <p className="text-[11px] font-semibold text-accent-blue">Developer</p>
            <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{r.statusNote}</p>
          </div>
        )}

        <section aria-label="History" className="space-y-1.5">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-text-muted">History</p>
          <ol className="space-y-1">
            {history.map((e) => (
              <li key={e.id} className="grid grid-cols-[56px_1fr] gap-2 text-xs text-text-secondary">
                <time className="text-[10.5px] font-mono text-text-muted pt-px">{shortDate(e.createdAt)}</time>
                <span className="break-words">
                  <strong className="text-text-primary font-semibold">{STATUS_META[e.status]?.label ?? e.status}</strong>
                  {e.note ? `. ${e.note}` : ''}
                </span>
              </li>
            ))}
            <li className="grid grid-cols-[56px_1fr] gap-2 text-xs text-text-secondary">
              <time className="text-[10.5px] font-mono text-text-muted pt-px">{shortDate(r.createdAt)}</time>
              <span><strong className="text-text-primary font-semibold">Posted</strong></span>
            </li>
          </ol>
        </section>

        <section aria-label="Discussion" className="space-y-2">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-text-muted">Discussion{comments ? ` · ${comments.length}` : ''}</p>
          {detailLoading && !comments && (
            <LoadingDots size={7} label="Loading discussion" showLabel />
          )}
          {detailError && (
            <p className="text-xs text-accent-red">
              {detailError}{' '}
              <button type="button" className="underline" onClick={retryDetail}>Retry</button>
            </p>
          )}
          {comments && comments.length === 0 && <p className="text-xs text-text-muted">No replies yet.</p>}
          {comments?.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl px-3 py-2 text-sm max-w-[92%] ${
                c.isAdmin ? 'ml-auto bg-accent-blue/10 border border-accent-blue/30 text-text-primary' : 'bg-dashboard-card border border-dashboard-border text-text-secondary'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[10.5px] ${c.isAdmin ? 'text-accent-blue font-semibold' : 'text-text-muted'}`}>
                  {c.isAdmin ? 'Developer' : c.userId === userId ? 'You' : c.authorLabel} · {timeAgo(c.createdAt)}
                </p>
                {(c.userId === userId || isAdmin) && (
                  <button
                    type="button"
                    className="text-[10.5px] text-text-muted hover:text-accent-red"
                    onClick={() => deleteComment(r.id, c.id).then(() => toast.success('Comment deleted')).catch((err) => toast.error(err instanceof Error ? err.message : 'Could not delete.'))}
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          ))}
        </section>

        {canDelete && (
          <div className="text-xs">
            {confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-text-muted">Delete this request?</span>
                <button type="button" className="text-accent-red font-semibold disabled:opacity-50" onClick={doDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button type="button" className="text-text-muted" onClick={() => setConfirmDelete(false)} disabled={deleting}>No</button>
              </span>
            ) : (
              <button type="button" className="text-text-muted hover:text-accent-red" onClick={() => setConfirmDelete(true)}>Delete my request</button>
            )}
          </div>
        )}
      </div>

      {!r.mergedInto && (
        <div className="border-t border-dashboard-border bg-dashboard-card px-4 py-3 space-y-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="relative">
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (commentError) setCommentError('');
              }}
              rows={2}
              maxLength={LIMITS.commentMax}
              placeholder={isAdmin ? 'Reply as Developer. Everyone following gets an update.' : 'Add a public comment or your use case…'}
              className={`${inputClass} resize-none pr-16`}
              aria-label={isAdmin ? 'Reply as Developer' : 'Add a comment'}
            />
            <span className="absolute bottom-2 right-3"><CharCount value={comment} max={LIMITS.commentMax} /></span>
          </div>
          {commentError && <p role="alert" className="text-xs text-accent-red">{commentError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!isAdmin && settings.whatsappEnabled ? (
              <a
                href={whatsAppLink(whatsAppText(r.title))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#25D366] hover:underline"
              >
                <WhatsAppGlyph /> Discuss privately on WhatsApp
              </a>
            ) : !isAdmin && settings.inappEnabled ? (
              <button type="button" className="text-xs font-semibold text-accent-blue hover:underline" onClick={() => onTalk(r.id)}>
                Message the developer privately
              </button>
            ) : (
              <span className="text-[11px] text-text-muted">Shown with a Developer label.</span>
            )}
            <button type="button" className={btnPrimary} onClick={submitComment} disabled={sending || !comment.trim()}>
              {sending ? 'Posting…' : isAdmin ? 'Reply' : 'Comment'}
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function ReasonEditor({ requestId, saved, onSave }: { requestId: string; saved: string; onSave: (id: string, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(saved);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(requestId, reason);
      toast.success(reason.trim() ? 'Saved. Only the developer sees this.' : 'Reason removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your reason.');
      setSaving(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="fr-reason" className="text-xs font-semibold text-text-primary">
          Why do you need it? <span className="font-normal text-text-muted">only the developer sees this</span>
        </label>
        <CharCount value={reason} max={LIMITS.reasonMax} />
      </div>
      <div className="flex gap-2">
        <input
          id="fr-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={LIMITS.reasonMax}
          placeholder="e.g. I chase 15 mediators every Monday"
          className={inputClass}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className={btnSmall} onClick={submit} disabled={saving || reason.trim() === saved.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
