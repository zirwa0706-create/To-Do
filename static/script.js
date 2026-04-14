// ══════════════════════════════════════
//   GLOBAL STATE — declared first
// ══════════════════════════════════════

let deleteTaskId         = null;
let deleteCallback       = null;
let categoryToDelete     = null;
let activeTaskId         = null;
let newlyCreatedCategory = null;
let cameFromCategories   = false;
let calYear              = new Date().getFullYear();
let calMonth             = new Date().getMonth();

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];


// ══════════════════════════════════════
//   PAGE LOAD
// ══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadTodayQuote();
  loadPinnedCategories();
  loadHomeTasks();
  setDefaultDate();
  loadCategoriesIntoSelect('task-category');
});


// ══════════════════════════════════════
//   HELPERS
// ══════════════════════════════════════

function $(id) { return document.getElementById(id); }

function openModal(overlayId, popupId)  {
  $(overlayId).classList.add('active');
  $(popupId).classList.add('active');
}
function closeModal(overlayId, popupId) {
  $(overlayId).classList.remove('active');
  $(popupId).classList.remove('active');
}

function showError(elId, msg) {
  const el = $(elId);
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError(elId) {
  const el = $(elId);
  el.textContent = '';
  el.style.display = 'none';
}

function setNavActive(id) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $(id).classList.add('active');
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, isError = false) {
  const existing = $('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed; bottom:32px; left:50%; transform:translateX(-50%);
    background:${isError ? '#e05555' : '#57C3EA'}; color:#141414;
    padding:12px 24px; border-radius:10px; font-size:0.85rem;
    font-weight:600; letter-spacing:0.05em; z-index:9999;
    opacity:0; transition:opacity 0.3s ease;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}


// ══════════════════════════════════════
//   QUOTE
// ══════════════════════════════════════

async function loadTodayQuote() {
  try {
    const res  = await fetch('/api/quote/today');
    const data = await res.json();
    if (data.quote) $('quote-text').textContent = data.quote;
  } catch (e) { console.error('Quote load failed', e); }
}

$('open-quote-popup').addEventListener('click', () => {
  openModal('overlay-quote', 'popup-quote');
  $('quote-input').focus();
});
$('close-quote-popup').addEventListener('click', () => closeModal('overlay-quote', 'popup-quote'));
$('overlay-quote').addEventListener('click',     () => closeModal('overlay-quote', 'popup-quote'));

$('save-quote').addEventListener('click', async () => {
  const quote = $('quote-input').value.trim();
  if (!quote) return;
  const res  = await fetch('/api/quote/add', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ quote })
  });
  const data = await res.json();
  if (data.success) {
    showToast('Quote saved to your bank!');
    $('quote-input').value = '';
    closeModal('overlay-quote', 'popup-quote');
  } else {
    showToast(data.error || 'Error saving quote.', true);
  }
});

// ── Quote Bank ─────────────────────────────────────────────

$('open-quote-bank').addEventListener('click', async () => {
  closeModal('overlay-quote', 'popup-quote');
  await loadQuoteBank();
  openModal('overlay-quote-bank', 'popup-quote-bank');
});

$('close-quote-bank').addEventListener('click',  () => closeModal('overlay-quote-bank', 'popup-quote-bank'));
$('overlay-quote-bank').addEventListener('click', () => closeModal('overlay-quote-bank', 'popup-quote-bank'));

$('quote-bank-back').addEventListener('click', () => {
  closeModal('overlay-quote-bank', 'popup-quote-bank');
  openModal('overlay-quote', 'popup-quote');
});

