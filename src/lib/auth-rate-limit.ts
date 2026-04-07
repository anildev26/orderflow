// Client-side auth rate limiter using localStorage
// Max 5 attempts per 15 minutes per auth action

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkAuthRateLimit(key: string): { allowed: boolean; waitMinutes: number } {
  if (typeof window === 'undefined') return { allowed: true, waitMinutes: 0 };

  const now = Date.now();
  const raw = localStorage.getItem(key);

  if (!raw) {
    localStorage.setItem(key, JSON.stringify({ attempts: 1, windowStart: now }));
    return { allowed: true, waitMinutes: 0 };
  }

  const data: { attempts: number; windowStart: number } = JSON.parse(raw);

  // Window expired — reset
  if (now - data.windowStart > WINDOW_MS) {
    localStorage.setItem(key, JSON.stringify({ attempts: 1, windowStart: now }));
    return { allowed: true, waitMinutes: 0 };
  }

  if (data.attempts >= MAX_ATTEMPTS) {
    const waitMs = WINDOW_MS - (now - data.windowStart);
    return { allowed: false, waitMinutes: Math.ceil(waitMs / 60000) };
  }

  data.attempts++;
  localStorage.setItem(key, JSON.stringify(data));
  return { allowed: true, waitMinutes: 0 };
}
