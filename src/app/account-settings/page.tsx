'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

type SettingsTab = 'account' | 'dropdowns';
type DropdownCategory = 'platforms' | 'mediators' | 'reviewers' | 'banks' | 'orderTypes';

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

/* ─── Dropdown Settings Tab Content ─── */
function DropdownsSection() {
  const { platforms, mediators, reviewers, banks, orderTypes, fetchSettings, saveSettings, initialized } = useSettingsStore();
  const [localPlatforms, setLocalPlatforms] = useState<{ value: string; label: string }[]>([]);
  const [localMediators, setLocalMediators] = useState<string[]>([]);
  const [localReviewers, setLocalReviewers] = useState<string[]>([]);
  const [localBanks, setLocalBanks] = useState<string[]>([]);
  const [localOrderTypes, setLocalOrderTypes] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DropdownCategory>('platforms');

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => {
    if (initialized) {
      setLocalPlatforms([...platforms]);
      setLocalMediators([...mediators]);
      setLocalReviewers([...reviewers]);
      setLocalBanks([...banks]);
      setLocalOrderTypes([...orderTypes]);
    }
  }, [initialized, platforms, mediators, reviewers, banks, orderTypes]);

  const addItem = () => {
    const val = newItem.trim();
    if (!val) return;
    if (activeCategory === 'platforms') {
      const value = val.toLowerCase().replace(/\s+/g, '_');
      if (localPlatforms.some((p) => p.value === value)) { toast.error('Already exists!'); return; }
      setLocalPlatforms([...localPlatforms, { value, label: val }]);
    } else if (activeCategory === 'mediators') {
      if (localMediators.includes(val)) { toast.error('Already exists!'); return; }
      setLocalMediators([...localMediators, val]);
    } else if (activeCategory === 'reviewers') {
      if (localReviewers.includes(val)) { toast.error('Already exists!'); return; }
      setLocalReviewers([...localReviewers, val]);
    } else if (activeCategory === 'banks') {
      if (localBanks.includes(val)) { toast.error('Already exists!'); return; }
      setLocalBanks([...localBanks, val]);
    } else {
      if (localOrderTypes.includes(val)) { toast.error('Already exists!'); return; }
      setLocalOrderTypes([...localOrderTypes, val]);
    }
    setNewItem('');
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(localPlatforms, localMediators, localReviewers, localBanks, localOrderTypes);
    setSaving(false);
    toast.success('Settings saved!');
  };

  const hasChanges = JSON.stringify(localPlatforms) !== JSON.stringify(platforms) ||
    JSON.stringify(localMediators) !== JSON.stringify(mediators) ||
    JSON.stringify(localReviewers) !== JSON.stringify(reviewers) ||
    JSON.stringify(localBanks) !== JSON.stringify(banks) ||
    JSON.stringify(localOrderTypes) !== JSON.stringify(orderTypes);

  const categories: { key: DropdownCategory; label: string; count: number; icon: React.ReactNode }[] = [
    {
      key: 'platforms',
      label: 'Platforms',
      count: localPlatforms.length,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    },
    {
      key: 'mediators',
      label: 'Mediators',
      count: localMediators.length,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      key: 'reviewers',
      label: 'Reviewers',
      count: localReviewers.length,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    },
    {
      key: 'banks',
      label: 'Payment Banks',
      count: localBanks.length,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    },
    {
      key: 'orderTypes' as DropdownCategory,
      label: 'Order Types',
      count: localOrderTypes.length,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
    },
  ];

  const getFilteredItems = () => {
    const q = searchQ.toLowerCase().trim();
    if (activeCategory === 'platforms') {
      return q ? localPlatforms.filter((p) => p.label.toLowerCase().includes(q)) : localPlatforms;
    }
    if (activeCategory === 'mediators') {
      return q ? localMediators.filter((m) => m.toLowerCase().includes(q)) : localMediators;
    }
    if (activeCategory === 'banks') {
      return q ? localBanks.filter((b) => b.toLowerCase().includes(q)) : localBanks;
    }
    if (activeCategory === 'orderTypes') {
      return q ? localOrderTypes.filter((t) => t.toLowerCase().includes(q)) : localOrderTypes;
    }
    return q ? localReviewers.filter((r) => r.toLowerCase().includes(q)) : localReviewers;
  };

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const placeholders: Record<DropdownCategory, string> = {
    platforms: 'Add new platform...',
    mediators: 'Add new mediator name...',
    reviewers: 'Add new reviewer name...',
    banks: 'Add new payment bank...',
    orderTypes: 'Add new order type...',
  };

  return (
    <div className="space-y-5">
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setSearchQ(''); setNewItem(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition flex-shrink-0 ${
              activeCategory === cat.key
                ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
                : 'bg-dashboard-card border border-dashboard-border text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover'
            }`}
          >
            {cat.icon}
            {cat.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeCategory === cat.key ? 'bg-white/20' : 'bg-dashboard-bg'
            }`}>{cat.count}</span>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2.5 bg-dashboard-bg border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder={placeholders[activeCategory]}
          className="flex-1 bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="px-4 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* List */}
      <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-4">
        {activeCategory === 'platforms' ? (
          <DraggableList
            items={getFilteredItems() as { value: string; label: string }[]}
            getKey={(p) => (p as { value: string; label: string }).value}
            getLabel={(p) => (p as { value: string; label: string }).label}
            onReorder={(items) => setLocalPlatforms(items as { value: string; label: string }[])}
            onRemove={(p) => setLocalPlatforms(localPlatforms.filter((x) => x.value !== (p as { value: string; label: string }).value))}
            onEdit={(p, newLabel) => {
              setLocalPlatforms(localPlatforms.map((x) =>
                x.value === (p as { value: string; label: string }).value
                  ? { ...x, label: newLabel }
                  : x
              ));
            }}
          />
        ) : activeCategory === 'mediators' ? (
          <DraggableList
            items={getFilteredItems() as string[]}
            getKey={(m) => m as string}
            getLabel={(m) => m as string}
            onReorder={(items) => setLocalMediators(items as string[])}
            onRemove={(m) => setLocalMediators(localMediators.filter((x) => x !== m))}
            onEdit={(oldName, newName) => {
              setLocalMediators(localMediators.map((x) => x === oldName ? newName : x));
            }}
          />
        ) : activeCategory === 'reviewers' ? (
          <DraggableList
            items={getFilteredItems() as string[]}
            getKey={(r) => r as string}
            getLabel={(r) => r as string}
            onReorder={(items) => setLocalReviewers(items as string[])}
            onRemove={(r) => setLocalReviewers(localReviewers.filter((x) => x !== r))}
            onEdit={(oldName, newName) => {
              setLocalReviewers(localReviewers.map((x) => x === oldName ? newName : x));
            }}
          />
        ) : activeCategory === 'banks' ? (
          <DraggableList
            items={getFilteredItems() as string[]}
            getKey={(b) => b as string}
            getLabel={(b) => b as string}
            onReorder={(items) => setLocalBanks(items as string[])}
            onRemove={(b) => setLocalBanks(localBanks.filter((x) => x !== b))}
            onEdit={(oldName, newName) => {
              setLocalBanks(localBanks.map((x) => x === oldName ? newName : x));
            }}
          />
        ) : (
          <DraggableList
            items={getFilteredItems() as string[]}
            getKey={(t) => t as string}
            getLabel={(t) => t as string}
            onReorder={(items) => setLocalOrderTypes(items as string[])}
            onRemove={(t) => setLocalOrderTypes(localOrderTypes.filter((x) => x !== t))}
            onEdit={(oldName, newName) => {
              setLocalOrderTypes(localOrderTypes.map((x) => x === oldName ? newName : x));
            }}
          />
        )}

        {getFilteredItems().length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">
            {searchQ ? 'No matches found' : 'No items yet. Add one above.'}
          </p>
        )}
      </div>

      {/* Save / Discard */}
      {hasChanges && (
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => { setLocalPlatforms([...platforms]); setLocalMediators([...mediators]); setLocalReviewers([...reviewers]); setLocalBanks([...banks]); setLocalOrderTypes([...orderTypes]); }} className="px-5 py-2.5 bg-dashboard-card text-text-primary text-sm font-medium rounded-lg border border-dashboard-border hover:bg-dashboard-border transition">
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AccountSettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'dropdowns' ? 'dropdowns' : 'account';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'account',
      label: 'Account',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      key: 'dropdowns',
      label: 'Dropdown Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
  ];

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
            {tabs.map((tab) => (
              <li key={tab.key}>
                <button onClick={() => { setActiveTab(tab.key); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? 'bg-sidebar-active text-white' : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'}`}>
                  {tab.icon}<span>{tab.label}</span>
                </button>
              </li>
            ))}
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
            {tabs.map((tab) => (
              <li key={tab.key}>
                <button onClick={() => setActiveTab(tab.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? 'bg-sidebar-active text-white' : 'text-text-secondary hover:bg-dashboard-card hover:text-text-primary'}`}>
                  {tab.icon}<span>{tab.label}</span>
                </button>
              </li>
            ))}
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
              {activeTab === 'account' ? 'Account' : 'Dropdown Settings'}
            </h1>
            <ThemeToggle />
          </div>
        </div>
        <div className="px-6 py-6 max-w-4xl">
          {activeTab === 'account' ? <AccountSection /> : <DropdownsSection />}
        </div>
      </main>
    </div>
  );
}
