import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')


def get_db():
    """Open a database connection and return it."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us access columns by name
    return conn


def init_db():
    """Create all tables if they don't exist, and seed default data."""
    conn = get_db()
    cursor = conn.cursor()

    # ── TASKS TABLE ──────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            category    TEXT    NOT NULL,
            due_date    TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            is_completed INTEGER DEFAULT 0,
            created_date TEXT   NOT NULL
        )
    ''')

    # ── CATEGORIES TABLE ─────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL UNIQUE,
            is_pinned INTEGER DEFAULT 0
        )
    ''')

    # ── QUOTES TABLE ─────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quotes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            quote_text  TEXT NOT NULL,
            last_shown  TEXT DEFAULT NULL
        )
    ''')

    # ── SEED DEFAULT CATEGORIES (only if table is empty) ─────
    cursor.execute('SELECT COUNT(*) FROM categories')
    if cursor.fetchone()[0] == 0:
        default_categories = [
            ('Task Bucket', 0),  # permanent fallback — never deletable
            ('Work',        1),
            ('Study',       1),
            ('Life',        1),
            ('Self',        1),
        ]
        cursor.executemany(
            'INSERT INTO categories (name, is_pinned) VALUES (?, ?)',
            default_categories
        )

    # ── ENSURE Task Bucket always exists (for existing databases) ─
    cursor.execute("SELECT COUNT(*) FROM categories WHERE name = 'Task Bucket'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO categories (name, is_pinned) VALUES ('Task Bucket', 0)")

    # ── SEED DEFAULT QUOTES (only if table is empty) ─────────
    cursor.execute('SELECT COUNT(*) FROM quotes')
    if cursor.fetchone()[0] == 0:
        default_quotes = [
            ("And it's totally okay to bloom alone..",),
            ("Small steps every day lead to big changes.",),
            ("You don't have to be perfect to be productive.",),
            ("One task at a time. That's enough.",),
            ("Progress, not perfection.",),
            ("Show up for yourself today.",),
            ("Done is better than perfect.",),
        ]
        cursor.executemany(
            'INSERT INTO quotes (quote_text) VALUES (?)',
            default_quotes
        )

    conn.commit()
    conn.close()
    print("✅ Database ready.")
