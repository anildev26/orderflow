'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { findExistingFeatures, findSimilarRequests } from '@/lib/featureMatch';
import { LIMITS, PRIORITY_LABEL, type FeatureRequest, type Priority } from '@/lib/featureRequests';
import { useFeatureRequestStore } from '@/store/useFeatureRequestStore';
import { CharCount, StatusPill, btnSmall, btnSmallPrimary, inputClass } from './ui';
import { LoadingDots } from '@/components/loading/LoadingDots';

export type AdminAction =
  | { kind: 'status'; requestId: string; preset?: { status?: FeatureRequest['status']; feature?: string } }
  | { kind: 'merge'; requestId: string; targetId?: string };

export default function AdminPanel({
  request,
  onAction,
  onDeleted,
}: {
  request: FeatureRequest;
  onAction: (a: AdminAction) => void;
  onDeleted: () => void;
}) {
  const requests = useFeatureRequestStore((s) => s.requests);
  const people = useFeatureRequestStore((s) => s.people[request.id]);
  const priority = useFeatureRequestStore((s) => s.priorities[request.id]);
  const loadPeople = useFeatureRequestStore((s) => s.loadPeople);
  const setPriority = useFeatureRequestStore((s) => s.setPriority);
  const deleteRequest = useFeatureRequestStore((s) => s.deleteRequest);
  const replyToThread = useFeatureRequestStore((s) => s.replyToThread);

  const [peopleErr, setPeopleErr] = useState<{ id: string; msg: string } | null>(null);
  const peopleError = peopleErr?.id === request.id ? peopleErr.msg : '';
  const peopleLoading = !people && !peopleError;
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [messageTo, setMessageTo] = useState<{ userId: string; label: string } | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);

  const merged = Boolean(request.mergedInto);

  useEffect(() => {
    let cancelled = false;
    if (merged) return;
    loadPeople(request.id).catch((err) => {
      if (!cancelled) setPeopleErr({ id: request.id, msg: err instanceof Error ? err.message : 'Could not load people.' });
    });
    return () => {
      cancelled = true;
    };
  }, [request.id, request.likes, merged, loadPeople]);

  const retryPeople = () => {
    setPeopleErr(null);
    loadPeople(request.id).catch((err) => setPeopleErr({ id: request.id, msg: err instanceof Error ? err.message : 'Could not load people.' }));
  };

  const matchText = `${request.title} ${request.details ?? ''}`;
  const duplicates = useMemo(
    () => findSimilarRequests(request.title, requests.filter((r) => !r.mergedInto), { excludeId: request.id, limit: 3 }),
    [request.title, request.id, requests],
  );
  const maybeExists = useMemo(() => findExistingFeatures(matchText, { limit: 1 }), [matchText]);

  const activeCount = people?.filter((p) => p.active).length ?? 0;
  const reasons = people?.filter((p) => p.reason).length ?? 0;
  const shownPeople = showAllPeople ? people ?? [] : (people ?? []).slice(0, 4);

  const changePriority = async (value: string) => {
    setSavingPriority(true);
    try {
      await setPriority(request.id, (value || null) as Priority | null);
      toast.success(value ? 'Priority saved' : 'Priority cleared');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save priority.');
    } finally {
      setSavingPriority(false);
    }
  };

  const sendMessage = async () => {
    if (!messageTo || sending) return;
    setSending(true);
    try {
      await replyToThread(messageTo.userId, messageBody, request.id);
      toast.success(`Message sent to ${messageTo.label}. It shows in their Talk to the developer chat.`);
      setMessageTo(null);
      setMessageBody('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteRequest(request.id);
      toast.success('Request deleted');
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the request.');
      setDeleting(false);
    }
  };

  if (merged) {
    return <p className="text-xs text-text-secondary">This request was combined into another one. Open that request to manage it.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat value={request.likes} label={request.likes === 1 ? 'person asked' : 'people asked'} />
        <Stat value={people ? activeCount : '…'} label="active users" title="Created an order in the last 30 days" />
        <Stat value={duplicates.length} label="similar posts" />
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-accent-yellow/30 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-semibold text-accent-yellow bg-accent-yellow/10">Possible duplicate</p>
          {duplicates.map(({ item, score }) => (
            <div key={item.id} className="px-3 py-2 border-t border-dashboard-border bg-dashboard-card flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-xs font-semibold text-text-primary break-words">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusPill status={item.status} version={item.shippedVersion} />
                  <span className="text-[11px] text-text-muted">{item.likes} people · {Math.round(score * 100)}% match</span>
                </div>
              </div>
              <button type="button" className={btnSmall} onClick={() => onAction({ kind: 'merge', requestId: request.id, targetId: item.id })}>
                Merge into this
              </button>
            </div>
          ))}
        </div>
      )}

      {maybeExists.length > 0 && request.status !== 'already_exists' && (
        <div className="rounded-xl border border-accent-green/30 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-semibold text-accent-green bg-accent-green/10">Might already exist</p>
          {maybeExists.map(({ item }) => (
            <div key={item.id} className="px-3 py-2 border-t border-dashboard-border bg-dashboard-card flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-xs font-semibold text-text-primary">{item.name}</p>
                <p className="text-[11px] text-text-muted">{item.description}</p>
              </div>
              <button
                type="button"
                className={btnSmall}
                onClick={() => onAction({ kind: 'status', requestId: request.id, preset: { status: 'already_exists', feature: item.id } })}
              >
                Mark Already exists
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-[10.5px] font-mono uppercase tracking-wider text-text-muted mb-1.5">
          Who is asking{people ? ` · ${reasons} gave a reason` : ''}
        </p>
        {peopleLoading && !people && (
          <LoadingDots size={7} label="Loading who is asking" showLabel />
        )}
        {peopleError && (
          <p className="text-xs text-accent-red">
            {peopleError}{' '}
            <button type="button" className="underline" onClick={retryPeople}>Retry</button>
          </p>
        )}
        {people && people.length === 0 && <p className="text-xs text-text-muted">Nobody yet.</p>}
        {people && people.length > 0 && (
          <div className="rounded-xl border border-dashboard-border overflow-hidden divide-y divide-dashboard-border">
            {shownPeople.map((p) => (
              <div key={`${p.role}-${p.userId}`} className="px-3 py-2 bg-dashboard-card flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-xs text-text-primary break-all">
                    {p.email ?? p.label}
                    <span className="ml-1.5 text-[10px] text-text-muted">{p.role === 'requester' ? 'posted it' : 'me too'}{p.active ? '' : ' · inactive'}</span>
                  </p>
                  <p className="text-[11px] text-text-muted italic break-words">{p.reason ? `“${p.reason}”` : 'No reason given'}</p>
                </div>
                <div className="flex gap-1.5">
                  {p.email && (
                    <a className={btnSmall} href={`mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(`Your OrderFlow request: ${request.title}`)}`}>
                      Email
                    </a>
                  )}
                  <button type="button" className={btnSmall} onClick={() => setMessageTo({ userId: p.userId, label: p.label })}>Message</button>
                </div>
              </div>
            ))}
            {people.length > 4 && (
              <button type="button" className="w-full px-3 py-2 text-xs text-accent-blue bg-dashboard-card hover:bg-dashboard-bg" onClick={() => setShowAllPeople((v) => !v)}>
                {showAllPeople ? 'Show fewer' : `Show all ${people.length}`}
              </button>
            )}
          </div>
        )}
        {messageTo && (
          <div className="mt-2 space-y-2 rounded-xl border border-accent-blue/30 bg-accent-blue/5 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-primary">Message {messageTo.label}</p>
              <CharCount value={messageBody} max={LIMITS.messageMax} />
            </div>
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={3}
              maxLength={LIMITS.messageMax}
              placeholder="They will see this in Talk to the developer on this page."
              className={`${inputClass} resize-none`}
              aria-label={`Message to ${messageTo.label}`}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className={btnSmall} onClick={() => setMessageTo(null)} disabled={sending}>Cancel</button>
              <button type="button" className={btnSmallPrimary} onClick={sendMessage} disabled={sending || !messageBody.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={btnSmallPrimary} onClick={() => onAction({ kind: 'status', requestId: request.id })}>Set status</button>
        <button type="button" className={btnSmall} onClick={() => onAction({ kind: 'merge', requestId: request.id })}>Merge into…</button>
        <button type="button" className={btnSmall} onClick={() => onAction({ kind: 'status', requestId: request.id, preset: { status: 'already_exists' } })}>
          Already exists
        </button>
        <select
          value={priority ?? ''}
          disabled={savingPriority}
          onChange={(e) => changePriority(e.target.value)}
          aria-label="Private priority"
          className="px-2 py-1.5 bg-dashboard-bg border border-dashboard-border rounded-lg text-xs text-text-secondary outline-none focus:ring-1 focus:ring-accent-blue"
        >
          <option value="">Priority: none</option>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-text-muted">Delete for everyone?</span>
            <button type="button" className="text-accent-red font-semibold disabled:opacity-50" onClick={doDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" className="text-text-muted" onClick={() => setConfirmDelete(false)} disabled={deleting}>No</button>
          </span>
        ) : (
          <button type="button" className={btnSmall} onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
      </div>
      <p className="text-[10.5px] text-text-muted">Priority is private. Users never see it.</p>
    </div>
  );
}

function Stat({ value, label, title }: { value: number | string; label: string; title?: string }) {
  return (
    <div className="rounded-lg border border-dashboard-border bg-dashboard-card px-2.5 py-2" title={title}>
      <p className="text-base font-bold text-text-primary tabular-nums">{value}</p>
      <p className="text-[10.5px] text-text-muted leading-tight">{label}</p>
    </div>
  );
}
