"""Offline SQLite media-path relocation. Dry-run by default; back up before --apply."""
import argparse
from contextlib import closing
from pathlib import Path
import sqlite3


def relocated(path, old_root, new_root):
    normalized = path.replace('\\', '/')
    old_root = old_root.replace('\\', '/').rstrip('/')
    # Drive-letter paths belong to Windows, where path matching is case-insensitive.
    compare, prefix = (normalized.casefold(), old_root.casefold()) if len(old_root) > 1 and old_root[1] == ':' else (normalized, old_root)
    if not compare.startswith(prefix + '/'):
        return path
    tail = normalized[len(old_root) + 1:]
    if '..' in tail.split('/'):
        raise ValueError('Media path contains parent traversal')
    return new_root.replace('\\', '/').rstrip('/') + '/' + tail


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--old-root', required=True, help='Old media directory as stored in SQLite')
    parser.add_argument('--new-root', required=True, help='Media directory inside the destination runtime, e.g. /data/derived/request_media')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not args.old_root.strip() or not args.new_root.strip():
        parser.error('Roots must not be empty')
    database = Path(args.database).resolve(strict=True)
    mode = 'rw' if args.apply else 'ro'
    with closing(sqlite3.connect(database.as_uri() + '?mode=' + mode, uri=True)) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        changes = []
        for table in ('media_assets', 'storage_file_deletion_failures'):
            if table not in tables:
                continue
            for rowid, path in connection.execute(f'SELECT rowid, path FROM {table}'):
                updated = relocated(path, args.old_root, args.new_root)
                if updated != path:
                    changes.append((table, rowid, path, updated))
        print(f'{len(changes)} paths to relocate')
        for table, _, old, new in changes[:5]:
            print(f'{table}: {old} -> {new}')
        if not args.apply or not changes:
            print('No changes written.' if not args.apply else 'Already relocated, or old root did not match. Check the preview.')
            return
        backup = database.with_name(database.name + '.before-rebase.sqlite3')
        if backup.exists():
            raise FileExistsError(f'Backup already exists; move it to a safe place first: {backup}')
        with closing(sqlite3.connect(backup)) as destination:
            connection.backup(destination)
        connection.execute('BEGIN IMMEDIATE')
        try:
            for table, rowid, old, new in changes:
                cursor = connection.execute(f'UPDATE {table} SET path=? WHERE rowid=? AND path=?', (new, rowid, old))
                if cursor.rowcount != 1:
                    raise RuntimeError('Source changed during relocation; keep the service stopped')
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        print(f'Applied. Backup: {backup}')


if __name__ == '__main__':
    main()
