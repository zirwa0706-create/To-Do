from flask import Flask, render_template, request, jsonify
from database import init_db, get_db
from datetime import date

app = Flask(__name__)
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
    conn  = get_db()
    cur   = conn.cursor()

    cur.execute('SELECT * FROM quotes WHERE last_shown = ?', (today,))
    quote = cur.fetchone()

    if not quote:
        cur.execute('SELECT * FROM quotes WHERE last_shown IS NULL LIMIT 1')
        quote = cur.fetchone()
        if not quote:
            cur.execute('UPDATE quotes SET last_shown = NULL')
            conn.commit()
            cur.execute('SELECT * FROM quotes LIMIT 1')
            quote = cur.fetchone()
        cur.execute('UPDATE quotes SET last_shown = ? WHERE id = ?', (today, quote['id']))
        conn.commit()

    conn.close()
    return jsonify({'quote': quote['quote_text']})


@app.route('/api/quote/add', methods=['POST'])
def add_quote():
    data       = request.get_json()
    quote_text = data.get('quote', '').strip()
    if not quote_text:
        return jsonify({'error': 'Quote cannot be empty.'}), 400
    conn = get_db()
    conn.execute('INSERT INTO quotes (quote_text) VALUES (?)', (quote_text,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/quotes', methods=['GET'])
def get_all_quotes():
    """Return all quotes in the bank."""
    conn  = get_db()
    rows  = conn.execute('SELECT * FROM quotes ORDER BY id').fetchall()
    conn.close()
    return jsonify([{'id': r['id'], 'quote_text': r['quote_text']} for r in rows])


@app.route('/api/quote/edit', methods=['POST'])
def edit_quote():
    """Edit an existing quote."""
    data       = request.get_json()
    quote_id   = data.get('id')
    quote_text = data.get('quote_text', '').strip()
    if not quote_text:
        return jsonify({'error': 'Quote cannot be empty.'}), 400
    conn = get_db()
    conn.execute('UPDATE quotes SET quote_text = ? WHERE id = ?', (quote_text, quote_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/quote/delete', methods=['POST'])
def delete_quote():
    """Delete a quote from the bank."""
    data     = request.get_json()
    quote_id = data.get('id')
    conn = get_db()
    # Check at least 1 quote will remain
    count = conn.execute('SELECT COUNT(*) FROM quotes').fetchone()[0]
    if count <= 1:
        conn.close()
        return jsonify({'error': 'You must keep at least one quote.'}), 400
    conn.execute('DELETE FROM quotes WHERE id = ?', (quote_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


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
    rows = conn.execute('SELECT * FROM categories WHERE is_pinned = 1 LIMIT 4').fetchall()
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
    return jsonify({'success': True})


@app.route('/api/categories/pin', methods=['POST'])
def pin_category():
    data   = request.get_json()
    cat_id = data.get('id')
    pin    = data.get('pin')
    conn   = get_db()
    if pin:
        count = conn.execute('SELECT COUNT(*) FROM categories WHERE is_pinned = 1').fetchone()[0]
        if count >= 4:
            conn.close()
            return jsonify({'error': 'Only 4 categories can be pinned at a time.'}), 400
    conn.execute('UPDATE categories SET is_pinned = ? WHERE id = ?', (1 if pin else 0, cat_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/categories/delete', methods=['POST'])
def delete_category():
    """Delete a category. Moves all its tasks to Task Bucket. Cannot delete Task Bucket."""
    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
    if name == 'Task Bucket':
        return jsonify({'error': 'Task Bucket cannot be deleted.'}), 403

    conn = get_db()
    # Move all tasks in this category to Task Bucket
    conn.execute(
        "UPDATE tasks SET category = 'Task Bucket' WHERE category = ?", (name,)
    )
    # Delete the category
    conn.execute('DELETE FROM categories WHERE name = ?', (name,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ════════════════════════════════════════
#   TASKS — ADD
# ════════════════════════════════════════

@app.route('/api/tasks/add', methods=['POST'])
def add_task():
    data        = request.get_json()
    name        = data.get('name', '').strip()
    category    = data.get('category', '').strip()
    due_date    = data.get('due_date', '').strip()
    description = data.get('description', '').strip()

    if not name:     return jsonify({'error': 'Task name cannot be empty.'}), 400
    if not category: return jsonify({'error': 'Category is required.'}), 400
    if not due_date: return jsonify({'error': 'Due date is required.'}), 400

    created_date = str(date.today())
    conn = get_db()
    conn.execute(
        'INSERT INTO tasks (name, category, due_date, description, is_completed, created_date) VALUES (?, ?, ?, ?, 0, ?)',
        (name, category, due_date, description, created_date)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'Task "{name}" added!'})


# ════════════════════════════════════════
#   TASKS — READ
# ════════════════════════════════════════

@app.route('/api/tasks/today', methods=['GET'])
def get_today_tasks():
    today = str(date.today())
    conn  = get_db()
    rows  = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? AND is_completed = 0 ORDER BY id', (today,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/tasks/today/completed', methods=['GET'])
def get_today_completed():
    today = str(date.today())
    conn  = get_db()
    rows  = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? AND is_completed = 1', (today,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/tasks/overdue', methods=['GET'])
def get_overdue_tasks():
    """Return incomplete tasks from all previous days."""
    today = str(date.today())
    conn  = get_db()
    rows  = conn.execute(
        'SELECT * FROM tasks WHERE due_date < ? AND is_completed = 0 ORDER BY due_date DESC',
        (today,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/tasks/category', methods=['GET'])
def get_tasks_by_category():
    today    = str(date.today())
    category = request.args.get('name', '')
    conn     = get_db()
    rows     = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? AND category = ?', (today, category)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    """Return a single task by ID."""
    conn = get_db()
    row  = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Task not found.'}), 404
    return jsonify(dict(row))


# ════════════════════════════════════════
#   TASKS — COMPLETE
# ════════════════════════════════════════

@app.route('/api/tasks/<int:task_id>/complete', methods=['POST'])
def complete_task(task_id):
    """Mark a task as completed."""
    conn = get_db()
    conn.execute('UPDATE tasks SET is_completed = 1 WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ════════════════════════════════════════
#   TASKS — EDIT (today's tasks — all fields)
# ════════════════════════════════════════

@app.route('/api/tasks/<int:task_id>/edit', methods=['POST'])
def edit_task(task_id):
    """Edit all fields of a task (for today's tasks)."""
    data        = request.get_json()
    name        = data.get('name', '').strip()
    category    = data.get('category', '').strip()
    due_date    = data.get('due_date', '').strip()
    description = data.get('description', '').strip()

    if not name:     return jsonify({'error': 'Task name cannot be empty.'}), 400
    if not category: return jsonify({'error': 'Category is required.'}), 400
    if not due_date: return jsonify({'error': 'Due date is required.'}), 400

    conn = get_db()
    conn.execute(
        'UPDATE tasks SET name = ?, category = ?, due_date = ?, description = ? WHERE id = ?',
        (name, category, due_date, description, task_id)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ════════════════════════════════════════
#   TASKS — RESCHEDULE (overdue — date only)
# ════════════════════════════════════════

@app.route('/api/tasks/<int:task_id>/reschedule', methods=['POST'])
def reschedule_task(task_id):
    """Change only the due date of an overdue task."""
    data     = request.get_json()
    new_date = data.get('due_date', '').strip()
    if not new_date:
        return jsonify({'error': 'New date is required.'}), 400
    conn = get_db()
    conn.execute('UPDATE tasks SET due_date = ? WHERE id = ?', (new_date, task_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ════════════════════════════════════════
#   TASKS — DELETE
# ════════════════════════════════════════

@app.route('/api/tasks/<int:task_id>/delete', methods=['POST'])
def delete_task(task_id):
    """Permanently delete a task."""
    conn = get_db()
    conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ════════════════════════════════════════
#   TASKS — MOVE CATEGORY (drag & drop)
# ════════════════════════════════════════

@app.route('/api/tasks/<int:task_id>/move-category', methods=['POST'])
def move_task_category(task_id):
    """Move a task to a different category."""
    data         = request.get_json()
    new_category = data.get('category', '').strip()
    if not new_category:
        return jsonify({'error': 'Category is required.'}), 400
    conn = get_db()
    conn.execute('UPDATE tasks SET category = ? WHERE id = ?', (new_category, task_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/tasks/by-category/<string:category_name>', methods=['GET'])
def get_all_tasks_by_category(category_name):
    """Return ALL tasks (any date, incomplete) for a category."""
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM tasks WHERE category = ? AND is_completed = 0 ORDER BY due_date',
        (category_name,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/tasks/history', methods=['GET'])
def get_tasks_history():
    """Return ALL tasks (completed + pending) for a specific date — for calendar."""
    query_date = request.args.get('date', '').strip()
    if not query_date:
        return jsonify({'error': 'Date is required.'}), 400
    conn  = get_db()
    rows  = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? ORDER BY is_completed DESC, id',
        (query_date,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ════════════════════════════════════════
#   COMPLETED TASKS BY DATE
# ════════════════════════════════════════

@app.route('/api/tasks/completed-by-date', methods=['GET'])
def get_completed_by_date():
    """Return all completed tasks for a specific date."""
    query_date = request.args.get('date', '').strip()
    if not query_date:
        return jsonify({'error': 'Date is required.'}), 400
    conn  = get_db()
    rows  = conn.execute(
        'SELECT * FROM tasks WHERE due_date = ? AND is_completed = 1 ORDER BY id',
        (query_date,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ════════════════════════════════════════
#   RUN
# ════════════════════════════════════════

if __name__ == '__main__':
    app.run(debug=True)
