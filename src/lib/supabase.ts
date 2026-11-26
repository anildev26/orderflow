import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * The signed-in user for reading data: taken from the session already in the browser
 * (no network round trip), with a server check only if there is no session. Use it for
 * loading pages; every query is still limited to this user by row-level security.
 * Writes keep calling supabase.auth.getUser(), which always checks with the server.
 */
export async function getSignedInUser(supabase: SupabaseClient): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user;
  } catch {
    // fall through to the server check
  }
  try {
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}
