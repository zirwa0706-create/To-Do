// ══════════════════════════════════════
//   ON PAGE LOAD — fetch live data
// ══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadTodayQuote();
  refreshHomeTaskPanels();
  loadPinnedCategories();
  setDefaultDate();
  loadCategoriesIntoSelect();
});


// ══════════════════════════════════════
//   QUOTE — load today's quote
// ══════════════════════════════════════

async function loadTodayQuote() {
  try {
    const res  = await fetch('/api/quote/today');
    const data = await res.json();
    if (data.quote) {
      document.getElementById('quote-text').textContent = data.quote;
    }
  } catch (err) {
    console.error('Could not load quote:', err);
  }
}


// ══════════════════════════════════════
//   QUOTE POPUP — add new quote
// ══════════════════════════════════════

const openQuoteBtn  = document.getElementById('open-quote-popup');
const closeQuoteBtn = document.getElementById('close-quote-popup');
const overlayQuote  = document.getElementById('overlay-quote');
const popupQuote    = document.getElementById('popup-quote');
const saveQuoteBtn  = document.getElementById('save-quote');
const quoteInput    = document.getElementById('quote-input');

function openQuotePopup() {
  popupQuote.classList.add('active');
  overlayQuote.classList.add('active');
  quoteInput.focus();
}

function closeQuotePopup() {
  popupQuote.classList.remove('active');
  overlayQuote.classList.remove('active');
  quoteInput.value = '';
}

openQuoteBtn.addEventListener('click', openQuotePopup);
closeQuoteBtn.addEventListener('click', closeQuotePopup);
overlayQuote.addEventListener('click', closeQuotePopup);

saveQuoteBtn.addEventListener('click', async () => {
  const quote = quoteInput.value.trim();
  if (!quote) return;

  try {
    const res  = await fetch('/api/quote/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ quote })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Quote saved to your bank!');
      closeQuotePopup();
    } else {
      showToast(data.error || 'Something went wrong.', true);
    }
  } catch (err) {
    showToast('Could not save quote.', true);
  }
});


// ══════════════════════════════════════
//   PINNED CATEGORIES — load on home
// ══════════════════════════════════════

async function loadPinnedCategories() {
  try {
    const res        = await fetch('/api/categories/pinned');
    const categories = await res.json();
    const container  = document.getElementById('pinned-categories');

    container.innerHTML = '';

    categories.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.setAttribute('data-category', cat.name);
      card.innerHTML = `<span>${cat.name.toUpperCase()}</span>`;
      card.addEventListener('click', () => openCategoryPopup(cat.name));
      container.appendChild(card);
    });

  } catch (err) {
    console.error('Could not load categories:', err);
  }
}


// ══════════════════════════════════════
//   HOME PANELS — due today + completed
// ══════════════════════════════════════

async function refreshHomeTaskPanels() {
  await Promise.all([loadTodayTasks(), loadCompletedTasks()]);
}

async function loadTodayTasks() {
  const list = document.getElementById('tasks-today');
  list.innerHTML = '<li class="task-item">Loading...</li>';

  try {
    const res = await fetch('/api/tasks/today');
    const tasks = await res.json();

    list.innerHTML = '';
    if (tasks.length === 0) {
      list.innerHTML = '<li class="task-item">No tasks due today.</li>';
      return;
    }

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item';
      li.textContent = task.name;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = '<li class="task-item">Could not load tasks.</li>';
  }
}

async function loadCompletedTasks() {
  const list = document.getElementById('tasks-completed');
  list.innerHTML = '<li>Loading...</li>';

  try {
    const res = await fetch('/api/tasks/today/completed');
    const tasks = await res.json();

    list.innerHTML = '';
    if (tasks.length === 0) {
      list.innerHTML = '<li>No completed tasks yet.</li>';
      return;
    }

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.textContent = task.name;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = '<li>Could not load completed tasks.</li>';
  }
}


// ══════════════════════════════════════
//   CATEGORY POPUP
// ══════════════════════════════════════

const closeCategoryBtn   = document.getElementById('close-category-popup');
const overlayCategory    = document.getElementById('overlay-category');
const popupCategory      = document.getElementById('popup-category');
const categoryPopupTitle = document.getElementById('category-popup-title');
const categoryTaskList   = document.getElementById('category-task-list');
const categoryEmpty      = document.getElementById('category-empty');

async function openCategoryPopup(categoryName) {
  categoryPopupTitle.textContent = categoryName.toUpperCase();
  categoryTaskList.innerHTML     = '';
  categoryEmpty.style.display    = 'none';
  categoryTaskList.style.display = 'flex';

  popupCategory.classList.add('active');
  overlayCategory.classList.add('active');

  try {
    const res   = await fetch(`/api/tasks/category?name=${encodeURIComponent(categoryName)}`);
    const tasks = await res.json();

    if (tasks.length === 0) {
      categoryEmpty.style.display    = 'block';
      categoryTaskList.style.display = 'none';
    } else {
      tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task.name;
        categoryTaskList.appendChild(li);
      });
    }
  } catch (err) {
    categoryEmpty.textContent   = 'Could not load tasks.';
    categoryEmpty.style.display = 'block';
  }
}

