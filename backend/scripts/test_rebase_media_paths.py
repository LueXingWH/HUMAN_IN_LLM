import contextlib
import io
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

from rebase_media_paths import main, relocated


class RelocateTests(unittest.TestCase):
    def test_roots_and_boundaries(self):
        self.assertEqual(relocated(r'D:\media\user\中文.avif', 'd:/media', '/data/media'), '/data/media/user/中文.avif')
        self.assertEqual(relocated('/old/media-other/a', '/old/media', '/new'), '/old/media-other/a')
        self.assertEqual(relocated('data/media/a', 'data/media', '/data/media'), '/data/media/a')
        self.assertEqual(relocated('/else/a', '/old', '/new'), '/else/a')
        with self.assertRaises(ValueError):
            relocated('/old/../secret', '/old', '/new')

    def test_dry_run_backup_and_repeat(self):
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / 'test.sqlite3'
            with contextlib.closing(sqlite3.connect(db)) as c, c:
                c.execute('CREATE TABLE media_assets(path TEXT UNIQUE)')
                c.execute('CREATE TABLE storage_file_deletion_failures(path TEXT PRIMARY KEY)')
                c.execute("INSERT INTO media_assets VALUES ('D:/media/user/a.avif')")
                c.execute("INSERT INTO storage_file_deletion_failures VALUES ('D:/media/user/b.avif')")
            args = ['rebase', '--database', str(db), '--old-root', 'D:/media', '--new-root', '/data/media']
            with contextlib.redirect_stdout(io.StringIO()):
                with patch.object(sys, 'argv', args):
                    main()
                with contextlib.closing(sqlite3.connect(db)) as c, c:
                    self.assertEqual(c.execute('SELECT path FROM media_assets').fetchone()[0], 'D:/media/user/a.avif')
                with patch.object(sys, 'argv', args + ['--apply']):
                    main()
                with contextlib.closing(sqlite3.connect(db)) as c, c:
                    self.assertEqual(c.execute('SELECT path FROM media_assets').fetchone()[0], '/data/media/user/a.avif')
                    self.assertEqual(c.execute('SELECT path FROM storage_file_deletion_failures').fetchone()[0], '/data/media/user/b.avif')
                with contextlib.closing(sqlite3.connect(str(db) + '.before-rebase.sqlite3')) as c, c:
                    self.assertEqual(c.execute('SELECT path FROM media_assets').fetchone()[0], 'D:/media/user/a.avif')
                with patch.object(sys, 'argv', args + ['--apply']):
                    main()

    def test_failure_rolls_back(self):
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / 'test.sqlite3'
            with contextlib.closing(sqlite3.connect(db)) as c, c:
                c.execute('CREATE TABLE media_assets(path TEXT UNIQUE)')
                c.execute("INSERT INTO media_assets VALUES ('/old/a'),('/new/a')")
            with patch.object(sys, 'argv', ['rebase', '--database', str(db), '--old-root', '/old', '--new-root', '/new', '--apply']):
                with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(sqlite3.IntegrityError):
                    main()
            with contextlib.closing(sqlite3.connect(db)) as c, c:
                self.assertEqual(c.execute('SELECT path FROM media_assets ORDER BY path').fetchall(), [('/new/a',), ('/old/a',)])


if __name__ == '__main__':
    unittest.main()
