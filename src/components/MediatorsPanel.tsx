'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useMediatorStore } from '@/store/useMediatorStore';
import { normalizeIndianMobile, PHONE_CHECK_MESSAGE } from '@/lib/phone';
import { collapseMediatorName, mediatorNameKey, settingsSaveError } from '@/lib/mediators';

export default function MediatorsPanel() {
  const mediators = useMediatorStore((s) => s.mediators);
  const ensureLoaded = useMediatorStore((s) => s.ensureLoaded);
  const addMediator = useMediatorStore((s) => s.addMediator);
  const updateMediator = useMediatorStore((s) => s.updateMediator);
  const deleteMediator = useMediatorStore((s) => s.deleteMediator);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mediators;
    const digits = q.replace(/\D/g, '');
    return mediators.filter((m) => m.name.toLowerCase().includes(q) || (digits && m.phoneNormalized.includes(digits)));
  }, [mediators, query]);

  const saveNew = async () => {
    const parsed = normalizeIndianMobile(phone);
    if (!parsed.ok) { toast.error(PHONE_CHECK_MESSAGE); return; }
    const phoneNormalized = parsed.empty ? '' : parsed.normalized;
    const message = settingsSaveError(mediators, name, phoneNormalized);
    if (message) { toast.error(message); return; }
    setAdding(true);
    try {
      await addMediator({
        name: collapseMediatorName(name),
        nameKey: mediatorNameKey(name),
        phoneNormalized,
        phoneDisplay: parsed.empty ? '' : parsed.display,
      });
      setName('');
      setPhone('');
      toast.success('Mediator saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (id: string) => {
    const parsed = normalizeIndianMobile(editPhone);
    if (!parsed.ok) { toast.error(PHONE_CHECK_MESSAGE); return; }
    const phoneNormalized = parsed.empty ? '' : parsed.normalized;
    const message = settingsSaveError(mediators, editName, phoneNormalized, id);
    if (message) { toast.error(message); return; }
    try {
      await updateMediator(id, {
        name: collapseMediatorName(editName),
        nameKey: mediatorNameKey(editName),
        phoneNormalized,
        phoneDisplay: parsed.empty ? '' : parsed.display,
      });
      setEditingId(null);
      toast.success('Mediator updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update');
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMediator(id);
      setConfirmId(null);
      toast.success('Mediator deleted. Orders keep the name and number.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  };

  const inputClass = 'w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none';

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">Only you can see this list. It is not shared with other accounts.</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search mediators"
        className={inputClass}
      />
      <div className="rounded-xl bg-dashboard-card border border-dashboard-border overflow-hidden">
        {visible.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">No mediators yet.</p>
        ) : visible.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-dashboard-border last:border-b-0">
            {editingId === m.id ? (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="WhatsApp number" className={inputClass} />
              </div>
            ) : (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{m.name}</p>
                <p className="text-xs text-text-muted">{m.phoneDisplay || 'No number'}</p>
              </div>
            )}
            <div className="flex items-center gap-2 flex-shrink-0">
              {editingId === m.id ? (
                <>
                  <button type="button" onClick={() => saveEdit(m.id)} className="px-2.5 py-1.5 text-xs rounded-lg bg-accent-blue text-white">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border text-text-muted">Cancel</button>
                </>
              ) : confirmId === m.id ? (
                <>
                  <button type="button" onClick={() => remove(m.id)} className="px-2.5 py-1.5 text-xs rounded-lg bg-red-500/15 text-red-400">Confirm</button>
                  <button type="button" onClick={() => setConfirmId(null)} className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border text-text-muted">Cancel</button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setEditingId(m.id); setEditName(m.name); setEditPhone(m.phoneDisplay || ''); setConfirmId(null); }}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border bg-dashboard-bg text-text-secondary"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmId(m.id)} className="px-2.5 py-1.5 text-xs rounded-lg border border-dashboard-border bg-dashboard-bg text-red-400">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-dashboard-card border border-dashboard-border p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mediator name" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">WhatsApp number <span className="font-normal">optional</span></label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" className={inputClass} />
          </div>
        </div>
        <button type="button" onClick={saveNew} disabled={adding} className="px-4 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50">
          {adding ? 'Saving...' : 'Add mediator'}
        </button>
      </div>
    </div>
  );
}
