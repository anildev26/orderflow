'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { findExistingFeatures, findSimilarRequests, isQueryReady } from '@/lib/featureMatch';
import {
  AREAS,
  LIMITS,
  isOpenForVotes,
  validateRequestText,
  whatsAppLink,
  whatsAppText,
  type AreaId,
  type FeatureRequest,
} from '@/lib/featureRequests';
import { useFeatureRequestStore } from '@/store/useFeatureRequestStore';
import { WhatsAppGlyph } from '@/components/WhatsAppChatLink';
import { CharCount, StatusPill, Toggle, Spinner, btnPrimary, btnSmall, btnSmallPrimary, inputClass } from './ui';

type Stage = 'typing' | 'details' | 'done';

export default function RequestComposer({
  onOpen,
  onVote,
  onTalk,
}: {
  onOpen: (id: string) => void;
  onVote: (id: string) => void;
  onTalk: (requestId: string | null) => void;
}) {
  const requests = useFeatureRequestStore((s) => s.requests);
  const myVotes = useFeatureRequestStore((s) => s.myVotes);
  const pendingVotes = useFeatureRequestStore((s) => s.pendingVotes);
  const settings = useFeatureRequestStore((s) => s.settings);
  const isAdmin = useFeatureRequestStore((s) => s.isAdmin);
  const submitRequest = useFeatureRequestStore((s) => s.submitRequest);

  const [text, setText] = useState('');
  const [details, setDetails] = useState('');
  const [area, setArea] = useState<AreaId | null>(null);
  const [contactOk, setContactOk] = useState(true);
  const [stage, setStage] = useState<Stage>('typing');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState<FeatureRequest | null>(null);

  const query = useDeferredValue(text);
  const ready = stage === 'typing' && isQueryReady(query);
  const visible = useMemo(() => requests.filter((r) => !r.mergedInto), [requests]);
  const similar = useMemo(() => (ready ? findSimilarRequests(query, visible) : []), [ready, query, visible]);
  const existing = useMemo(() => (ready ? findExistingFeatures(query) : []), [ready, query]);

  const reset = () => {
    setText('');
    setDetails('');
    setArea(null);
    setContactOk(true);
    setStage('typing');
    setError('');
    setPosted(null);
  };

  const goToDetails = () => {
    const problem = validateRequestText(text);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setStage('details');
  };

  const post = async () => {
    if (submitting) return;
    const problem = validateRequestText(text);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const created = await submitRequest({ text, details, area, contactOk });
      setPosted(created);
      setStage('done');
      setText('');
      setDetails('');
      setArea(null);
      toast.success('Request posted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === 'done' && posted) {
    return (
      <div className="rounded-2xl border border-accent-green/30 bg-accent-green/10 p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-accent-green">Posted: &ldquo;{posted.title}&rdquo;</p>
          <p className="text-xs text-text-secondary mt-1">
            The developer reads every request and will reply here. You can follow it under <strong>Mine</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isAdmin && settings.whatsappEnabled && (
            <a
              href={whatsAppLink(whatsAppText(posted.title))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:opacity-90 transition"
            >
              <WhatsAppGlyph /> Talk it through on WhatsApp
            </a>
          )}
          {!isAdmin && !settings.whatsappEnabled && settings.inappEnabled && (
            <button type="button" className={btnSmall} onClick={() => onTalk(posted.id)}>Message the developer</button>
          )}
          <button type="button" className={btnSmall} onClick={() => onOpen(posted.id)}>View my request</button>
          <button type="button" className={btnSmall} onClick={reset}>Suggest another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-4 sm:p-5 space-y-3">
      <div>
        <label htmlFor="fr-text" className="text-sm font-semibold text-text-primary">Suggest a feature</label>
        <p className="text-xs text-text-muted mt-0.5">Describe what you are trying to do. We will check if it already exists or someone asked for it.</p>
      </div>
      <div className="relative">
        <textarea
          id="fr-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
            if (stage === 'details' && !e.target.value.trim()) setStage('typing');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && stage === 'typing') {
              e.preventDefault();
              goToDetails();
            }
          }}
          rows={2}
          maxLength={LIMITS.requestMax}
          placeholder="What are you trying to do? e.g. remind mediators about pending refunds"
          className={`${inputClass} resize-none pr-14`}
          aria-describedby="fr-text-error"
        />
        <span className="absolute bottom-2 right-3"><CharCount value={text} max={LIMITS.requestMax} /></span>
      </div>

      {stage === 'typing' && text.trim() !== '' && !ready && (
        <p className="text-[11px] text-text-muted">Keep typing. Similar requests will show up here.</p>
      )}

      {ready && similar.length > 0 && (
        <div className="rounded-xl border border-accent-blue/30 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-semibold text-accent-blue bg-accent-blue/10">
            Looks similar. Add your Me too instead of posting a copy?
          </p>
          {similar.map(({ item }) => {
            const open = isOpenForVotes(item.status);
            const voted = Boolean(myVotes[item.id]);
            return (
              <div key={item.id} className="px-3 py-2.5 border-t border-dashboard-border bg-dashboard-card flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-xs font-semibold text-text-primary break-words">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusPill status={item.status} version={item.shippedVersion} />
                    <span className="text-[11px] text-text-muted">{item.likes} {item.likes === 1 ? 'person' : 'people'}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className={btnSmall} onClick={() => onOpen(item.id)}>View</button>
                  {open ? (
                    <button
                      type="button"
                      className={voted ? btnSmall : btnSmallPrimary}
                      disabled={Boolean(pendingVotes[item.id])}
                      onClick={() => onVote(item.id)}
                    >
                      {voted ? '✓ Me too' : '+ Me too'}
                    </button>
                  ) : (
                    <button type="button" className={btnSmall} onClick={() => onOpen(item.id)}>See answer</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ready && existing.length > 0 && (
        <div className="rounded-xl border border-accent-green/30 overflow-hidden">
          <p className="px-3 py-2 text-[11px] font-semibold text-accent-green bg-accent-green/10">Already in OrderFlow</p>
          {existing.map(({ item }) => (
            <div key={item.id} className="px-3 py-2.5 border-t border-dashboard-border bg-dashboard-card flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-xs font-semibold text-text-primary">{item.name}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{item.description}</p>
              </div>
              <Link href={item.href} className={btnSmall}>{item.cta} →</Link>
            </div>
          ))}
        </div>
      )}

      {stage === 'details' && (
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="fr-details" className="text-xs font-semibold text-text-primary">
                Why do you need it? <span className="font-normal text-text-muted">optional, shown on the request</span>
              </label>
              <CharCount value={details} max={LIMITS.detailsMax} />
            </div>
            <textarea
              id="fr-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={LIMITS.detailsMax}
              placeholder="What do you do today without it? e.g. I copy each order into WhatsApp by hand."
              className={`${inputClass} resize-none mt-1.5`}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary">Which part of OrderFlow? <span className="font-normal text-text-muted">optional</span></p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {AREAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={area === a.id}
                  onClick={() => setArea(area === a.id ? null : a.id)}
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    area === a.id
                      ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                      : 'border-dashboard-border bg-dashboard-bg text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p id="fr-text-error" role="alert" className="text-xs text-accent-red">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {stage === 'details' ? (
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <Toggle on={contactOk} onChange={setContactOk} label="The developer can contact me about this" />
            The developer can contact me about this
          </label>
        ) : (
          <p className="text-[11px] text-text-muted">Your email shows shortened, like jo***@gmail.com</p>
        )}
        <div className="flex gap-2 ml-auto">
          {stage === 'details' && (
            <button type="button" className={btnSmall} onClick={() => setStage('typing')} disabled={submitting}>Back</button>
          )}
          {stage === 'typing' ? (
            <button
              type="button"
              className={similar.length || existing.length ? btnSmall : btnPrimary}
              onClick={goToDetails}
              disabled={!text.trim()}
            >
              {similar.length || existing.length ? 'None of these. Post as new' : 'Continue'}
            </button>
          ) : (
            <button type="button" className={btnPrimary} onClick={post} disabled={submitting}>
              {submitting && <Spinner className="w-3.5 h-3.5" light />}
              {submitting ? 'Posting…' : 'Post request'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
