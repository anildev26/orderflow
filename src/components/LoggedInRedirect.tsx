'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

/** Sends an already signed-in visitor to the dashboard without hiding the page. */
export default function LoggedInRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (!cancelled && data.user) router.replace('/dashboard');
      }).catch(() => {});
    } catch {
      // A missing public config must not replace the marketing page.
    }
    return () => { cancelled = true; };
  }, [router]);

  return null;
}
