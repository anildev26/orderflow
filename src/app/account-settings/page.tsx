'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';
import { usePlatformStore, ADMIN_EMAIL } from '@/store/usePlatformStore';

/* ─── Draggable List (reusable) ─── */
function DraggableList<T>({
  items,
  getKey,
  getLabel,
  onReorder,
  onRemove,
  onEdit,
}: {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onReorder: (items: T[]) => void;
  onRemove: (item: T) => void;
  onEdit?: (item: T, newLabel: string) => void;
}) {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleDragStart = (idx: number) => { dragItem.current = idx; setDragIdx(idx); };
  const handleDragEnter = (idx: number) => { dragOverItem.current = idx; setOverIdx(idx); };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newList = [...items];
      const [removed] = newList.splice(dragItem.current, 1);
      newList.splice(dragOverItem.current, 0, removed);
      onReorder(newList);
    }
    dragItem.current = null; dragOverItem.current = null; setDragIdx(null); setOverIdx(null);
  };

  const touchStartY = useRef<number>(0);
  const touchItemIdx = useRef<number | null>(null);
  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY; touchItemIdx.current = idx; dragItem.current = idx; setDragIdx(idx);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchItemIdx.current === null) return;
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const el = elements.find((el) => el.getAttribute('data-drag-idx') !== null);
    if (el) { const idx = parseInt(el.getAttribute('data-drag-idx')!); dragOverItem.current = idx; setOverIdx(idx); }
  };
  const handleTouchEnd = () => { handleDragEnd(); touchItemIdx.current = null; };

  const startEdit = (item: T) => {
    setEditingKey(getKey(item));
    setEditValue(getLabel(item));
  };
  const commitEdit = (item: T) => {
    if (onEdit && editValue.trim() && editValue.trim() !== getLabel(item)) {
      onEdit(item, editValue.trim());
    }
    setEditingKey(null);
  };

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const key = getKey(item);
        const isEditing = editingKey === key;
        return (
          <div
            key={key}
            data-drag-idx={i}
            draggable={!isEditing}
            onDragStart={() => handleDragStart(i)}
            onDragEnter={() => handleDragEnter(i)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            onTouchStart={(e) => !isEditing && handleTouchStart(i, e)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all select-none ${
              dragIdx === i
                ? 'bg-accent-blue/10 border-accent-blue/40 opacity-70'
                : overIdx === i && dragIdx !== null
                ? 'bg-dashboard-bg border-accent-blue/30 border-dashed'
                : 'bg-dashboard-bg border-dashboard-border'
            } ${isEditing ? '' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
            </svg>

            {isEditing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') setEditingKey(null); }}
                onBlur={() => commitEdit(item)}
                className="flex-1 bg-transparent border-b border-accent-blue text-text-primary text-sm outline-none"
              />
            ) : (
              <span className="flex-1 text-text-primary">{getLabel(item)}</span>
            )}

            <div className="flex items-center gap-1 flex-shrink-0">
              {onEdit && !isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                  className="p-1 text-text-muted hover:text-accent-blue transition"
                  onDragStart={(e) => e.stopPropagation()}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                className="p-1 text-text-muted hover:text-red-400 transition"
                onDragStart={(e) => e.stopPropagation()}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Brand Logo ─── */
function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="url(#logo-grad-s)" />
      <defs>
        <linearGradient id="logo-grad-s" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M13 16V14C13 10.134 16.134 7 20 7C23.866 7 27 10.134 27 14V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <rect x="10" y="16" width="20" height="17" rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
      <path d="M15 25L18 28L25 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Account Tab Content ─── */
function AccountSection() {
  const { user: authUser, updateDisplayName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const email = authUser?.email || '';

  const handleSendOtp = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setStep('otp');
      toast.success('Verification code sent to your email');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyAndUpdate = async () => {
    if (!otp || otp.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: verifyErr } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (verifyErr) throw verifyErr;
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      toast.success('Password updated successfully!');
      setNewPassword(''); setConfirmPassword(''); setOtp(''); setStep('form');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally { setLoading(false); }
  };

  const handleSaveName = async () => {
    if (!nameValue.trim()) { toast.error('Name cannot be empty'); return; }
    try {
      await updateDisplayName(nameValue.trim());
      toast.success('Display name updated!');
      setEditingName(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name');
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* User Profile Card */}
      <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
        <h3 className="text-sm font-semibold text-text-secondary mb-4">Profile</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-blue to-purple-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {authUser?.initials || '??'}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="flex-1 bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-blue"
                  placeholder="Enter your name"
                />
                <button onClick={handleSaveName} className="px-3 py-1.5 bg-accent-blue text-white text-xs rounded-lg hover:bg-blue-600 transition">Save</button>
                <button onClick={() => setEditingName(false)} className="px-2 py-1.5 text-text-muted text-xs hover:text-text-primary transition">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-text-primary truncate">{authUser?.displayName || 'User'}</p>
                <button
                  onClick={() => { setNameValue(authUser?.displayName || ''); setEditingName(true); }}
                  className="p-1 text-text-muted hover:text-accent-blue transition"
                  title="Edit name"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-xs text-text-muted truncate mt-0.5">{authUser?.email || ''}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-dashboard-bg">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Member Since</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">{authUser?.createdAtFormatted || 'N/A'}</p>
          </div>
          <div className="p-3 rounded-lg bg-dashboard-bg">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Account Status</p>
            <p className="text-sm font-semibold text-green-400 mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Active
            </p>
          </div>
        </div>
      </div>

      {/* Theme Preference */}
      <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary font-medium">Theme</p>
            <p className="text-xs text-text-muted mt-0.5">Switch between dark and light mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-8 w-[52px] items-center rounded-full transition-colors ${
              theme === 'dark' ? 'bg-accent-blue' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-6 w-6 rounded-full bg-white transition-transform shadow-sm ${
              theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
            }`}>
              {theme === 'dark' ? (
                <svg className="w-4 h-4 m-1 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 m-1 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
        <h3 className="text-sm font-semibold text-text-secondary mb-4">Change Password</h3>
        {step === 'form' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none" />
            </div>
            <button onClick={handleSendOtp} disabled={loading || !newPassword || !confirmPassword} className="px-5 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50">
              {loading ? 'Sending...' : 'Update Password'}
            </button>
            <p className="text-[11px] text-text-muted">A verification code will be sent to your email for confirmation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Verification Code</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" maxLength={6} className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none tracking-widest text-center text-lg" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleVerifyAndUpdate} disabled={loading || otp.length !== 6} className="px-5 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify & Update'}
              </button>
              <button onClick={() => { setStep('form'); setOtp(''); }} className="px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition">Cancel</button>
            </div>
            <p className="text-[11px] text-text-muted">Check your email ({email}) for the verification code.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Admin: Platform Management ─── */
function AdminPlatformSection() {
  const { platforms, fetchPlatforms, refetch, addPlatform, toggleActive, updateLabel, deletePlatform } = usePlatformStore();

  useEffect(() => { fetchPlatforms(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newValue.trim() || !newLabel.trim()) { toast.error('Fill in both fields'); return; }
    if (!/^[a-z0-9_]+$/.test(newValue.trim())) { toast.error('Value must be lowercase letters, numbers, or underscores only'); return; }
    setAdding(true);
    try {
      await addPlatform(newValue.trim(), newLabel.trim());
      setNewValue(''); setNewLabel('');
      toast.success(`"${newLabel}" added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add');
    } finally { setAdding(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try { await toggleActive(id, active); }
    catch { toast.error('Failed to update'); }
  };

  const handleSaveLabel = async (id: string) => {
    if (!editLabel.trim()) { setEditingId(null); return; }
    try {
      await updateLabel(id, editLabel.trim());
      setEditingId(null);
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlatform(id);
      setConfirmDeleteId(null);
      toast.success('Platform deleted');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Platform Management</h2>
          <p className="text-xs text-text-muted mt-0.5">Changes apply to all users instantly.</p>
        </div>
        <button
          onClick={() => { usePlatformStore.setState({ initialized: false }); refetch(); toast.success('Refreshed'); }}
          className="text-xs text-accent-blue hover:underline flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Platform list */}
      <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border space-y-2">
        {platforms.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">No platforms yet.</p>
        )}
        {platforms.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition ${p.active ? 'bg-dashboard-bg border-dashboard-border' : 'bg-dashboard-bg/40 border-dashed border-dashboard-border opacity-60'}`}>
            {/* Label / edit */}
            <div className="flex-1 min-w-0">
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLabel(p.id); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={() => handleSaveLabel(p.id)}
                  className="w-full bg-transparent border-b border-accent-blue text-sm text-text-primary outline-none"
                />
              ) : (
                <div>
                  <span className="text-sm font-medium text-text-primary">{p.label}</span>
                  <span className="ml-2 text-xs text-text-muted font-mono">{p.value}</span>
                  {!p.active && <span className="ml-2 text-[10px] text-text-muted">(hidden)</span>}
                </div>
              )}
            </div>

            {/* Edit + Delete + Toggle */}
            <div className="flex items-center gap-2 flex-shrink-0">
            {editingId !== p.id && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingId(p.id); setEditLabel(p.label); }}
                  className="p-1 text-text-muted hover:text-accent-blue transition"
                  title="Rename"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(p.id)} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded">Yes, delete</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] px-2 py-0.5 bg-dashboard-border text-text-primary rounded">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="p-1 text-text-muted hover:text-red-400 transition"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {/* Toggle at far right */}
            <button
              onClick={() => handleToggle(p.id, !p.active)}
              className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${p.active ? 'bg-accent-blue' : 'bg-dashboard-border'}`}
              title={p.active ? 'Deactivate' : 'Activate'}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${p.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new platform */}
      <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">Add New Platform</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Value <span className="text-text-muted">(unique key, lowercase)</span></label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g. zepto"
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Display Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Zepto"
              className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newValue.trim() || !newLabel.trim()}
            className="px-5 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Platform'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AccountSettingsPage() {
  return (
    <Suspense fallback={null}>
      <AccountSettingsInner />
    </Suspense>
  );
}

function AccountSettingsInner() {
  useSearchParams();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.email === ADMIN_EMAIL;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'admin'>('account');

  return (
    <div className="flex min-h-screen bg-dashboard-bg">
      {/* Mobile hamburger */}
      {!mobileMenuOpen && (
        <button onClick={() => setMobileMenuOpen(true)} className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-dashboard-card border border-dashboard-border text-text-secondary hover:text-text-primary md:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* Mobile sidebar */}
      <aside className={`fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar-bg border-r border-dashboard-border flex flex-col transition-transform duration-300 md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-dashboard-border h-16">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandLogo size={34} />
            <span className="text-text-primary font-semibold text-sm leading-tight">OrderFlow<br /><span className="font-normal text-xs opacity-70">Order Manager</span></span>
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-dashboard-card text-text-secondary hover:text-text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-3 pt-4 pb-2">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-dashboard-card transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </Link>
        </div>
        <div className="px-5 pt-2 pb-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Settings</span></div>
        <nav className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            <li>
              <button onClick={() => { setActiveTab('account'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'account' ? 'bg-sidebar-active text-white' : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </button>
            </li>
            {isAdmin && (
              <li>
                <button onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sidebar-active text-white' : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                </button>
              </li>
            )}
          </ul>
        </nav>
        <div className="p-3 border-t border-dashboard-border"><p className="text-[10px] text-text-muted text-center">OrderFlow</p></div>
      </aside>

      {/* Desktop sidebar (locked open) */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar-bg border-r border-dashboard-border flex-col hidden md:flex">
        <div className="flex items-center h-16 border-b border-dashboard-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandLogo size={32} />
            <span className="text-text-primary font-semibold text-sm leading-tight">OrderFlow<br /><span className="font-normal text-xs opacity-70">Order Manager</span></span>
          </Link>
        </div>
        <div className="px-3 pt-4 pb-2">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-dashboard-card transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </Link>
        </div>
        <div className="px-5 pt-2 pb-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Settings</span></div>
        <nav className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            <li>
              <button onClick={() => setActiveTab('account')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'account' ? 'bg-sidebar-active text-white' : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </button>
            </li>
            {isAdmin && (
              <li>
                <button onClick={() => setActiveTab('admin')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sidebar-active text-white' : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                </button>
              </li>
            )}
          </ul>
        </nav>
        <div className="p-3 border-t border-dashboard-border"><p className="text-[10px] text-text-muted text-center">OrderFlow</p></div>
      </aside>

      {/* Desktop spacer */}
      <div className="hidden md:block flex-shrink-0 w-60" />

      {/* Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border">
          <div className="flex items-center justify-between px-6 h-14 md:pl-6 pl-14">
            <h1 className="text-lg font-bold text-text-primary">
              {activeTab === 'admin' ? 'Admin Panel' : 'Account Settings'}
            </h1>
            <ThemeToggle />
          </div>
        </div>
        <div className="px-6 py-6 max-w-4xl">
          {activeTab === 'admin' && isAdmin ? <AdminPlatformSection /> : <AccountSection />}
        </div>
      </main>
    </div>
  );
}
