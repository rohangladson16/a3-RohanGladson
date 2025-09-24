// Rohan Gladson
// CS 4241: Webware: Computational Technology for Network Information Systems
// main.js 

// Ask server who is currently logged in
async function apiMe() {
  const res = await fetch("/api/me");
  return res.json(); // { user, firstLogin }
}

// Helpers
function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }

// Prevent double-initialization when refreshView() runs multiple times
let workoutsUIInited = false;

// Attach everything only after the whole page is ready
window.addEventListener("load", () => {
  console.log("[main.js] loaded, binding handlers…");

  const loginForm  = document.getElementById("login-form");
  const logoutForm = document.getElementById("logout-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // Prevents page navigation

      // Send URL-encoded instead of multipart 
      const fd = new FormData(loginForm);
      const body = new URLSearchParams(fd).toString(); // x-www-form-urlencoded
      
      const res = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest" // hint server to return JSON
        },
        body
      });

      if (!res.ok) { alert("Login failed"); return; }
      console.log("[main.js] /login OK, refreshing view");
      await refreshView();
    });
    console.log("[main.js] bound login handler");
  }

  if (logoutForm) {
    logoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const res = await fetch("/logout", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });

      if (!res.ok) { alert("Logout failed"); return; }
      console.log("[main.js] /logout OK, refreshing view");
      await refreshView();
    });
    console.log("[main.js] bound logout handler");
  }

  // Initial render based on session
  refreshView();
});

// Renders correct section based on session state
async function refreshView() {
    try {
        const { user, firstLogin } = await apiMe();
        const loginView = document.getElementById('login-view');
        const appView = document.getElementById('app-view');
        const greet = document.getElementById('greeting');
        const banner = document.getElementById('first-login-banner');
        
        if (user) {
            hide(loginView); show(appView);
            if (greet) greet.textContent = `Welcome, ${user.username}!`;
            if (banner) banner.hidden = !firstLogin;
            initWorkoutsUI(); // no-op on subsequent calls
        } else {
            hide(appView); show(loginView);
        }
    } catch (err) {
        console.error('refreshView failed:', err);
    }
}

// Workouts UI 
function initWorkoutsUI() {
    if (workoutsUIInited) return; // avoid double-binding
    workoutsUIInited = true;

    const form  = document.getElementById('workout-form');
    const tbody = document.querySelector('#results tbody');
    if (!form || !tbody) { console.warn('[workouts] form/table not found'); return; }
    
    const submitButton = document.getElementById('submit-btn');
    const cancelButton = document.getElementById('cancel-edit');
    if (!submitButton || !cancelButton) {
        console.warn('[workouts] missing submit or cancel button');
        return;
    }

  let editingIndex = null;
  let currentRows = [];

  const renderTable = (rows = []) => {
    currentRows = rows;
    const isActivity = (r) => r.sets === 0 && r.reps === 0 && r.weight === 0;
    tbody.innerHTML = rows.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${r.exercise ?? ''}</td>
            <td>${r.sets ?? ''}</td>
            <td>${r.reps ?? ''}</td>
            <td>${r.weight ?? ''}</td>
            <td>${isActivity(r) ? 'N/A' : (r.volume ?? '')}</td>
            <td>
                <button class="edit" data-index="${i}">Edit</button>
                <button class="delete danger" data-index="${i}">Delete</button>
            </td>
        </tr>
    `).join('');
  };

  const jsonFetch = (url, data, method = 'POST') =>
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(async (r) => {
        if (!r.ok) throw new Error(`${method} ${url} failed: ${r.status}`);
        return r.json();
    });

    // Initial load
    fetch('/api/workouts')
    .then((r) => { if (!r.ok) throw new Error(`GET /api/workouts failed: ${r.status}`); return r.json(); })
    .then(renderTable)
    .catch(console.error);

  const nonNegNum = (n) => Number.isFinite(n) && n >= 0;
  const validText = (s) => typeof s === 'string' && s.trim().length >= 2 && /[a-z]/i.test(s);

  const enterEditMode = (row, index) => {
    editingIndex = index;
    document.getElementById('exercise').value = row.exercise ?? '';
    document.getElementById('sets').value = row.sets ?? 0;
    document.getElementById('reps').value = row.reps ?? 0;
    document.getElementById('weight').value = row.weight ?? 0;
    submitButton.textContent = 'Save Changes';
    cancelButton.hidden = false;
    document.getElementById('exercise').focus();
  };

  const exitEditMode = () => {
    editingIndex = null;
    form.reset();
    submitButton.textContent = 'Add Workout';
    cancelButton.hidden = true;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const exercise = document.getElementById('exercise').value.trim();
    const sets = Number(document.getElementById('sets').value);
    const reps = Number(document.getElementById('reps').value);
    const weight = Number(document.getElementById('weight').value);

    const numbersAreValid = nonNegNum(sets) && nonNegNum(reps) && nonNegNum(weight);
    const allZero = (sets === 0 && reps === 0 && weight === 0);
    const strengthPattern = (sets > 0 && reps > 0 && weight >= 0);

    if (!validText(exercise) || !numbersAreValid || !(allZero || strengthPattern)) {
        alert(
            'Enter a real exercise name and either:\n' +
            '• Sets = 0, Reps = 0, Weight = 0 (e.g., "Playing basketball"), OR\n' +
            '• Sets > 0, Reps > 0, Weight >= 0 for Strength Work.'
        );
        return;
    }

    const payload = { exercise, sets, reps, weight };

    // CREATE
    if (editingIndex === null) {
        jsonFetch('/api/workouts', payload, 'POST')
        .then((rows) => { renderTable(rows); exitEditMode(); })
        .catch(console.error);
    } else {
        // UPDATE — matches your current server route. If your server uses REST
        // like PUT /api/workouts/:index, swap to that and pass method='PUT'.
        jsonFetch('/api/update', { index: editingIndex, ...payload }, 'POST')
            .then((rows) => { renderTable(rows); exitEditMode(); })
            .catch(console.error);
    }
  });

  cancelButton.addEventListener('click', () => exitEditMode());

  tbody.addEventListener('click', (e) => {
    const editButton = e.target.closest('button.edit');
    const delButton = e.target.closest('button.delete');
    
    if (editButton) {
        const index = Number(editButton.dataset.index);
        const row = currentRows[index];
        if (row) enterEditMode(row, index);
        return;
    }

    if (delButton) {
        const index = Number(delButton.dataset.index);
        // DELETE — matches your current server route. If server supports
        // DELETE /api/workouts/:index, call jsonFetch(url, null, 'DELETE').
        jsonFetch('/api/delete', { index }, 'POST')
            .then((rows) => renderTable(rows))
            .catch(console.error);
    }
  });
}