async function loadQuoteBank() {
  try {
    const res    = await fetch('/api/quotes');
    const quotes = await res.json();
    const list   = $('quote-bank-list');
    list.innerHTML = '';

    if (quotes.length === 0) {
      $('quote-bank-empty').style.display = 'block';
      return;
    }
    $('quote-bank-empty').style.display = 'none';

    quotes.forEach(q => {
      const li = document.createElement('li');
      li.className = 'quote-bank-item';
      li.dataset.id = q.id;

      li.innerHTML = `
        <div class="quote-bank-item__text">
          <span class="quote-display">${q.quote_text}</span>
          <textarea class="quote-edit-input" style="display:none;" rows="2">${q.quote_text}</textarea>
        </div>
        <div class="quote-bank-item__actions">
          <button class="quote-bank-btn quote-bank-btn--edit"   title="Edit"><i class='bx bx-edit'></i></button>
          <button class="quote-bank-btn quote-bank-btn--save"   title="Save" style="display:none;"><i class='bx bx-check'></i></button>
          <button class="quote-bank-btn quote-bank-btn--delete" title="Delete"><i class='bx bx-trash'></i></button>
        </div>
      `;

      const displaySpan = li.querySelector('.quote-display');
      const editArea    = li.querySelector('.quote-edit-input');
      const editBtn     = li.querySelector('.quote-bank-btn--edit');
      const saveBtn     = li.querySelector('.quote-bank-btn--save');
      const deleteBtn   = li.querySelector('.quote-bank-btn--delete');

      // Edit
      editBtn.addEventListener('click', () => {
        displaySpan.style.display = 'none';
        editArea.style.display    = 'block';
        editBtn.style.display     = 'none';
        saveBtn.style.display     = 'flex';
        editArea.focus();
      });

      // Save edit
      saveBtn.addEventListener('click', async () => {
        const newText = editArea.value.trim();
        if (!newText) return;
        const res  = await fetch('/api/quote/edit', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id: q.id, quote_text: newText })
        });
        const data = await res.json();
        if (data.success) {
          displaySpan.textContent   = newText;
          displaySpan.style.display = 'inline';
          editArea.style.display    = 'none';
          editBtn.style.display     = 'flex';
          saveBtn.style.display     = 'none';
          showToast('Quote updated!');
        } else { showToast('Could not update quote.', true); }
      });

      // Delete
      deleteBtn.addEventListener('click', async () => {
        const res  = await fetch('/api/quote/delete', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id: q.id })
        });
        const data = await res.json();
        if (data.success) {
          li.remove();
          showToast('Quote deleted.');
          // If list is now empty show message
          if ($('quote-bank-list').children.length === 0) {
            $('quote-bank-empty').style.display = 'block';
          }
        } else { showToast(data.error || 'Could not delete quote.', true); }
      });

      list.appendChild(li);
    });
  } catch (e) { console.error('Could not load quote bank', e); }
}


// ══════════════════════════════════════
//   HOME — LOAD TASKS
// ══════════════════════════════════════

async function loadHomeTasks() {
  await loadTodayPendingTasks();
  await loadTodayCompletedTasks();
}

async function loadTodayPendingTasks() {
  try {
    const res   = await fetch('/api/tasks/today');
    const tasks = await res.json();
    const ul    = $('tasks-today');
    ul.innerHTML = '';
    ul.classList.add('task-list--clickable');

    if (tasks.length === 0) {
      ul.innerHTML = '<li class="task-placeholder">No pending tasks for today.</li>';
      return;
    }
    tasks.forEach(task => {
      const li       = document.createElement('li');
      li.textContent = task.name;
      li.dataset.id  = task.id;
      li.addEventListener('click', () => openQuickPopup(task));
      ul.appendChild(li);
    });
  } catch (e) { console.error('Failed to load today tasks', e); }
}

async function loadTodayCompletedTasks() {
  try {
    const res   = await fetch('/api/tasks/today/completed');
    const tasks = await res.json();
    const ul    = $('tasks-completed');
    ul.innerHTML = '';

    if (tasks.length === 0) {
      ul.innerHTML = '<li class="task-placeholder">No completed tasks yet.</li>';
      return;
    }
    tasks.forEach(task => {
      const li       = document.createElement('li');
      li.textContent = task.name;
      ul.appendChild(li);
    });
  } catch (e) { console.error('Failed to load completed tasks', e); }
}


// ══════════════════════════════════════
//   PINNED CATEGORIES (home page boxes)
// ══════════════════════════════════════

async function loadPinnedCategories() {
  try {
    const res        = await fetch('/api/categories/pinned');
    const categories = await res.json();
    const container  = $('pinned-categories');
    container.innerHTML = '';

    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'category-card';

      if (categories[i]) {
        const cat = categories[i];
        card.setAttribute('data-category', cat.name);
        card.innerHTML = `<span>${cat.name.toUpperCase()}</span>`;
        card.addEventListener('click', () => openCategoryPopup(cat.name));
      } else {
        card.classList.add('category-card--empty');
        card.innerHTML = `<span class="category-card__empty-text">+ PIN A CATEGORY</span>`;
        card.addEventListener('click', async () => {
          setNavActive('nav-categories');
          openModal('overlay-categories', 'popup-categories');
          await loadCategoriesLanes();
        });
      }
      container.appendChild(card);
    }
  } catch (e) { console.error('Failed to load pinned categories', e); }
}


// ══════════════════════════════════════
//   CATEGORY TASKS POPUP (home page)
// ══════════════════════════════════════

