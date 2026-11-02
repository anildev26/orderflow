'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useReviewerStore } from '@/store/useReviewerStore';
import { collapseReviewerName, reviewerNameKey, reviewerSaveError } from '@/lib/reviewers';

export default function ReviewersPanel() {
  const reviewers = useReviewerStore((s) => s.reviewers);
  const ensureLoaded = useReviewerStore((s) => s.ensureLoaded);
  const addReviewer = useReviewerStore((s) => s.addReviewer);
  const updateReviewer = useReviewerStore((s) => s.updateReviewer);
  const deleteReviewer = useReviewerStore((s) => s.deleteReviewer);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviewers;
    return reviewers.filter((r) => r.name.toLowerCase().includes(q));
  }, [reviewers, query]);

  const saveNew = async () => {
    const message = reviewerSaveError(reviewers, name);
    if (message) { toast.error(message); return; }
    setAdding(true);
    try {
      await addReviewer({ name: collapseReviewerName(name), nameKey: reviewerNameKey(name) });
      setName('');
      toast.success('Reviewer saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (id: string) => {
    const message = reviewerSaveError(reviewers, editName, id);
    if (message) { toast.error(message); return; }
    try {
      await updateReviewer(id, { name: collapseReviewerName(editName), nameKey: reviewerNameKey(editName) });
      setEditingId(null);
      toast.success('Reviewer updated. Existing orders keep the name they were saved with.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update');
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteReviewer(id);
      setConfirmId(null);
      toast.success('Reviewer deleted. Orders keep the name.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  };

  const inputClass = 'w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none';

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">Only you can see this list. Deleting a name does not change orders that already used it.</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search reviewers"
        className={inputClass}
      />
      <div className="rounded-xl bg-dashboard-card border border-dashboard-border overflow-hidden">
        {visible.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">No reviewers yet.</p>
        ) : visible.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-dashboard-border last:border-b-0">
            {editingId === r.id ? (
              <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} className={`${inputClass} flex-1`} />
            ) : (
              <p className="text-sm font-semibold text-text-primary truncate">{r.name}</p>
            )}
            <div className="flex items-center gap-2 flex-shrink-0">
              {editingId === r.id ? (
                <>
                  <button type="button" onClick={() => saveEdit(r.id)} className="px-2.5 py-1.5 text-xs rounded-lg bg-accent-blue text-white">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border text-text-muted">Cancel</button>
                </>
              ) : confirmId === r.id ? (
                <>
                  <button type="button" onClick={() => remove(r.id)} className="px-2.5 py-1.5 text-xs rounded-lg bg-red-500/15 text-red-400">Confirm</button>
                  <button type="button" onClick={() => setConfirmId(null)} className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border text-text-muted">Cancel</button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setEditingId(r.id); setEditName(r.name); setConfirmId(null); }}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border bg-dashboard-bg text-text-secondary"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmId(r.id)} className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border bg-dashboard-bg text-red-400">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-dashboard-card border border-dashboard-border p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Reviewer name" className={inputClass} />
        </div>
        <button type="button" onClick={saveNew} disabled={adding} className="px-4 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50">
          {adding ? 'Saving...' : 'Add reviewer'}
        </button>
      </div>
    </div>
  );
}
