// Rohan Gladson
// CS 4241: Webware: Computational Technology for Network Information Systems
// main.js 

// Ask server who is currently logged in
async function apiMe() {
  const res = await fetch("/api/me", { credentials: "include" });
  return res.json(); // { user, firstLogin }
}

// Helpers
function show(el) { 
    if (el) el.hidden = false; 
}

function hide(el) { 
    if (el) el.hidden = true; 
}

function escapeHTML(s = "") { 
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); 
}

// Prevent double-initialization when refreshView() runs multiple times
let workoutsUIInited = false;

// Attach everything only after the whole page is ready
window.addEventListener("load", () => {
  console.log("[main.js] loaded, binding handlers…");
  
  const logoutForm = document.getElementById("logout-form");
  if (logoutForm) {
    logoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const res = await fetch("/logout", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "include"
      });
      if (!res.ok) { alert("Logout failed"); return; }
      console.log("[main.js] /logout OK, refreshing view");
      await refreshView();
    });
    console.log("[main.js] bound logout handler");
  }
  // Initial-Render Based on Session
  refreshView();
});

// Renders Correct Section-Based on Session State
async function refreshView() {
  try {
    const { user } = await apiMe();

    const loginView = document.getElementById('login-view');
    const appView   = document.getElementById('app-view');
    const greet     = document.getElementById('greeting');
    const avatar    = document.getElementById('avatar');

    if (user) {
      // show app
      if (loginView) loginView.hidden = true;
      if (appView)   appView.hidden   = false;

      // greeting
      if (greet) {
        const name = user.displayName || user.username || "User";
        greet.textContent = `Welcome, ${name}!`;
      }

      // avatar (prefer remote, fall back to local)
      if (avatar) {
        const name = user.displayName || user.username || "User";
        const candidate =
          (user.avatar && typeof user.avatar === 'string')
            ? user.avatar
            : '/img/WorkoutLog.svg';

        avatar.src = candidate;
        avatar.alt = name;
        avatar.onerror = () => { avatar.src = '/img/WorkoutLog.svg'; };
      }

      initWorkoutsUI(); // no-op on subsequent calls
    } else {
      // show login
      if (appView)   appView.hidden   = true;
      if (loginView) loginView.hidden = false;
    }
  } catch (err) {
    console.error('refreshView failed:', err);
  }
}

// Workouts UI 
function initWorkoutsUI() {
    if (workoutsUIInited) return; // So as to avoid double-binding
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

  const isActivityRow = (r) =>
  r?.type === 'activity' || (r.sets === 0 && r.reps === 0 && r.weight === 0);

  const renderTable = (rows = []) => {
    currentRows = rows;
    
    // Remove the skeleton/placeholder row if present
    const loadingRow = document.getElementById('loading-row');
    if (loadingRow && loadingRow.parentNode) loadingRow.parentNode.removeChild(loadingRow);

    tbody.innerHTML = rows.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${escapeHTML(r.exercise ?? '')}</td>
            <td>${escapeHTML(r.type ?? 'strength')}</td>
            <td>${r.bodyweight ? 'Yes' : 'No'}</td>
            <td>${r.sets ?? ''}</td>
            <td>${r.reps ?? ''}</td>
            <td>${r.weight ?? ''}</td>
            <td>${isActivityRow(r) ? 'N/A' : (r.volume ?? '')}</td>
            <td>${escapeHTML(r.notes ?? '')}</td>
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(async (r) => {
        if (!r.ok) throw new Error(`${method} ${url} failed: ${r.status}`);
        return r.json();
    });

    // Initial Load
    fetch('/api/workouts', { credentials: 'include' })
    .then((r) => { if (!r.ok) throw new Error(`GET /api/workouts failed: ${r.status}`); return r.json(); })
    .then(renderTable)
    .catch((err) => {
      console.warn('Initial workouts fetch failed (likely not authed):', err);
    });

  const nonNegNum = (n) => Number.isFinite(n) && n >= 0;
  const validText = (s) => typeof s === 'string' && s.trim().length >= 2 && /[a-z]/i.test(s);

  const enterEditMode = (row, index) => {
    editingIndex = index;
    document.getElementById('exercise').value = row.exercise ?? '';
    document.getElementById('sets').value = row.sets ?? 0;
    document.getElementById('reps').value = row.reps ?? 0;
    document.getElementById('weight').value = row.weight ?? 0;
    const typeVal = (row.type === 'activity') ? 'activity' : 'strength';
    const typeRadio = document.querySelector(`input[name="type"][value="${typeVal}"]`);
    if (typeRadio) typeRadio.checked = true;
    
    const bw = document.getElementById('bodyweight');
    if (bw) bw.checked = !!row.bodyweight;
    
    const notesEl = document.getElementById('notes');
    if (notesEl) notesEl.value = row.notes ?? '';

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

    const type = (document.querySelector('input[name="type"]:checked')?.value === 'activity')
      ? 'activity' : 'strength';
    const bodyweight = !!document.getElementById('bodyweight')?.checked;
    const notes = (document.getElementById('notes')?.value || '').trim();

    // Client-side rules to mirror server (server still authoritative)
    const numbersAreValid = nonNegNum(sets) && nonNegNum(reps) && nonNegNum(weight);
    const allZero = (sets === 0 && reps === 0 && weight === 0);
    const strengthPattern = (sets > 0 && reps > 0 && weight >= 0);

    if (!validText(exercise) || !numbersAreValid) {
      alert('Please enter a valid exercise name and non-negative numbers.');
      return;
    }
    if (type === 'activity' && !allZero) {
      alert('Activity rows should use Sets=0, Reps=0, Weight=0.');
      return;
    }
    if (type === 'strength' && !strengthPattern) {
      alert('Strength rows require Sets > 0, Reps > 0, Weight >= 0.');
      return;
    }
    if (notes.length > 500) {
      alert('Notes too long (max 500 characters).');
      return;
    }

    const payload = { exercise, sets, reps, weight, type, bodyweight, notes };

    // Create vs Update
    if (editingIndex === null) {
      jsonFetch('/api/workouts', payload, 'POST')
        .then((rows) => { renderTable(rows); exitEditMode(); })
        .catch(console.error);
    } else {
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