$('close-category-popup').addEventListener('click', () => closeModal('overlay-category', 'popup-category'));
$('overlay-category').addEventListener('click',     () => closeModal('overlay-category', 'popup-category'));

async function openCategoryPopup(categoryName) {
  $('category-popup-title').textContent = categoryName.toUpperCase();
  $('category-task-list').innerHTML     = '';
  $('category-empty').style.display     = 'none';
  openModal('overlay-category', 'popup-category');

  try {
    const res   = await fetch(`/api/tasks/category?name=${encodeURIComponent(categoryName)}`);
    const tasks = await res.json();
    if (tasks.length === 0) {
      $('category-empty').style.display = 'block';
    } else {
      tasks.forEach(task => {
        const li       = document.createElement('li');
        li.textContent = task.name;
        $('category-task-list').appendChild(li);
      });
    }
  } catch (e) {
    $('category-empty').textContent   = 'Could not load tasks.';
    $('category-empty').style.display = 'block';
  }
}


// ══════════════════════════════════════
//   ADD TASK POPUP
// ══════════════════════════════════════

function setDefaultDate() {
  const el = $('task-due-date');
  if (el) el.value = todayStr();
}

async function loadCategoriesIntoSelect(selectId) {
  try {
    const res        = await fetch('/api/categories');
    const categories = await res.json();
    const select     = $(selectId);
    if (!select) return;
    while (select.options.length > 1) select.remove(1);
    categories.forEach(cat => {
      const opt       = document.createElement('option');
      opt.value       = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  } catch (e) { console.error('Could not load categories into select', e); }
}

function openAddTaskPopup() {
  $('add-task-form-view').style.display    = 'block';
  $('add-task-success-view').style.display = 'none';
  $('task-name').value        = '';
  $('task-description').value = '';
  if (!cameFromCategories) $('task-category').value = '';
  setDefaultDate();
  hideError('add-task-error');
  openModal('overlay-add-task', 'popup-add-task');
  $('task-name').focus();
}

function closeAddTaskPopup() {
  $('popup-add-task').style.zIndex   = '';
  $('overlay-add-task').style.zIndex = '';
  closeModal('overlay-add-task', 'popup-add-task');
}

$('nav-add').addEventListener('click', e => {
  e.preventDefault();
  cameFromCategories = false;
  setNavActive('nav-add');
  openAddTaskPopup();
});
$('close-add-task').addEventListener('click',   closeAddTaskPopup);
$('cancel-add-task').addEventListener('click',  closeAddTaskPopup);
$('overlay-add-task').addEventListener('click', closeAddTaskPopup);

$('save-task').addEventListener('click', async () => {
  hideError('add-task-error');
  const name        = $('task-name').value.trim();
  const category    = $('task-category').value;
  const dueDate     = $('task-due-date').value;
  const description = $('task-description').value.trim();

  if (!name)     { showError('add-task-error', 'Please enter a task name.'); return; }
  if (!category) { showError('add-task-error', 'Please select a category.'); return; }
  if (!dueDate)  { showError('add-task-error', 'Please pick a due date.');   return; }

  const res  = await fetch('/api/tasks/add', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, category, due_date: dueDate, description })
  });
  const data = await res.json();
  if (data.success) {
    $('success-task-name').textContent       = `"${name}" has been saved successfully.`;
    $('add-task-form-view').style.display    = 'none';
    $('add-task-success-view').style.display = 'block';
    $('success-go-home').textContent = cameFromCategories ? 'BACK TO CATEGORIES' : 'GO HOME';
    loadHomeTasks();
  } else {
    showError('add-task-error', data.error || 'Could not save task.');
  }
});

$('success-add-another').addEventListener('click', () => {
  $('add-task-form-view').style.display    = 'block';
  $('add-task-success-view').style.display = 'none';
  $('task-name').value        = '';
  $('task-description').value = '';
  if (!cameFromCategories) $('task-category').value = '';
  setDefaultDate();
  hideError('add-task-error');
  $('task-name').focus();
});

$('success-go-home').addEventListener('click', () => {
  closeAddTaskPopup();
  if (cameFromCategories) {
    cameFromCategories = false;
    setNavActive('nav-categories');
    loadCategoriesLanes();
  } else {
    setNavActive('nav-home');
  }
});


// ══════════════════════════════════════
//   QUICK ACTION POPUP (tap task on home)
// ══════════════════════════════════════

