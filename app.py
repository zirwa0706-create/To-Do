from flask import Flask, render_template, request, jsonify
from database import init_db, get_db
from datetime import date

app = Flask(__name__)

# ── Initialize database on startup ───────────────────────────
init_db()


# ════════════════════════════════════════
#   HOME PAGE
# ════════════════════════════════════════

@app.route('/')
def home():
    return render_template('index.html')


# ════════════════════════════════════════
#   QUOTES
# ════════════════════════════════════════

@app.route('/api/quote/today', methods=['GET'])
def get_today_quote():
    today = str(date.today())
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM quotes WHERE last_shown = ?', (today,))
    quote = cursor.fetchone()

    if not quote:
        cursor.execute('SELECT * FROM quotes WHERE last_shown IS NULL LIMIT 1')
        quote = cursor.fetchone()

        if not quote:
            cursor.execute('UPDATE quotes SET last_shown = NULL')
            conn.commit()
            cursor.execute('SELECT * FROM quotes LIMIT 1')
            quote = cursor.fetchone()

        cursor.execute('UPDATE quotes SET last_shown = ? WHERE id = ?', (today, quote['id']))
        conn.commit()

    conn.close()
    return jsonify({'quote': quote['quote_text']})


@app.route('/api/quote/add', methods=['POST'])
def add_quote():
    data = request.get_json()
    quote_text = data.get('quote', '').strip()

    if not quote_text:
        return jsonify({'error': 'Quote cannot be empty.'}), 400

    conn = get_db()
    conn.execute('INSERT INTO quotes (quote_text) VALUES (?)', (quote_text,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Quote added!'})


# ════════════════════════════════════════
#   CATEGORIES
# ════════════════════════════════════════

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db()
    rows = conn.execute('SELECT * FROM categories ORDER BY id').fetchall()
    conn.close()
    return jsonify([{'id': r['id'], 'name': r['name'], 'is_pinned': r['is_pinned']} for r in rows])


@app.route('/api/categories/pinned', methods=['GET'])
def get_pinned_categories():
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM categories WHERE is_pinned = 1 LIMIT 4'
    ).fetchall()
    conn.close()
    return jsonify([{'id': r['id'], 'name': r['name']} for r in rows])


@app.route('/api/categories/add', methods=['POST'])
def add_category():
    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Category name cannot be empty.'}), 400

    conn = get_db()
    try:
        conn.execute('INSERT INTO categories (name, is_pinned) VALUES (?, 0)', (name,))
        conn.commit()
    except Exception:
        conn.close()
        return jsonify({'error': 'Category already exists.'}), 409

    conn.close()
    return jsonify({'success': True, 'message': f'Category "{name}" added!'})


@app.route('/api/categories/pin', methods=['POST'])
def pin_category():
    data   = request.get_json()
    cat_id = data.get('id')
    pin    = data.get('pin')

    conn = get_db()

    if pin:
        count = conn.execute('SELECT COUNT(*) FROM categories WHERE is_pinned = 1').fetchone()[0]
        if count >= 4:
            conn.close()
            return jsonify({'error': 'Only 4 categories can be pinned at a time.'}), 400

    conn.execute('UPDATE categories SET is_pinned = ? WHERE id = ?', (1 if pin else 0, cat_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ════════════════════════════════════════
#   TASKS
# ════════════════════════════════════════

@app.route('/api/tasks/add', methods=['POST'])
def add_task():
    """Save a new task from the Add Task popup."""
    data        = request.get_json()
    name        = data.get('name', '').strip()
    category    = data.get('category', '').strip()
    due_date    = data.get('due_date', '').strip()
    description = data.get('description', '').strip()

    # Server-side validation
    if not name:
        return jsonify({'error': 'Task name cannot be empty.'}), 400
    if not category:
        return jsonify({'error': 'Category is required.'}), 400
    if not due_date:
        return jsonify({'error': 'Due date is required.'}), 400

    created_date = str(date.today())

    conn = get_db()
    conn.execute(
        '''INSERT INTO tasks (name, category, due_date, description, is_completed, created_date)
           VALUES (?, ?, ?, ?, 0, ?)''',
        (name, category, due_date, description, created_date)
    )
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': f'Task "{name}" added!'})


@app.route('/api/tasks/today', methods=['GET'])
def get_today_tasks():
    today = str(date.today())
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? AND is_completed = 0 ORDER BY id', (today,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/tasks/today/completed', methods=['GET'])
def get_today_completed():
    today = str(date.today())
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? AND is_completed = 1', (today,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/tasks/category', methods=['GET'])
def get_tasks_by_category():
    today    = str(date.today())
    category = request.args.get('name', '')
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? AND category = ?', (today, category)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ════════════════════════════════════════
#   RUN
# ════════════════════════════════════════

if __name__ == '__main__':
    app.run(debug=True)