function closeCategoryPopup() {
  popupCategory.classList.remove('active');
  overlayCategory.classList.remove('active');
}

closeCategoryBtn.addEventListener('click', closeCategoryPopup);
overlayCategory.addEventListener('click', closeCategoryPopup);


// ══════════════════════════════════════
//   ADD TASK POPUP  (CHUNK 3)
// ══════════════════════════════════════

const overlayAddTask   = document.getElementById('overlay-add-task');
const popupAddTask     = document.getElementById('popup-add-task');
const closeAddTaskBtn  = document.getElementById('close-add-task');
const cancelAddTaskBtn = document.getElementById('cancel-add-task');
const saveTaskBtn      = document.getElementById('save-task');
const addAnotherBtn    = document.getElementById('success-add-another');
const goHomeBtn        = document.getElementById('success-go-home');

const formView         = document.getElementById('add-task-form-view');
const successView      = document.getElementById('add-task-success-view');
const addTaskError     = document.getElementById('add-task-error');

// ── Open the popup ──────────────────────────────────────────

function openAddTaskPopup() {
  showAddTaskForm();   // always start on form view
  popupAddTask.classList.add('active');
  overlayAddTask.classList.add('active');
  document.getElementById('task-name').focus();
}

// ── Close the popup ────────────────────────────────────────

function closeAddTaskPopup() {
  popupAddTask.classList.remove('active');
  overlayAddTask.classList.remove('active');
  resetAddTaskForm();
}

// ── Show form view ─────────────────────────────────────────

function showAddTaskForm() {
  formView.style.display    = 'block';
  successView.style.display = 'none';
  resetAddTaskForm();
}

// ── Reset form fields ──────────────────────────────────────

function resetAddTaskForm() {
  document.getElementById('task-name').value        = '';
  document.getElementById('task-category').value    = '';
  document.getElementById('task-description').value = '';
  setDefaultDate();   // re-set date to today
  hideError();
}

// ── Set date input default to today ───────────────────────

function setDefaultDate() {
  const dateInput = document.getElementById('task-due-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

// ── Load categories into the <select> ─────────────────────

async function loadCategoriesIntoSelect() {
  try {
    const res        = await fetch('/api/categories');
    const categories = await res.json();
    const select     = document.getElementById('task-category');

    // Clear all options except the first placeholder
    while (select.options.length > 1) select.remove(1);

    categories.forEach(cat => {
      const option   = document.createElement('option');
      option.value   = cat.name;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Could not load categories for select:', err);
  }
}

// ── Error helpers ──────────────────────────────────────────

function showError(msg) {
  addTaskError.textContent     = msg;
  addTaskError.style.display   = 'block';
}

function hideError() {
  addTaskError.style.display   = 'none';
  addTaskError.textContent     = '';
}

// ── Save task ──────────────────────────────────────────────

saveTaskBtn.addEventListener('click', async () => {
  hideError();

  const name        = document.getElementById('task-name').value.trim();
  const category    = document.getElementById('task-category').value;
  const dueDate     = document.getElementById('task-due-date').value;
  const description = document.getElementById('task-description').value.trim();

  // Client-side validation
  if (!name)     { showError('Please enter a task name.');     return; }
  if (!category) { showError('Please select a category.');     return; }
  if (!dueDate)  { showError('Please pick a due date.');       return; }

  try {
    const res  = await fetch('/api/tasks/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, category, due_date: dueDate, description })
    });
    const data = await res.json();

    if (data.success) {
      // Show success screen
      document.getElementById('success-task-name').textContent =
        `"${name}" has been saved successfully.`;
      formView.style.display    = 'none';
      successView.style.display = 'block';
      refreshHomeTaskPanels();
    } else {
      showError(data.error || 'Could not save task. Try again.');
    }
  } catch (err) {
    showError('Server error. Please try again.');
  }
});

// ── Success screen buttons ─────────────────────────────────

addAnotherBtn.addEventListener('click', () => {
  showAddTaskForm();
  document.getElementById('task-name').focus();
});

goHomeBtn.addEventListener('click', () => {
  closeAddTaskPopup();
  // set home nav as active
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-home').classList.add('active');
});

// ── Wire close buttons + overlay ──────────────────────────

closeAddTaskBtn.addEventListener('click',  closeAddTaskPopup);
cancelAddTaskBtn.addEventListener('click', closeAddTaskPopup);
overlayAddTask.addEventListener('click',   closeAddTaskPopup);

// ── Wire the sidebar nav-add icon ─────────────────────────

document.getElementById('nav-add').addEventListener('click', e => {
  e.preventDefault();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-add').classList.add('active');
  openAddTaskPopup();
});


// ══════════════════════════════════════
//   SIDEBAR NAV — active state (other icons)
// ══════════════════════════════════════

const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(item => {
  if (item.id === 'nav-add') return;  // already handled above
  item.addEventListener('click', e => {
    e.preventDefault();
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});


// ══════════════════════════════════════
//   TOAST NOTIFICATION
// ══════════════════════════════════════

function showToast(message, isError = false) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id    = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isError ? '#e05555' : '#57C3EA'};
    color: #141414;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}