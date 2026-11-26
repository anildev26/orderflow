'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FEATURE_CATALOG } from '@/lib/featureCatalog';
import {
  DEVELOPER,
  LIMITS,
  isSafeHttpsUrl,
  isUnread,
  timeAgo,
  type Availability,
  type BoardSettings,
  type FeatureRequest,
} from '@/lib/featureRequests';
import { useFeatureRequestStore } from '@/store/useFeatureRequestStore';
import AdminPanel, { type AdminAction } from './AdminPanel';
import { CharCount, Spinner, StatusPill, Toggle, btnPrimary, btnSmall, inputClass } from './ui';

// ───────────────────────── Mine ─────────────────────────

export function MineTab({ onOpen, onTalk }: { onOpen: (id: string) => void; onTalk: (requestId: string | null) => void }) {
  const requests = useFeatureRequestStore((s) => s.requests);
  const userId = useFeatureRequestStore((s) => s.userId);
  const myVotes = useFeatureRequestStore((s) => s.myVotes);
  const seen = useFeatureRequestStore((s) => s.seen);
  const messages = useFeatureRequestStore((s) => s.myMessages);
  const unreadReplies = messages.filter((m) => m.fromAdmin && !m.readByUser).length;

  const { updates, posted, followed } = useMemo(() => {

    const mine = requests.filter((r) => r.userId === userId || myVotes[r.id]);
    const unread = (r: FeatureRequest) => isUnread(r, { userId, myVoteAt: myVotes[r.id], seenAt: seen[r.id] });
    const newestFirst = (a: FeatureRequest, b: FeatureRequest) =>
      Date.parse(b.lastUpdateAt ?? b.createdAt) - Date.parse(a.lastUpdateAt ?? a.createdAt);
    return {
      updates: mine.filter(unread).sort(newestFirst),
      posted: requests.filter((r) => r.userId === userId && !unread(r)).sort(newestFirst),
      followed: mine.filter((r) => r.userId !== userId && !unread(r) && !r.mergedInto).sort(newestFirst),

    };
  }, [requests, userId, myVotes, seen]);

  if (!updates.length && !posted.length && !followed.length && !messages.length) {
    return (
      <div className="text-center py-14 text-sm text-text-muted space-y-1">
        <p>Requests you post or Me too will show here, with updates from the developer.</p>
      </div>
    );
  }

  const row = (r: FeatureRequest, unread: boolean) => {
    const target = r.mergedInto ? requests.find((x) => x.id === r.mergedInto) : undefined;
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => onOpen(r.mergedInto && target ? target.id : r.id)}
        className={`w-full text-left bg-dashboard-card border rounded-xl p-3.5 space-y-1.5 transition hover:border-accent-blue/40 ${
          unread ? 'border-accent-blue/50' : 'border-dashboard-border'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-text-primary flex items-center gap-2 min-w-0 break-words">
            {unread && <span className="w-2 h-2 rounded-full bg-accent-red flex-shrink-0" aria-label="New update" />}
            {r.title}
          </span>
          {r.mergedInto ? (
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue font-semibold whitespace-nowrap">Combined</span>
          ) : (
            <StatusPill status={r.status} version={r.shippedVersion} />
          )}
        </div>
        <p className="text-xs text-text-secondary break-words">
          {r.mergedInto
            ? `Combined with “${target?.title ?? 'a similar request'}” so all votes count together.`
            : r.statusNote
              ? `Developer: ${r.statusNote}`
              : `No update yet. ${r.likes} ${r.likes === 1 ? 'person wants' : 'people want'} this.`}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {unreadReplies > 0 && (
        <button
          type="button"
          onClick={() => onTalk(null)}
          className="w-full text-left rounded-xl border border-accent-blue/50 bg-accent-blue/10 p-3.5 flex items-center gap-3"
        >
          <span className="w-2 h-2 rounded-full bg-accent-red flex-shrink-0" aria-hidden="true" />
          <span className="text-sm text-text-primary flex-1">
            {DEVELOPER.name} replied to your message{unreadReplies > 1 ? ` (${unreadReplies} new)` : ''}.
          </span>
          <span className="text-xs font-semibold text-accent-blue">Open</span>
        </button>
      )}
      {updates.length > 0 && <Section title="Updates for you">{updates.map((r) => row(r, true))}</Section>}
      {posted.length > 0 && <Section title="Posted by you">{posted.map((r) => row(r, false))}</Section>}
      {followed.length > 0 && <Section title="You said Me too">{followed.map((r) => row(r, false))}</Section>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10.5px] font-mono uppercase tracking-wider text-text-muted">{title}</h3>
      {children}
    </section>
  );
}

// ───────────────────────── Triage (admin) ─────────────────────────

export function TriageTab({ onOpen, onAdminAction }: { onOpen: (id: string) => void; onAdminAction: (a: AdminAction) => void }) {
  const requests = useFeatureRequestStore((s) => s.requests);
  const queue = useMemo(
    () => requests.filter((r) => r.status === 'new' && !r.mergedInto).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [requests],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const current = queue.find((r) => r.id === selected) ?? queue[0];

  if (!queue.length) {
    return (
      <div className="text-center py-14 space-y-1">
        <p className="text-sm font-semibold text-accent-green">All caught up.</p>
        <p className="text-xs text-text-muted">Every request has a status. New ones will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">Oldest first. A request stays here until you set a status, merge it, or mark it Already exists.</p>
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)] rounded-xl border border-dashboard-border overflow-hidden bg-dashboard-card">
        <div className="md:border-r border-b md:border-b-0 border-dashboard-border max-h-[260px] md:max-h-[640px] overflow-y-auto">
          {queue.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              aria-current={current?.id === r.id}
              className={`w-full text-left px-3 py-2.5 border-b border-dashboard-border last:border-b-0 transition ${
                current?.id === r.id ? 'bg-accent-blue/10 shadow-[inset_3px_0_0_var(--color-accent-blue)]' : 'hover:bg-dashboard-bg'
              }`}
            >
              <p className="text-xs font-semibold text-text-primary break-words">{r.title}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{r.likes} {r.likes === 1 ? 'person' : 'people'} · {timeAgo(r.createdAt)}</p>
            </button>
          ))}
        </div>
        {current && (
          <div className="p-4 space-y-3 min-w-0 bg-dashboard-bg">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-text-primary break-words">{current.title}</p>
                <StatusPill status={current.status} />
              </div>
              {current.details && <p className="text-xs text-text-secondary whitespace-pre-wrap break-words">{current.details}</p>}
              <p className="text-[11px] text-text-muted">
                {current.userEmailMasked} · {timeAgo(current.createdAt)} ·{' '}
                <button type="button" className="text-accent-blue hover:underline" onClick={() => onOpen(current.id)}>Open thread</button>
              </p>
            </div>
            <AdminPanel key={current.id} request={current} onAction={onAdminAction} onDeleted={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Messages (admin) ─────────────────────────

export function MessagesTab() {
  const threads = useFeatureRequestStore((s) => s.threads);
  const threadMessages = useFeatureRequestStore((s) => s.threadMessages);
  const loadThreads = useFeatureRequestStore((s) => s.loadThreads);
  const loadThread = useFeatureRequestStore((s) => s.loadThread);
  const replyToThread = useFeatureRequestStore((s) => s.replyToThread);
  const requests = useFeatureRequestStore((s) => s.requests);

  const [listErr, setListErr] = useState('');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [threadErr, setThreadErr] = useState<{ id: string; msg: string } | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const refreshList = () =>
    loadThreads()
      .then(() => setListErr(''))
      .catch((err) => setListErr(err instanceof Error ? err.message : 'Could not load conversations.'))
      .finally(() => setLoadedOnce(true));

  useEffect(() => {
    let cancelled = false;
    loadThreads()
      .catch((err) => {
        if (!cancelled) setListErr(err instanceof Error ? err.message : 'Could not load conversations.');
      })
      .finally(() => {
        if (!cancelled) setLoadedOnce(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadThreads]);

  const current = threads.find((t) => t.threadUserId === selected) ?? threads[0];
  const currentId = current?.threadUserId ?? null;

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    loadThread(currentId).catch((err) => {
      if (!cancelled) setThreadErr({ id: currentId, msg: err instanceof Error ? err.message : 'Could not load this conversation.' });
    });
    return () => {
      cancelled = true;
    };
  }, [currentId, loadThread]);

  const msgs = currentId ? threadMessages[currentId] : undefined;
  const threadError = threadErr?.id === currentId ? threadErr.msg : '';

  const send = async () => {
    if (!currentId || sending) return;
    setSending(true);
    try {
      await replyToThread(currentId, body);
      setBody('');
      toast.success('Reply sent. They will see it on the Feature Requests page.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the reply.');
    } finally {
      setSending(false);
    }
  };

  if (!loadedOnce && !threads.length) {
    return <div className="flex items-center gap-2 py-10 justify-center text-sm text-text-muted"><Spinner /> Loading conversations…</div>;
  }
  if (listErr && !threads.length) {
    return (
      <div className="text-center py-10 space-y-2">
        <p className="text-sm text-accent-red">{listErr}</p>
        <button type="button" className={btnSmall} onClick={refreshList}>Try again</button>
      </div>
    );
  }
  if (!threads.length) {
    return <p className="text-center py-14 text-sm text-text-muted">No messages yet. When someone uses “Leave a message here”, it shows up here.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" className={btnSmall} onClick={refreshList}>Refresh</button>
      </div>
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)] rounded-xl border border-dashboard-border overflow-hidden bg-dashboard-card">
        <div className="md:border-r border-b md:border-b-0 border-dashboard-border max-h-[240px] md:max-h-[600px] overflow-y-auto">
          {threads.map((t) => (
            <button
              key={t.threadUserId}
              type="button"
              onClick={() => setSelected(t.threadUserId)}
              aria-current={currentId === t.threadUserId}
              className={`w-full text-left px-3 py-2.5 border-b border-dashboard-border last:border-b-0 transition ${
                currentId === t.threadUserId ? 'bg-accent-blue/10 shadow-[inset_3px_0_0_var(--color-accent-blue)]' : 'hover:bg-dashboard-bg'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-text-primary truncate">{t.email ?? t.label}</p>
                {t.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent-red text-white text-[10px] font-bold grid place-items-center">{t.unread}</span>}
              </div>
              <p className="text-[11px] text-text-muted truncate">{t.lastFromAdmin ? 'You: ' : ''}{t.lastBody}</p>
              <p className="text-[10px] text-text-muted">{timeAgo(t.lastAt)}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-col min-w-0 bg-dashboard-bg">
          {current && (
            <div className="px-4 py-2.5 border-b border-dashboard-border flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary break-all">{current.email ?? current.label}</p>
              {current.email && (
                <a className={btnSmall} href={`mailto:${encodeURIComponent(current.email)}?subject=${encodeURIComponent('Your message about OrderFlow')}`}>Email</a>
              )}
            </div>
          )}
          <div className="flex-1 min-h-[220px] max-h-[440px] overflow-y-auto p-4 space-y-2">
            {!msgs && !threadError && <div className="flex items-center gap-2 text-xs text-text-muted"><Spinner className="w-3.5 h-3.5" /> Loading…</div>}
            {threadError && <p className="text-xs text-accent-red">{threadError}</p>}
            {msgs?.map((m) => {
              const req = m.requestId ? requests.find((r) => r.id === m.requestId) : undefined;
              return (
                <div
                  key={m.id}
                  className={`rounded-xl px-3 py-2 text-sm max-w-[88%] ${
                    m.fromAdmin ? 'ml-auto bg-accent-blue/10 border border-accent-blue/30 text-text-primary' : 'bg-dashboard-card border border-dashboard-border text-text-secondary'
                  }`}
                >
                  <p className="text-[10px] text-text-muted mb-0.5">
                    {m.fromAdmin ? 'You' : current?.label} · {timeAgo(m.createdAt)}
                    {req ? ` · about “${req.title}”` : m.page ? ` · from ${m.page}` : ''}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t border-dashboard-border p-3 space-y-2">
            <div className="relative">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                maxLength={LIMITS.messageMax}
                placeholder="Reply… they will see it in Talk to the developer"
                className={`${inputClass} resize-none pr-16`}
                aria-label="Reply"
              />
              <span className="absolute bottom-2 right-3"><CharCount value={body} max={LIMITS.messageMax} /></span>
            </div>
            <div className="flex justify-end">
              <button type="button" className={btnPrimary} onClick={send} disabled={sending || !body.trim() || !currentId}>
                {sending ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Settings (admin) ─────────────────────────

export function SettingsTab() {
  const settings = useFeatureRequestStore((s) => s.settings);
  return <SettingsForm key={JSON.stringify(settings)} initial={settings} />;
}

function SettingsForm({ initial }: { initial: BoardSettings }) {
  const updateSettings = useFeatureRequestStore((s) => s.updateSettings);
  const [draft, setDraft] = useState<BoardSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const callUrl = draft.callUrl?.trim() ?? '';

  const save = async () => {
    if (saving) return;
    if (callUrl && !isSafeHttpsUrl(callUrl)) {
      setError('The call link must start with https://');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateSettings({ ...draft, callUrl: callUrl || null });
      toast.success('Settings saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save settings.';
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  };

  const avail: { id: Availability; label: string; hint: string }[] = [
    { id: 'available', label: 'Available', hint: 'Usually replies within a few hours' },
    { id: 'busy', label: 'Busy', hint: 'Usually replies within a day' },
    { id: 'away', label: 'Away', hint: 'Messages are saved for later' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">Your availability</p>
            <p className="text-xs text-text-muted">Shown on the Talk to the developer button.</p>
          </div>
          <div className="grid gap-1.5" role="radiogroup" aria-label="Availability">
            {avail.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={draft.availability === a.id}
                onClick={() => setDraft({ ...draft, availability: a.id })}
                className={`flex items-center gap-3 text-left px-3 py-2 rounded-lg border transition ${
                  draft.availability === a.id ? 'border-accent-blue/50 bg-accent-blue/10' : 'border-dashboard-border bg-dashboard-bg'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full border-2 ${draft.availability === a.id ? 'border-accent-blue bg-accent-blue' : 'border-dashboard-border'}`} />
                <span>
                  <span className="block text-sm text-text-primary">{a.label}</span>
                  <span className="block text-[11px] text-text-muted">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
          {draft.availability !== 'available' && (
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="fr-away" className="text-xs font-semibold text-text-primary">Status line <span className="font-normal text-text-muted">optional</span></label>
                <CharCount value={draft.awayNote ?? ''} max={LIMITS.awayNoteMax} />
              </div>
              <input
                id="fr-away"
                value={draft.awayNote ?? ''}
                maxLength={LIMITS.awayNoteMax}
                onChange={(e) => setDraft({ ...draft, awayNote: e.target.value })}
                placeholder="e.g. Away until Monday. Messages are saved."
                className={`${inputClass} mt-1.5`}
              />
            </div>
          )}
        </div>

        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-text-primary">Channels in the sheet</p>
          {([
            ['whatsappEnabled', 'WhatsApp', `Opens wa.me/${DEVELOPER.whatsappNumber} with the message started`],
            ['telegramEnabled', 'Telegram', 'Opens your Telegram profile'],
            ['inappEnabled', 'Leave a message here', 'Shows up in the Messages tab'],
          ] as const).map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm text-text-primary">{label}</span>
                <span className="block text-[11px] text-text-muted">{hint}</span>
              </span>
              <Toggle on={draft[key]} onChange={(v) => setDraft({ ...draft, [key]: v })} label={label} />
            </div>
          ))}
          <div>
            <label htmlFor="fr-call" className="text-xs font-semibold text-text-primary">Book a call link <span className="font-normal text-text-muted">optional, https only</span></label>
            <input
              id="fr-call"
              value={draft.callUrl ?? ''}
              onChange={(e) => setDraft({ ...draft, callUrl: e.target.value })}
              placeholder="https://cal.com/your-name/15min"
              className={`${inputClass} mt-1.5`}
              inputMode="url"
            />
          </div>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSmall} onClick={() => setDraft(initial)} disabled={!dirty || saving}>Reset</button>
        <button type="button" className={btnPrimary} onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </div>

      <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">&ldquo;Already in OrderFlow&rdquo; list</p>
        <p className="text-xs text-text-muted">
          Matched while people type a request, and used for your Already exists replies. To add one, edit <code className="font-mono">src/lib/featureCatalog.ts</code> when you ship the feature.
        </p>
        <div className="rounded-lg border border-dashboard-border divide-y divide-dashboard-border">
          {FEATURE_CATALOG.map((f) => (
            <div key={f.id} className="px-3 py-2 flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 flex-1 basis-56">
                <span className="block text-xs font-semibold text-text-primary">{f.name}</span>
                <span className="block text-[11px] text-text-muted">{f.description}</span>
              </span>
              <span className="text-[11px] font-mono text-text-muted">{f.href}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
