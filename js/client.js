// ─── CONFIG ──────────────────────────────────────────────────────────────
// Paste your deployed Apps Script Web App URL here after setup
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyUbQGYc6kaMGX91JQKgWuGD4CEw2BYjovL-0vO64BJHMbajE1GpioTvvkTbfceFK6l/exec';

// ─── STATE ───────────────────────────────────────────────────────────────
const state = {
  gender: null, appType: null, certType: null,
  lost: null, position: null
};

// ─── CLOCK ───────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const str = now.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) + '  ' + now.toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  document.getElementById('liveClock').textContent = str;
}
setInterval(updateClock, 1000);
updateClock();

// ─── RADIO HELPER ────────────────────────────────────────────────────────
function selectRadio(key, value, el) {
  state[key] = value;
  const group = el.closest('.radio-group');
  group.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input[type="radio"]').checked = true;
  hideErr('err-' + key);
}

// ─── TOGGLE HELPER ───────────────────────────────────────────────────────
function setToggle(key, value) {
  state[key] = value;
  const yes = document.getElementById('lostYes');
  const no  = document.getElementById('lostNo');
  yes.className = 'toggle-btn' + (value === 'Yes' ? ' active-yes' : '');
  no.className  = 'toggle-btn' + (value === 'No'  ? ' active-no'  : '');
  hideErr('err-lost');
}

// ─── ERROR HELPERS ───────────────────────────────────────────────────────
function showErr(id, input) {
  document.getElementById(id).classList.add('show');
  if (input) input.classList.add('error');
}

function hideErr(id, input) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
  if (input) input.classList.remove('error');
}

['lastName','firstName','residentialAddress','estabName','estabAddress'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => {
    if (el.value.trim()) hideErr('err-' + id, el);
  });
});

// ─── SUBMIT ──────────────────────────────────────────────────────────────
function submitForm() {
  let valid = true;

  [{ id:'lastName' },{ id:'firstName' },{ id:'residentialAddress' },
   { id:'estabName' },{ id:'estabAddress' }].forEach(f => {
    const el = document.getElementById(f.id);
    if (!el.value.trim()) { showErr('err-' + f.id, el); valid = false; }
    else hideErr('err-' + f.id, el);
  });

  ['gender','appType','certType','position'].forEach(k => {
    if (!state[k]) { showErr('err-' + k); valid = false; }
  });

  if (state.lost === null) { showErr('err-lost'); valid = false; }

  if (!valid) {
    const firstErr = document.querySelector('.error, .field-error.show');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const record = {
    timestamp:             new Date().toISOString(),
    lastName:              document.getElementById('lastName').value.trim(),
    firstName:             document.getElementById('firstName').value.trim(),
    middleName:            document.getElementById('middleName').value.trim(),
    gender:                state.gender,
    residentialAddress:    document.getElementById('residentialAddress').value.trim(),
    applicationType:       state.appType,
    healthCertificateType: state.certType,
    lostCertificate:       state.lost,
    position:              state.position,
    establishmentName:     document.getElementById('estabName').value.trim(),
    establishmentAddress:  document.getElementById('estabAddress').value.trim(),
  };

  // ─── DUPLICATE CHECK — permanent hard block by name ──────────────────
  // Check local cache first (fast, no network call)
  const localKeys = JSON.parse(localStorage.getItem('submittedKeys') || '[]');
  const dupKey = makeDupKey(record);

  if (localKeys.includes(dupKey)) {
    // Find cached record details for the modal
    const cached = JSON.parse(localStorage.getItem('sheetsCache') || '[]');
    const match  = cached.find(r => makeDupKey(r) === dupKey);
    showDupModal(match || record);
    return;
  }

  // Not in local cache — also check sheetsCache (populated by admin poll)
  // in case this is a different device
  const sheetsCache = JSON.parse(localStorage.getItem('sheetsCache') || '[]');
  const sheetMatch  = sheetsCache.find(r => makeDupKey(r) === dupKey);

  if (sheetMatch) {
    // Add to local keys so future checks are instant
    localKeys.push(dupKey);
    localStorage.setItem('submittedKeys', JSON.stringify(localKeys));
    showDupModal(sheetMatch);
    return;
  }

  finalizeSubmit(record);
}

function makeDupKey(r) {
  return (r.lastName + '|' + r.firstName + '|' + r.middleName).toLowerCase().trim();
}

// ─── DUPLICATE MODAL (hard block — no proceed option) ────────────────────
function showDupModal(existing) {
  const ts = existing.timestamp
    ? new Date(existing.timestamp).toLocaleString('en-PH', {
        month:'long', day:'numeric', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      })
    : '—';
  document.getElementById('dupTs').textContent = 'Submitted ' + ts;
  document.getElementById('dupName').textContent =
    [existing.lastName, existing.firstName, existing.middleName].filter(Boolean).join(', ');
  document.getElementById('dupAppType').textContent  = existing.applicationType || '—';
  document.getElementById('dupCertType').textContent = existing.healthCertificateType || '—';
  document.getElementById('dupEstab').textContent    = existing.establishmentName || '—';
  document.getElementById('dupRef').textContent      = existing.ref || '—';
  document.getElementById('dupStatus').textContent   = existing.status || 'Pending';
  document.getElementById('dupOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDupModal() {
  document.getElementById('dupOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── POST TO GOOGLE SHEETS ────────────────────────────────────────────────
function finalizeSubmit(record) {
  const refNum = 'ATT-' + Date.now().toString(36).toUpperCase();
  record.ref          = refNum;
  record.adminPosition = ''; // admin fills this in later
  record.healthCertNumber = '';
  record.status        = 'Pending';

  const btn = document.querySelector('.btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('Apps Script URL not configured. Saving to localStorage only.');
    saveLocalCache(record);
    showSuccess(refNum);
    if (btn) { btn.disabled = false; btn.innerHTML = submitBtnHTML(); }
    return;
  }

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'submit', data: record })
  })
  .then(() => {
    saveLocalCache(record);
    showSuccess(refNum);
  })
  .catch(() => {
    saveLocalCache(record);
    showSuccess(refNum, true);
  })
  .finally(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = submitBtnHTML(); }
  });
}

