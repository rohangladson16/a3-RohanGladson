// Rohan Gladson
// CS 4241: Webware: Computational Technology for Network Information Systems
// main.js 

// FRONT-END (CLIENT) JAVASCRIPT HERE
document.addEventListener('DOMContentLoaded', () => {
  const form  = document.getElementById('workout-form');
  const tbody = document.querySelector('#results tbody');

  // To implement data modification, the adjustment was to 
  // references for edit mode UI
  const submitButton = document.getElementById('submit-btn');
  const cancelButton = document.getElementById('cancel-edit');

  // Now we should be able to  track which row is being 
  // edited (null = adding new)
  let editingIndex = null;
  let currentRows = [];

  /* Implemented, so as to be sure to bail out early, incase
     expected markup isn't present */
    if (!form || !tbody) return;

  /* The purpose of this object helper is to have to where
     it expects rows to be an array of objects from 
     the server*/ 
    const renderTable = (rows = []) => {
      currentRows = rows;
    // Essentially what it does, is that it generate's one <tr> per 
    // workout, filling out our fields
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
            <button class="delete" data-index="${i}">Delete</button>
          </td>
        </tr>
      `).join('');
      };

  /* The purpose of the created object helper is to 
     allow for POST requests that send/receive JSON */
  const jsonFetch = (url, data) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(async (r) => {
      if (!r.ok) throw new Error(`${url} failed: ${r.status}`);
      return r.json();
    });

  /* Now, we can have it to where on the first page load, 
     ask server for all current workouts and render them */ 
  fetch('/read')
    .then(async (r) => {
      if (!r.ok) throw new Error(`GET /read failed: ${r.status}`);
      return r.json();
    })
    .then(renderTable)
    .catch(console.error);  
  
  // Helper validators
  const nonNegNum = (n) => Number.isFinite(n) && n >= 0;
  /* To make sure that inputs such as "0" are not validated 
     the input would have it where there are at least 2 chars 
     and includes a letter (allows names like "5k Run") */
  const validText = (s) => typeof s === 'string' && s.trim().length >= 2 && /[a-z]/i.test(s);

  // For the purpose of being abel to modify inputted data, I have it 
  // to where you switch form between "add" and "edit" modes
  const enterEditMode = (row, index) => {
    editingIndex = index;
    // fill inputs
    document.getElementById('exercise').value = row.exercise ?? '';
    document.getElementById('sets').value     = row.sets ?? 0;
    document.getElementById('reps').value     = row.reps ?? 0;
    document.getElementById('weight').value   = row.weight ?? 0;

    // update buttons
    submitButton.textContent = 'Save Changes';
    cancelButton.hidden = false;
    document.getElementById('exercise').focus();
  };

  const exitEditMode = () => {
    editingIndex = null;
    form.reset();
    submitButton.textContent = 'Add Workout';  // back to add
    cancelButton.hidden = true;
  };

  // So, when the user submits the form (adds a workout)
  form.addEventListener('submit', (e) => {
    e.preventDefault(); 

  // Collect values from form inputs
    const exercise = document.getElementById('exercise').value.trim();
    const sets     = Number(document.getElementById('sets').value);
    const reps     = Number(document.getElementById('reps').value);
    const weight   = Number(document.getElementById('weight').value);

    // Number sanity first
    const numbersAreValid = nonNegNum(sets) && nonNegNum(reps) && nonNegNum(weight);

    // Two allowed patterns:
    const allZero = (sets === 0 && reps === 0 && weight === 0);
    const strengthPattern = (sets > 0 && reps > 0 && weight >= 0);

    if (!validText(exercise) || !numbersAreValid || !(allZero || strengthPattern)) {
      alert(
        'Enter a real exercise name and either:\n' +
        '• sets=0, reps=0, weight=0 (e.g., “Playing basketball”), OR\n' +
        '• sets>0, reps>0, weight≥0 for strength work.'
      );
      return;
    } 

    // Now we just need to build the payload after validation
    const payload = { 
      exercise, sets, reps, weight 
    };

    // Now we have it where we can branch by mode, as in add vs update
    if (editingIndex === null) {
      // ADD
      jsonFetch('/add', payload)
        .then((rows) => {
          renderTable(rows);
          exitEditMode();     // also resets the form
        })
        .catch(console.error);
    } else {
      // UPDATE
      jsonFetch('/update', { index: editingIndex, ...payload })
        .then((rows) => {
          renderTable(rows);
          exitEditMode();
        })
        .catch(console.error);
    }
  });

  // Cancel Edit button 
  cancelButton.addEventListener('click', () => {
    exitEditMode();
  });
 
  /* Lastly, we can now have it where the user should be 
     provided a delete or edit button clicks inside the table body */
  tbody.addEventListener('click', (e) => {
    const editButton = e.target.closest('button.edit');
    const delButton  = e.target.closest('button.delete');

    // Handle edit
    if (editButton) {
      const index = Number(editButton.dataset.index);
      const row = currentRows[index];
    if (!row) return;
      enterEditMode(row, index);
      return;
    }

    // Existing: handle delete
    if (delButton) {
      const index = Number(delButton.dataset.index);
      jsonFetch('/delete', { index })
        .then(renderTable)
        .catch(console.error);
    }
  });
});