function openQuickPopup(task) {
  activeTaskId = task.id;
  $('quick-task-name').textContent = task.name;
  openModal('overlay-quick', 'popup-quick');
}

$('close-quick').addEventListener('click',  () => closeModal('overlay-quick', 'popup-quick'));
$('overlay-quick').addEventListener('click', () => closeModal('overlay-quick', 'popup-quick'));

$('quick-complete').addEventListener('click', async () => {
  if (!activeTaskId) return;
  const res  = await fetch(`/api/tasks/${activeTaskId}/complete`, { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    closeModal('overlay-quick', 'popup-quick');
    showToast('Task marked as complete!');
    loadHomeTasks();
  } else { showToast('Could not complete task.', true); }
});

$('quick-edit').addEventListener('click', async () => {
  if (!activeTaskId) return;
  closeModal('overlay-quick', 'popup-quick');
  await openEditTaskPopup(activeTaskId);
});

$('quick-delete').addEventListener('click', () => {
  if (!activeTaskId) return;
  closeModal('overlay-quick', 'popup-quick');
  openConfirmDelete(activeTaskId);
});


// ══════════════════════════════════════
//   EDIT TASK POPUP
// ══════════════════════════════════════

$('close-edit-task').addEventListener('click',   () => closeModal('overlay-edit-task', 'popup-edit-task'));
$('overlay-edit-task').addEventListener('click', () => closeModal('overlay-edit-task', 'popup-edit-task'));

async function openEditTaskPopup(taskId) {
  await loadCategoriesIntoSelect('edit-task-category');
  const res  = await fetch(`/api/tasks/${taskId}`);
  const task = await res.json();

  $('edit-task-id').value          = task.id;
  $('edit-task-name').value        = task.name;
  $('edit-task-category').value    = task.category;
  $('edit-task-due-date').value    = task.due_date;
  $('edit-task-description').value = task.description || '';
  hideError('edit-task-error');
  openModal('overlay-edit-task', 'popup-edit-task');
}

$('save-edit-task').addEventListener('click', async () => {
  hideError('edit-task-error');
  const id          = $('edit-task-id').value;
  const name        = $('edit-task-name').value.trim();
  const category    = $('edit-task-category').value;
  const dueDate     = $('edit-task-due-date').value;
  const description = $('edit-task-description').value.trim();

  if (!name)     { showError('edit-task-error', 'Task name cannot be empty.'); return; }
  if (!category) { showError('edit-task-error', 'Please select a category.');  return; }
  if (!dueDate)  { showError('edit-task-error', 'Please pick a due date.');    return; }

  const res  = await fetch(`/api/tasks/${id}/edit`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, category, due_date: dueDate, description })
  });
  const data = await res.json();
  if (data.success) {
    closeModal('overlay-edit-task', 'popup-edit-task');
    showToast('Task updated!');
    loadHomeTasks();
    if ($('popup-view-tasks').classList.contains('active')) loadViewTasks();
  } else { showError('edit-task-error', data.error || 'Could not update task.'); }
});

$('edit-task-delete').addEventListener('click', () => {
  const id = $('edit-task-id').value;
  closeModal('overlay-edit-task', 'popup-edit-task');
  openConfirmDelete(id);
});


// ══════════════════════════════════════
//   VIEW & EDIT TASKS (nav icon)
// ══════════════════════════════════════

$('nav-edit').addEventListener('click', async e => {
  e.preventDefault();
  setNavActive('nav-edit');
  openModal('overlay-view-tasks', 'popup-view-tasks');
  await loadViewTasks();
});

$('close-view-tasks').addEventListener('click',   () => closeModal('overlay-view-tasks', 'popup-view-tasks'));
$('overlay-view-tasks').addEventListener('click', () => closeModal('overlay-view-tasks', 'popup-view-tasks'));

async function loadViewTasks() {
  // Today
  try {
    const res   = await fetch('/api/tasks/today');
    const tasks = await res.json();
    const ul    = $('view-tasks-today');
    ul.innerHTML = '';
    if (tasks.length === 0) {
      $('view-today-empty').style.display = 'block';
    } else {
      $('view-today-empty').style.display = 'none';
      tasks.forEach(task => ul.appendChild(buildTaskRow(task, 'today')));
    }
  } catch (e) { console.error(e); }

  // Overdue
  try {
    const res   = await fetch('/api/tasks/overdue');
    const tasks = await res.json();
    const ul    = $('view-tasks-overdue');
    ul.innerHTML = '';
    if (tasks.length === 0) {
      $('view-overdue-empty').style.display = 'block';
    } else {
      $('view-overdue-empty').style.display = 'none';
      tasks.forEach(task => ul.appendChild(buildTaskRow(task, 'overdue')));
    }
  } catch (e) { console.error(e); }
}

