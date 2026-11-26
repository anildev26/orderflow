'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FEATURE_CATALOG, findCatalogFeature } from '@/lib/featureCatalog';
import { findExistingFeatures, findSimilarRequests, matchesSearch } from '@/lib/featureMatch';
import { LIMITS, STATUS_META, STATUS_ORDER, normaliseVersion, type RequestStatus } from '@/lib/featureRequests';
import { LATEST_VERSION } from '@/components/whatsNewConstants';
import { useFeatureRequestStore } from '@/store/useFeatureRequestStore';
import { CharCount, Modal, StatusPill, btnPrimary, btnSecondary, inputClass } from './ui';

export function StatusModal({
  requestId,
  preset,
  onClose,
}: {
  requestId: string;
  preset?: { status?: RequestStatus; feature?: string };
  onClose: () => void;
}) {
  const request = useFeatureRequestStore((s) => s.requests.find((r) => r.id === requestId));
  const setStatus = useFeatureRequestStore((s) => s.setStatus);

  const initialStatus: RequestStatus = preset?.status ?? (request?.status === 'new' ? 'under_review' : request?.status ?? 'under_review');
  const suggestedFeature = useMemo(
    () => (request ? findExistingFeatures(`${request.title} ${request.details ?? ''}`, { limit: 1 })[0]?.item.id : undefined),
    [request],
  );
  const [status, setStatusValue] = useState<RequestStatus>(initialStatus);
  const [note, setNote] = useState(request?.statusNote ?? '');
  const [version, setVersion] = useState(request?.shippedVersion ?? LATEST_VERSION);
  const [feature, setFeature] = useState<string>(preset?.feature ?? request?.existsFeature ?? suggestedFeature ?? '');
  const [noteTouched, setNoteTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!request) return null;

  const pickFeature = (id: string) => {
    setFeature(id);
    const f = findCatalogFeature(id);
    if (f && (!noteTouched || !note.trim())) setNote(`Good news: this is already in OrderFlow. ${f.description}`);
  };

  const choose = (s: RequestStatus) => {
    setStatusValue(s);
    setError('');
    if (s === 'already_exists' && feature && !noteTouched) pickFeature(feature);
  };

  const save = async () => {
    if (saving) return;
    const trimmedNote = note.trim();
    if (trimmedNote.length > LIMITS.noteMax) return setError(`Keep the note under ${LIMITS.noteMax} characters.`);
    if (status === 'not_planned' && !trimmedNote) return setError('Add a short reason so people know why.');
    if (status === 'shipped' && !normaliseVersion(version)) return setError('Add the version it shipped in, like v1.2.0.');
    if (status === 'already_exists' && !feature && !trimmedNote) return setError('Pick the existing feature or explain where to find it.');
    setSaving(true);
    setError('');
    try {
      await setStatus(request.id, status, trimmedNote, status === 'shipped' ? normaliseVersion(version) ?? '' : '', status === 'already_exists' ? feature || null : null);
      toast.success(
        status === 'new' ? 'Moved back to triage' : `${STATUS_META[status].label}. ${request.likes} ${request.likes === 1 ? 'person' : 'people'} will see the update.`,
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save the status.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Set status"
      labelId="fr-status-title"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save and notify'}</button>
        </>
      }
    >
      <p className="text-xs text-text-muted break-words">{request.title}</p>
      <div className="grid gap-1.5" role="radiogroup" aria-label="Status">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            onClick={() => choose(s)}
            className={`flex items-center gap-3 text-left px-3 py-2 rounded-lg border transition ${
              status === s ? 'border-accent-blue/50 bg-accent-blue/10' : 'border-dashboard-border bg-dashboard-bg hover:border-accent-blue/30'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${status === s ? 'border-accent-blue bg-accent-blue' : 'border-dashboard-border'}`} />
            <StatusPill status={s} />
            <span className="text-[11px] text-text-muted">{s === 'new' ? 'Back to triage' : STATUS_META[s].hint}</span>
          </button>
        ))}
      </div>

      {status === 'shipped' && (
        <div>
          <label htmlFor="fr-version" className="text-xs font-semibold text-text-primary">Version</label>
          <input id="fr-version" value={version} onChange={(e) => setVersion(e.target.value)} className={`${inputClass} mt-1.5`} placeholder="v1.2.0" maxLength={24} />
          <p className="text-[11px] text-text-muted mt-1">Pre-filled with the latest What&apos;s New version ({LATEST_VERSION}).</p>
        </div>
      )}

      {status === 'already_exists' && (
        <div>
          <label htmlFor="fr-feature" className="text-xs font-semibold text-text-primary">Existing feature</label>
          <select
            id="fr-feature"
            value={feature}
            onChange={(e) => pickFeature(e.target.value)}
            className={`${inputClass} mt-1.5`}
          >
            <option value="">Not in the list (explain in the note)</option>
            {FEATURE_CATALOG.map((f) => (
              <option key={f.id} value={f.id}>{f.name}{f.id === suggestedFeature ? ' (suggested)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="fr-note" className="text-xs font-semibold text-text-primary">
            Public note {status === 'not_planned' ? <span className="text-accent-red">required</span> : <span className="font-normal text-text-muted">optional</span>}
          </label>
          <CharCount value={note} max={LIMITS.noteMax} />
        </div>
        <textarea
          id="fr-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteTouched(true);
          }}
          rows={3}
          maxLength={LIMITS.noteMax}
          className={`${inputClass} resize-none mt-1.5`}
          placeholder={status === 'planned' ? 'e.g. Planned for December.' : status === 'not_planned' ? 'e.g. Not planned because…' : 'Shown on the request card'}
        />
      </div>
      {status !== 'new' && (
        <p className="text-[11px] text-text-muted">
          Everyone following this request ({request.likes}) sees a red dot under Mine.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
    </Modal>
  );
}

export function MergeModal({
  sourceId,
  presetTargetId,
  onClose,
  onMerged,
}: {
  sourceId: string;
  presetTargetId?: string;
  onClose: () => void;
  onMerged: (targetId: string) => void;
}) {
  const requests = useFeatureRequestStore((s) => s.requests);
  const merge = useFeatureRequestStore((s) => s.merge);
  const source = requests.find((r) => r.id === sourceId);
  const [targetId, setTargetId] = useState(presetTargetId ?? '');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    if (!source) return [];
    const pool = requests.filter((r) => !r.mergedInto && r.id !== source.id);
    if (search.trim()) return pool.filter((r) => matchesSearch(search, `${r.title} ${r.details ?? ''}`)).slice(0, 12);
    const similar = findSimilarRequests(source.title, pool, { limit: 5, threshold: 0.3 }).map((m) => m.item);
    const preset = presetTargetId ? pool.find((r) => r.id === presetTargetId) : undefined;
    const list = preset && !similar.some((r) => r.id === preset.id) ? [preset, ...similar] : similar;
    return list.length ? list : [...pool].sort((a, b) => b.likes - a.likes).slice(0, 8);
  }, [requests, source, search, presetTargetId]);

  if (!source) return null;
  const target = requests.find((r) => r.id === targetId && !r.mergedInto);

  const doMerge = async () => {
    if (!target || saving) return;
    setSaving(true);
    setError('');
    try {
      await merge(source.id, target.id);
      toast.success(`Merged into “${target.title}”`);
      onMerged(target.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not merge.';
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Merge into another request"
      labelId="fr-merge-title"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={doMerge} disabled={!target || saving}>{saving ? 'Merging…' : 'Merge'}</button>
        </>
      }
    >
      <p className="text-xs text-text-secondary">
        &ldquo;{source.title}&rdquo; will be hidden. Its people, reasons and comments move to the request you pick, and the person who posted it is told.
      </p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all requests…" className={inputClass} aria-label="Search requests to merge into" />
      <div className="grid gap-1.5" role="radiogroup" aria-label="Merge target">
        {candidates.length === 0 && <p className="text-xs text-text-muted">No matching requests.</p>}
        {candidates.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={targetId === r.id}
            onClick={() => setTargetId(r.id)}
            className={`text-left px-3 py-2 rounded-lg border transition ${
              targetId === r.id ? 'border-accent-blue/50 bg-accent-blue/10' : 'border-dashboard-border bg-dashboard-bg hover:border-accent-blue/30'
            }`}
          >
            <p className="text-xs font-semibold text-text-primary break-words">{r.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <StatusPill status={r.status} version={r.shippedVersion} />
              <span className="text-[11px] text-text-muted">{r.likes} people</span>
            </div>
          </button>
        ))}
      </div>
      {target && (
        <div className="border-l-2 border-accent-blue bg-accent-blue/5 rounded-r-lg px-3 py-2 text-xs text-text-secondary">
          After merging, &ldquo;{target.title}&rdquo; will have up to {target.likes + source.likes} people.
        </div>
      )}
      {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
    </Modal>
  );
}