function submitBtnHTML() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Submit Attendance';
}

// ─── LOCAL CACHE ─────────────────────────────────────────────────────────
function saveLocalCache(record) {
  const cache = JSON.parse(localStorage.getItem('sheetsCache') || '[]');
  cache.push(record);
  localStorage.setItem('sheetsCache', JSON.stringify(cache));

  const keys = JSON.parse(localStorage.getItem('submittedKeys') || '[]');
  const dupKey = makeDupKey(record);
  if (!keys.includes(dupKey)) keys.push(dupKey);
  localStorage.setItem('submittedKeys', JSON.stringify(keys));
}

// ─── SUCCESS ─────────────────────────────────────────────────────────────
function showSuccess(refNum, offline = false) {
  document.getElementById('refCode').textContent = 'Reference No.: ' + refNum;
  const sub = document.querySelector('.success-sub');
  if (sub) sub.textContent = offline
    ? 'Submitted. Note: connection issue detected — please inform the staff.'
    : 'Your form has been successfully submitted.';
  document.getElementById('formWrapper').style.display = 'none';
  document.getElementById('successScreen').classList.add('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── RESET ───────────────────────────────────────────────────────────────
function resetForm() {
  document.getElementById('formWrapper').style.display = 'block';
  document.getElementById('successScreen').classList.remove('show');

  ['lastName','firstName','middleName','residentialAddress','estabName','estabAddress']
    .forEach(id => { document.getElementById(id).value = ''; });

  Object.keys(state).forEach(k => state[k] = null);

  document.querySelectorAll('.radio-option').forEach(o => {
    o.classList.remove('selected');
    const r = o.querySelector('input[type="radio"]');
    if (r) r.checked = false;
  });

  document.getElementById('lostYes').className = 'toggle-btn';
  document.getElementById('lostNo').className  = 'toggle-btn';

  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.error').forEach(e => e.classList.remove('error'));

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
