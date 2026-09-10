import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

from scripts.review_usage import UsageGuard, ReviewDeferred


class UsageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'usage.db'
        self.guard = UsageGuard(self.path)

    def test_cache_persists_and_changed_content_requires_new_reservation(self):
        self.assertIsNone(self.guard.acquire('page-hash', 100))
        self.guard.save('page-hash', {'listings': [], 'reviewed_at': 'original'})
        cached = UsageGuard(self.path).acquire('page-hash', 100)
        self.assertTrue(cached['cached'])
        self.assertEqual(cached['reviewed_at'], 'original')
        with self.guard.connect() as db:
            db.execute('UPDATE control SET next_at=0')
        self.assertIsNone(self.guard.acquire('changed-hash', 100))

    def test_failed_attempt_is_counted_and_daily_cap_persists(self):
        with patch('scripts.review_usage.DAILY_CALLS', 1):
            self.guard.acquire('a', 100)
            with self.guard.connect() as db:
                db.execute('UPDATE control SET next_at=0')
            with self.assertRaisesRegex(ReviewDeferred, 'daily'):
                UsageGuard(self.path).acquire('b', 100)

    def test_units_cap_blocks_before_sending(self):
        with patch('scripts.review_usage.DAILY_UNITS', 99):
            with self.assertRaisesRegex(ReviewDeferred, 'daily'):
                self.guard.acquire('a', 100)

    def test_cooldown_survives_restart_and_respects_retry_after(self):
        self.guard.cooldown('1800')
        with self.assertRaisesRegex(ReviewDeferred, 'cooldown'):
            UsageGuard(self.path).acquire('a', 100)
        import time
        with self.guard.connect() as db:
            self.assertGreater(db.execute('SELECT next_at FROM control').fetchone()[0], time.time() + 1790)

    def test_same_page_concurrent_runs_only_reserve_once(self):
        def reserve(_):
            try:
                self.guard.acquire('same', 100)
                return 'reserved'
            except ReviewDeferred:
                return 'deferred'
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertCountEqual(list(pool.map(reserve, range(2))), ['reserved', 'deferred'])

    def test_monthly_cap(self):
        with patch('scripts.review_usage.MONTHLY_CALLS', 0):
            with self.assertRaisesRegex(ReviewDeferred, 'monthly'):
                self.guard.acquire('a', 100)

    def test_expired_cache_requires_another_attempt(self):
        self.guard.acquire('a', 100)
        self.guard.save('a', {'listings': []})
        with self.guard.connect() as db:
            db.execute('UPDATE cache SET expires=0')
            db.execute('UPDATE control SET next_at=0')
        self.assertIsNone(self.guard.acquire('a', 100))
        with self.guard.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM attempts').fetchone()[0], 2)

    def test_retry_after_http_date(self):
        from email.utils import formatdate
        import time
        self.guard.cooldown(formatdate(time.time() + 3600, usegmt=True))
        with self.guard.connect() as db:
            self.assertGreater(db.execute('SELECT next_at FROM control').fetchone()[0], time.time() + 3590)

    def test_pacing_waits_without_holding_transaction(self):
        self.guard.acquire('a', 100)
        def release(_):
            with self.guard.connect() as db:
                db.execute('UPDATE control SET next_at=0')
        with patch('scripts.review_usage.time.sleep', side_effect=release) as sleep:
            self.guard.acquire('b', 100)
            sleep.assert_called_once()
