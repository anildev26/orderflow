'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface AuthUser {
  email: string;
  displayName: string;
  initials: string;
  createdAt: string;
  createdAtFormatted: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const email = data.user.email || '';
        const meta = data.user.user_metadata || {};
        const displayName = meta.display_name || meta.full_name || meta.name || email.split('@')[0] || 'User';
        const parts = displayName.split(' ');
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : displayName.slice(0, 2).toUpperCase();
        const createdAt = data.user.created_at || '';
        const createdAtFormatted = createdAt
          ? new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'N/A';

        setUser({ email, displayName, initials, createdAt, createdAtFormatted });
      }
      setLoading(false);
    });
  }, []);

  const updateDisplayName = async (name: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (error) throw error;
    if (user) {
      const parts = name.split(' ');
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
      setUser({ ...user, displayName: name, initials });
    }
  };

  return { user, loading, updateDisplayName };
}
