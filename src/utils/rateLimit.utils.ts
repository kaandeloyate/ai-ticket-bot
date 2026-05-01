import { TICKET_CONFIG } from '../config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();

  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true; // izin ver
    }

    if (entry.count >= limit) return false; // engelle

    entry.count++;
    return true;
  }

  getRemainingTime(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.resetAt - Date.now());
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) this.store.delete(key);
    }
  }
}

export const rateLimiter = new RateLimiter();

// Her saat temizle
setInterval(() => rateLimiter.cleanup(), 60 * 60 * 1000);

export function checkSpam(userId: string): boolean {
  return !rateLimiter.check(
    `spam:${userId}`,
    TICKET_CONFIG.SPAM_THRESHOLD,
    TICKET_CONFIG.SPAM_WINDOW_SECONDS * 1000,
  );
}

export function checkAICooldown(userId: string): {
  allowed: boolean;
  remainingMs: number;
} {
  const allowed = rateLimiter.check(
    `ai:${userId}`,
    1,
    TICKET_CONFIG.AI_COOLDOWN_SECONDS * 1000,
  );
  return {
    allowed,
    remainingMs: allowed ? 0 : rateLimiter.getRemainingTime(`ai:${userId}`),
  };
}
