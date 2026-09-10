"""Persistent local usage guard for listing reviews (shared by CLI processes)."""
import json
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

STATE_PATH = Path(__file__).resolve().parents[1] / '.vercel/listing-review-usage.sqlite3'
DAILY_CALLS = 25
MONTHLY_CALLS = 200
DAILY_UNITS = 600_000
MONTHLY_UNITS = 4_000_000
INTERVAL = 30
CACHE_TTL = 86400


class ReviewDeferred(ValueError):
    pass


class UsageGuard:
    def __init__(self, path=None):
        self.path = Path(path or STATE_PATH)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS attempts (at REAL NOT NULL, units INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY, next_at REAL NOT NULL);
                INSERT OR IGNORE INTO control VALUES (1, 0);
                CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, expires REAL NOT NULL, payload TEXT);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        try:
            with db:
                yield db
        finally:
            db.close()

    def acquire(self, key, units):
        """Reserve before sending. Failures and unknown outcomes consume the budget."""
        while True:
            now = time.time()
            with self.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                cached = db.execute('SELECT expires, payload FROM cache WHERE key=?', (key,)).fetchone()
                if cached and cached[0] > now:
                    if cached[1] is None:
                        raise ReviewDeferred('This page is already in flight or cooling down')
                    return {**json.loads(cached[1]), 'cached': True}
                next_at = db.execute('SELECT next_at FROM control WHERE id=1').fetchone()[0]
                wait = next_at - now
                if wait > INTERVAL + 1:
                    raise ReviewDeferred('AI Gateway cooldown active; retry after ' +
                                         datetime.fromtimestamp(next_at, timezone.utc).isoformat())
                if wait <= 0:
                    today = datetime.fromtimestamp(now, timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                    for start, calls, ceiling, label in (
                        (today.timestamp(), DAILY_CALLS, DAILY_UNITS, 'daily'),
                        (today.replace(day=1).timestamp(), MONTHLY_CALLS, MONTHLY_UNITS, 'monthly'),
                    ):
                        count, used = db.execute('SELECT count(*), coalesce(sum(units),0) FROM attempts WHERE at>=?', (start,)).fetchone()
                        if count >= calls or used + units > ceiling:
                            raise ReviewDeferred(f'Local {label} LLM usage limit reached')
                    db.execute('INSERT INTO attempts VALUES (?,?)', (now, units))
                    db.execute('UPDATE control SET next_at=? WHERE id=1', (now + INTERVAL,))
                    db.execute('INSERT OR REPLACE INTO cache VALUES (?,?,NULL)', (key, now + 300))
                    db.execute('DELETE FROM cache WHERE expires < ?', (now,))
                    db.execute('DELETE FROM attempts WHERE at < ?', (today.replace(day=1).timestamp(),))
                    return None
            # No database lock is held while waiting. Recheck after another process runs.
            time.sleep(min(wait, INTERVAL))

    def save(self, key, result):
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO cache VALUES (?,?,?)',
                       (key, time.time() + CACHE_TTL, json.dumps(result)))

    def cooldown(self, retry_after=None):
        now = time.time()
        delay = 900.0
        if isinstance(retry_after, str):
            try:
                delay = max(delay, float(retry_after))
            except ValueError:
                try:
                    delay = max(delay, parsedate_to_datetime(retry_after).timestamp() - now)
                except (ValueError, TypeError, OverflowError):
                    pass
        with self.connect() as db:
            db.execute('UPDATE control SET next_at=max(next_at,?) WHERE id=1', (now + delay,))
