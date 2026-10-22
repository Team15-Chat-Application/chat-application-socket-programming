from threading import RLock
from time import monotonic
from math import ceil


class LoginLimiter:
    def __init__(self, clock=None, max_keys=10000):
        self.clock = clock if clock is not None else lambda: monotonic() * 1000
        self.max_keys = max_keys
        self._attempts = {}
        self._lock = RLock()

    def consume(self, ip):
        with self._lock:
            now = self.clock()
            if not isinstance(ip, str) or not 1 <= len(ip) <= 128:
                return {'allowed': False, 'retryAfter': 60}
            if ip not in self._attempts and len(self._attempts) >= self.max_keys:
                self._attempts = {key: times for key, times in self._attempts.items() if times[-1] > now - 60000}
                if len(self._attempts) >= self.max_keys:
                    return {'allowed': False, 'retryAfter': 60}
            times = [t for t in self._attempts.get(ip, []) if t > now - 60000]
            if len(times) >= 5:
                return {'allowed': False, 'retryAfter': max(1, ceil((times[0] + 60000 - now) / 1000))}
            times.append(now)
            self._attempts[ip] = times
            return {'allowed': True, 'retryAfter': 0}
