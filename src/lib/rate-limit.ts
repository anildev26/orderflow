// Server-side in-memory rate limiter
// Persists per container instance on Vercel (sufficient for single-app scale)

interface Entry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private store = new Map<string, Entry>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterMs: this.windowMs - (now - entry.windowStart),
      };
    }

    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
  }
}