function buildTaskRow(task, type) {
  const li        = document.createElement('li');
  li.className    = 'task-row';
  const isOverdue = type === 'overdue';

  li.innerHTML = `
    <div class="task-row__info">
      <span class="task-row__name">${task.name}</span>
      <span class="task-row__meta">
        ${task.category}
        ${isOverdue ? `&nbsp;·&nbsp;<span class="overdue-label">Due ${formatDate(task.due_date)}</span>` : ''}
      </span>
    </div>
    <div class="task-row__actions">
      ${!isOverdue
        ? `<button class="task-row-btn task-row-btn--complete" title="Complete"><i class='bx bx-check'></i></button>`
        : `<button class="task-row-btn task-row-btn--reschedule" title="Reschedule"><i class='bx bx-calendar'></i></button>`
      }
      <button class="task-row-btn task-row-btn--edit"   title="Edit"><i class='bx bx-edit'></i></button>
      <button class="task-row-btn task-row-btn--delete" title="Delete"><i class='bx bx-trash'></i></button>
    </div>
  `;

  const completeBtn = li.querySelector('.task-row-btn--complete');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      const res  = await fetch(`/api/tasks/${task.id}/complete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { showToast('Task completed!'); loadViewTasks(); loadHomeTasks(); }
    });
  }

  const rescheduleBtn = li.querySelector('.task-row-btn--reschedule');
  if (rescheduleBtn) {
    rescheduleBtn.addEventListener('click', () => openReschedulePopup(task.id, task.name));
  }

  li.querySelector('.task-row-btn--edit').addEventListener('click', async () => {
    closeModal('overlay-view-tasks', 'popup-view-tasks');
    await openEditTaskPopup(task.id);
  });

  li.querySelector('.task-row-btn--delete').addEventListener('click', () => {
    openConfirmDelete(task.id, () => { loadViewTasks(); loadHomeTasks(); });
  });

  return li;
}


// ══════════════════════════════════════
//   RESCHEDULE POPUP
// ══════════════════════════════════════

$('close-reschedule').addEventListener('click',   () => closeModal('overlay-reschedule', 'popup-reschedule'));
$('overlay-reschedule').addEventListener('click', () => closeModal('overlay-reschedule', 'popup-reschedule'));

function openReschedulePopup(taskId, taskName) {
  $('reschedule-task-id').value         = taskId;
  $('reschedule-task-name').textContent = taskName;
  $('reschedule-date').value            = todayStr();
  hideError('reschedule-error');
  openModal('overlay-reschedule', 'popup-reschedule');
}

$('save-reschedule').addEventListener('click', async () => {
  const id      = $('reschedule-task-id').value;
  const newDate = $('reschedule-date').value;
  if (!newDate) { showError('reschedule-error', 'Please select a new date.'); return; }
  const res  = await fetch(`/api/tasks/${id}/reschedule`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ due_date: newDate })
  });
  const data = await res.json();
  if (data.success) {
    closeModal('overlay-reschedule', 'popup-reschedule');
    showToast('Task rescheduled!');
    loadViewTasks(); loadHomeTasks();
  } else { showError('reschedule-error', 'Could not reschedule task.'); }
});

$('reschedule-delete').addEventListener('click', () => {
  const id = $('reschedule-task-id').value;
  closeModal('overlay-reschedule', 'popup-reschedule');
  openConfirmDelete(id);
});


// ══════════════════════════════════════
//   CONFIRM DELETE
// ══════════════════════════════════════

function openConfirmDelete(taskId, callback = null) {
  categoryToDelete = null;
  deleteTaskId     = taskId;
  deleteCallback   = callback;
  $('confirm-msg').textContent = 'Are you sure you want to delete this task? This cannot be undone.';
  openModal('overlay-confirm', 'popup-confirm');
}

$('confirm-cancel').addEventListener('click', () => {
  categoryToDelete = null;
  closeModal('overlay-confirm', 'popup-confirm');
});
$('overlay-confirm').addEventListener('click', () => {
  categoryToDelete = null;
  closeModal('overlay-confirm', 'popup-confirm');
});

$('confirm-delete').addEventListener('click', async () => {
  // Category delete
  if (categoryToDelete) {
    const res  = await fetch('/api/categories/delete', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: categoryToDelete })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('overlay-confirm', 'popup-confirm');
      showToast(`"${categoryToDelete}" deleted. Tasks moved to Task Bucket.`);
      categoryToDelete = null;
      await loadCategoriesLanes();
      await loadPinnedCategories();
      await loadHomeTasks();
      await loadCategoriesIntoSelect('task-category');
    } else {
      showToast(data.error || 'Could not delete category.', true);
    }
    return;
  }

  // Task delete
  if (!deleteTaskId) return;
  const res  = await fetch(`/api/tasks/${deleteTaskId}/delete`, { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    closeModal('overlay-confirm', 'popup-confirm');
    showToast('Task deleted.');
    loadHomeTasks();
    if (deleteCallback) deleteCallback();
    deleteTaskId   = null;
    deleteCallback = null;
  } else { showToast('Could not delete task.', true); }
});


// ══════════════════════════════════════
//   COMPLETED TASKS BY DATE
// ══════════════════════════════════════

$('nav-completed').addEventListener('click', e => {
  e.preventDefault();
  setNavActive('nav-completed');
  $('completed-date-picker-view').style.display  = 'block';
  $('completed-date-results-view').style.display = 'none';
  $('completed-date-input').value = todayStr();
  hideError('completed-date-error');
  openModal('overlay-completed-date', 'popup-completed-date');
});

$('close-completed-date').addEventListener('click',    () => closeModal('overlay-completed-date', 'popup-completed-date'));
$('close-completed-results').addEventListener('click', () => closeModal('overlay-completed-date', 'popup-completed-date'));
$('overlay-completed-date').addEventListener('click',  () => closeModal('overlay-completed-date', 'popup-completed-date'));

$('completed-date-back').addEventListener('click', () => {
  $('completed-date-picker-view').style.display  = 'block';
  $('completed-date-results-view').style.display = 'none';
});

$('search-completed-date').addEventListener('click', async () => {
  hideError('completed-date-error');
  const selectedDate = $('completed-date-input').value;
  if (!selectedDate) { showError('completed-date-error', 'Please select a date.'); return; }

  try {
    const res   = await fetch(`/api/tasks/completed-by-date?date=${selectedDate}`);
    const tasks = await res.json();

    $('completed-date-picker-view').style.display  = 'none';
    $('completed-date-results-view').style.display = 'block';
    $('completed-date-results-title').textContent  = `COMPLETED — ${formatDate(selectedDate)}`;

    const list = $('completed-date-list');
    list.innerHTML = '';

    if (tasks.length === 0) {
      $('completed-date-empty').style.display = 'block';
      list.style.display = 'none';
    } else {
      $('completed-date-empty').style.display = 'none';
      list.style.display = 'flex';
      tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'result-task-row';
        li.innerHTML = `
          <span class="result-task-row__name">${task.name}</span>
          <span class="result-task-row__meta">${task.category}</span>
          ${task.description ? `<span class="result-task-row__desc">${task.description}</span>` : ''}
        `;
        list.appendChild(li);
      });
    }
  } catch (e) { showError('completed-date-error', 'Could not load tasks. Try again.'); }
});


// ══════════════════════════════════════
//   CATEGORIES MANAGER
// ══════════════════════════════════════

$('nav-categories').addEventListener('click', async e => {
  e.preventDefault();
  setNavActive('nav-categories');
  openModal('overlay-categories', 'popup-categories');
  await loadCategoriesLanes();
});

$('close-categories').addEventListener('click', () => closeModal('overlay-categories', 'popup-categories'));

async function loadCategoriesLanes() {
  try {
    const res        = await fetch('/api/categories');
    const categories = await res.json();
    const lanes      = $('cat-lanes');
    lanes.innerHTML  = '';

    const pinnedCount = categories.filter(c => c.is_pinned).length;
    $('pin-count-label').textContent = `(${pinnedCount}/4 pinned)`;

    if (categories.length === 0) {
      lanes.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No categories yet.</p>';
      return;
    }

    const laneEls = {};
    for (const cat of categories) {
      const lane       = buildCatLane(cat, pinnedCount);
      laneEls[cat.name] = lane;
      lanes.appendChild(lane);
    }
    for (const cat of categories) {
      await loadTasksIntoLane(cat.name, laneEls[cat.name]);
    }
  } catch (e) { console.error('Could not load category lanes', e); }
}

function buildCatLane(cat, pinnedCount) {
  const lane        = document.createElement('div');
  lane.className    = 'cat-lane';
  lane.dataset.cat  = cat.name;

  const isPinned    = cat.is_pinned === 1;
  const canPin      = !isPinned && pinnedCount < 4;
  const isPermanent = cat.name === 'Task Bucket';

  lane.innerHTML = `
    <div class="cat-lane__header">
      <span class="cat-lane__title">
        ${cat.name}
        ${isPermanent ? '<span class="cat-permanent-badge">PERMANENT</span>' : ''}
      </span>
      <div class="cat-lane__btns">
        <button class="cat-lane__pin-btn ${isPinned ? 'cat-lane__pin-btn--active' : ''}"
                data-id="${cat.id}" data-pinned="${isPinned ? '1' : '0'}"
                ${!canPin && !isPinned ? 'disabled' : ''}
                title="${isPinned ? 'Unpin from home' : 'Pin to home'}">
          ${isPinned ? 'Unpin' : 'Pin'}
        </button>
        ${!isPermanent
          ? `<button class="cat-lane__del-btn" data-name="${cat.name}" title="Delete category">
               <i class='bx bx-trash'></i>
             </button>`
          : ''}
      </div>
    </div>
    <div class="cat-lane__tasks"></div>
    <p class="cat-lane__empty" style="display:none;">No tasks</p>
  `;

  lane.querySelector('.cat-lane__pin-btn').addEventListener('click', async (e) => {
    const btn      = e.currentTarget;
    const id       = parseInt(btn.dataset.id);
    const wasPinned = btn.dataset.pinned === '1';
    const res      = await fetch('/api/categories/pin', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id, pin: !wasPinned })
    });
    const data = await res.json();
    if (data.success) { await loadCategoriesLanes(); await loadPinnedCategories(); }
    else { showToast(data.error || 'Could not update pin.', true); }
  });

  const delBtn = lane.querySelector('.cat-lane__del-btn');
  if (delBtn) {
    const catNameToDelete = cat.name; // capture in closure
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      categoryToDelete = catNameToDelete;
      deleteTaskId     = null;
      deleteCallback   = null;
      $('confirm-msg').textContent = `Delete "${catNameToDelete}"? All its tasks will move to Task Bucket.`;
      openModal('overlay-confirm', 'popup-confirm');
    });
  }

  lane.addEventListener('dragover',  e => { e.preventDefault(); lane.classList.add('drag-over'); });
  lane.addEventListener('dragleave', () => lane.classList.remove('drag-over'));
  lane.addEventListener('drop', async e => {
    e.preventDefault();
    lane.classList.remove('drag-over');
    const taskId    = e.dataTransfer.getData('taskId');
    const fromCat   = e.dataTransfer.getData('fromCat');
    const targetCat = lane.dataset.cat;
    if (!taskId || fromCat === targetCat) return;
    const res  = await fetch(`/api/tasks/${taskId}/move-category`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ category: targetCat })
    });
    const data = await res.json();
    if (data.success) { showToast(`Task moved to ${targetCat}!`); await loadCategoriesLanes(); await loadHomeTasks(); }
    else { showToast('Could not move task.', true); }
  });

  return lane;
}

async function loadTasksIntoLane(catName, laneEl) {
  try {
    const res           = await fetch(`/api/tasks/by-category/${encodeURIComponent(catName)}`);
    const tasks         = await res.json();
    const taskContainer = laneEl.querySelector('.cat-lane__tasks');
    const emptyMsg      = laneEl.querySelector('.cat-lane__empty');
    taskContainer.innerHTML = '';

    if (tasks.length === 0) { emptyMsg.style.display = 'block'; return; }
    emptyMsg.style.display = 'none';

    tasks.forEach(task => {
      const card     = document.createElement('div');
      card.className = 'cat-task-card';
      card.draggable = true;
      card.innerHTML = `
        <div class="cat-task-card__name">${task.name}</div>
        <div class="cat-task-card__date">${formatDate(task.due_date)}</div>
      `;
      card.addEventListener('dragstart', e => {
        card.classList.add('dragging');
        e.dataTransfer.setData('taskId',  task.id);
        e.dataTransfer.setData('fromCat', catName);
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      taskContainer.appendChild(card);
    });
  } catch (e) { console.error('Could not load tasks for lane', catName, e); }
}

// Add new category
$('save-new-category').addEventListener('click', async () => {
  hideError('category-add-error');
  const name = $('new-category-input').value.trim();
  if (!name) { showError('category-add-error', 'Please enter a category name.'); return; }

  const res  = await fetch('/api/categories/add', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  if (data.success) {
    $('new-category-input').value = '';
    await loadCategoriesLanes();
    await loadCategoriesIntoSelect('task-category');
    await loadPinnedCategories();
    newlyCreatedCategory = name;
    $('cat-created-msg').textContent = `"${name}" created. Add a task to it now?`;
    openModal('overlay-cat-created', 'popup-cat-created');
  } else { showError('category-add-error', data.error || 'Could not add category.'); }
});

$('new-category-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('save-new-category').click();
});

$('close-cat-created').addEventListener('click', () => {
  closeModal('overlay-cat-created', 'popup-cat-created');
  newlyCreatedCategory = null;
});
$('cat-created-done').addEventListener('click', () => {
  closeModal('overlay-cat-created', 'popup-cat-created');
  newlyCreatedCategory = null;
});

$('cat-created-add-task').addEventListener('click', async () => {
  closeModal('overlay-cat-created', 'popup-cat-created');
  cameFromCategories = true;
  await loadCategoriesIntoSelect('task-category');
  // Raise z-index so add task appears over categories popup
  $('popup-add-task').style.zIndex   = '600';
  $('overlay-add-task').style.zIndex = '500';
  openAddTaskPopup();
  if (newlyCreatedCategory) {
    $('task-category').value = newlyCreatedCategory;
    newlyCreatedCategory = null;
  }
});


// ══════════════════════════════════════
//   CALENDAR
// ══════════════════════════════════════

$('nav-calendar').addEventListener('click', e => {
  e.preventDefault();
  setNavActive('nav-calendar');
  calYear  = new Date().getFullYear();
  calMonth = new Date().getMonth();
  showCalendarGrid();
  renderCalendar();
  openModal('overlay-calendar', 'popup-calendar');
});

$('close-calendar').addEventListener('click',  () => closeModal('overlay-calendar', 'popup-calendar'));
$('overlay-calendar').addEventListener('click', () => closeModal('overlay-calendar', 'popup-calendar'));

$('cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  showCalendarGrid();
  renderCalendar();
});
$('cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  showCalendarGrid();
  renderCalendar();
});
$('cal-back').addEventListener('click', showCalendarGrid);

function showCalendarGrid() {
  $('cal-day-history').style.display = 'none';
  document.querySelector('.cal-grid-wrapper').style.display = 'block';
}

function renderCalendar() {
  $('cal-month-label').textContent = `${MONTHS[calMonth].toUpperCase()} ${calYear}`;
  const grid        = $('cal-grid');
  grid.innerHTML    = '';
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day cal-day--empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell    = document.createElement('div');
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cell.className    = 'cal-day';
    cell.textContent  = d;
    cell.dataset.date = dateStr;
    if (dateStr === today) cell.classList.add('cal-day--today');
    cell.addEventListener('click', () => showDayHistory(dateStr));
    grid.appendChild(cell);
  }
}

async function showDayHistory(dateStr) {
  document.querySelector('.cal-grid-wrapper').style.display = 'none';
  $('cal-day-history').style.display    = 'flex';
  $('cal-day-title').textContent        = `TASKS — ${formatDate(dateStr)}`;
  $('cal-completed-list').innerHTML     = '';
  $('cal-pending-list').innerHTML       = '';
  $('cal-completed-empty').style.display = 'none';
  $('cal-pending-empty').style.display   = 'none';
  $('cal-completed-empty').textContent   = 'None';
  $('cal-pending-empty').textContent     = 'None';

  try {
    const res = await fetch(`/api/tasks/history?date=${dateStr}`);
    const all = await res.json();

    const completed = all.filter(t => t.is_completed === 1);
    const pending   = all.filter(t => t.is_completed === 0);

    if (completed.length === 0) {
      $('cal-completed-empty').style.display = 'block';
    } else {
      completed.forEach(t => {
        const li = document.createElement('li');
        li.textContent = `${t.name}  ·  ${t.category}`;
        $('cal-completed-list').appendChild(li);
      });
    }

    if (pending.length === 0) {
      $('cal-pending-empty').style.display = 'block';
    } else {
      pending.forEach(t => {
        const li = document.createElement('li');
        li.textContent = `${t.name}  ·  ${t.category}`;
        $('cal-pending-list').appendChild(li);
      });
    }
  } catch (e) {
    $('cal-completed-empty').textContent   = 'Could not load.';
    $('cal-completed-empty').style.display = 'block';
  }
}


// ══════════════════════════════════════
//   SIDEBAR — home nav
// ══════════════════════════════════════

$('nav-home').addEventListener('click', e => {
  e.preventDefault();
  setNavActive('nav-home');
});
