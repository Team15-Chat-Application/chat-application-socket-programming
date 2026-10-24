const { performance } = require('node:perf_hooks');

class LoginLimiter {
  #attempts = new Map();
  constructor({ clock = () => performance.now(), maxKeys = 10000 } = {}) {
    this.clock = clock;
    this.maxKeys = maxKeys;
  }
  consume(ip) {
    const now = this.clock();
    if (typeof ip !== 'string' || !ip || ip.length > 128) return { allowed: false, retryAfter: 60 };
    if (!this.#attempts.has(ip) && this.#attempts.size >= this.maxKeys) {
      for (const [key, attempts] of this.#attempts) {
        if (attempts.at(-1) <= now - 60000) this.#attempts.delete(key);
      }
      if (this.#attempts.size >= this.maxKeys) return { allowed: false, retryAfter: 60 };
    }
    const attempts = (this.#attempts.get(ip) || []).filter(t => t > now - 60000);
    if (attempts.length >= 5) return { allowed: false, retryAfter: Math.max(1, Math.ceil((attempts[0] + 60000 - now) / 1000)) };
    attempts.push(now);
    this.#attempts.set(ip, attempts);
    return { allowed: true, retryAfter: 0 };
  }
}
module.exports = { LoginLimiter };
