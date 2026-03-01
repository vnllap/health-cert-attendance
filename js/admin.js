// ─── CONFIG ──────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyUbQGYc6kaMGX91JQKgWuGD4CEw2BYjovL-0vO64BJHMbajE1GpioTvvkTbfceFK6l/exec';
const POLL_INTERVAL   = 30000; // 30 seconds (safe for free quota with 4 panels)

// ─── DATA ────────────────────────────────────────────────────────────────
let records        = [];
let editingIdx     = null;
let sortCol        = 'timestamp';
let sortDir        = -1;
let pollTimer      = null;
let lastRowCount   = 0;
let selectedAdminPosition = null;

// Admin-only position options (separate from client's 3 options)
let adminPositionOptions = [
  'Manual', 'Workpass', 'Business Owner',
  'OJT / Student', 'Night Market', 'Replacement', 'Government'
];

// ─── FETCH FROM GOOGLE SHEETS (JSONP — bypasses CORS on GET) ─────────────
function loadRecords() {
  setConnectionStatus('loading');

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    records = JSON.parse(localStorage.getItem('sheetsCache') || '[]');
    records.forEach(ensureAdminFields);
    renderTable();
    setConnectionStatus('offline');
    return;
  }

  // Use JSONP (script tag injection) instead of fetch to avoid CORS blocking.
  // Apps Script GET requests cannot use fetch from external origins —
  // the browser blocks it with "No Access-Control-Allow-Origin header".
  // JSONP works by injecting a <script> tag which is not subject to CORS.
  const callbackName = '_gsCallback_' + Date.now();
  const script = document.createElement('script');
  const timeout = setTimeout(() => {
    cleanup();
    console.error('JSONP timeout');
    setConnectionStatus('error');
  }, 10000);

  window[callbackName] = function(data) {
    cleanup();
    try {
      if (!data || !Array.isArray(data.records)) throw new Error('Bad response');
      const incoming = data.records;
      incoming.forEach(ensureAdminFields);

      if (lastRowCount > 0 && incoming.length > lastRowCount) {
        const diff = incoming.length - lastRowCount;
        showToast(`${diff} new entr${diff === 1 ? 'y' : 'ies'} received`);
      }
      lastRowCount = incoming.length;
      records = incoming;
      localStorage.setItem('sheetsCache', JSON.stringify(records));
      renderTable();
      setConnectionStatus('live');
    } catch(e) {
      console.error('JSONP parse error:', e);
      setConnectionStatus('error');
    }
  };

  function cleanup() {
    clearTimeout(timeout);
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
  }

  script.onerror = function() {
    cleanup();
    console.error('JSONP script load error');
    setConnectionStatus('error');
  };

  script.src = APPS_SCRIPT_URL + '?action=getAll&callback=' + callbackName;
  document.head.appendChild(script);
}

function ensureAdminFields(r) {
  if (!r.status)           r.status = 'Pending';
  if (!r.healthCertNumber) r.healthCertNumber = '';
  if (!r.adminPosition)    r.adminPosition = '';
  if (!r.ref)              r.ref = 'ATT-' + Math.random().toString(36).substr(2,6).toUpperCase();
}

// ─── PUSH EDITS TO SHEETS ────────────────────────────────────────────────
function pushRecordToSheets(record) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    const cache = JSON.parse(localStorage.getItem('sheetsCache') || '[]');
    const idx = cache.findIndex(r => r.ref === record.ref);
    if (idx > -1) cache[idx] = record; else cache.push(record);
    localStorage.setItem('sheetsCache', JSON.stringify(cache));
    return Promise.resolve();
  }
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'update', data: record })
  });
}

function deleteRecordFromSheets(ref) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    const cache = JSON.parse(localStorage.getItem('sheetsCache') || '[]');
    localStorage.setItem('sheetsCache', JSON.stringify(cache.filter(r => r.ref !== ref)));
    return Promise.resolve();
  }
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'delete', ref })
  });
}

// ─── CONNECTION STATUS ───────────────────────────────────────────────────
function setConnectionStatus(state) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    loading: { color: '#f59e0b', label: 'Loading…' },
    live:    { color: '#16a34a', label: 'Live · updates every 30s' },
    offline: { color: '#6b7280', label: 'Offline mode' },
    error:   { color: '#dc2626', label: 'Connection error — retrying' },
  };
  const s = map[state] || map.loading;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── AUTO-POLL ────────────────────────────────────────────────────────────
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(loadRecords, POLL_INTERVAL);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling();
  else { loadRecords(); startPolling(); }
});

// ─── RENDER TABLE ─────────────────────────────────────────────────────────
function renderTable() {
  const search         = document.getElementById('searchInput').value.toLowerCase();
  const filterStatus   = document.getElementById('filterStatus').value;
  const filterAppType  = document.getElementById('filterAppType').value;
  const filterCertType = document.getElementById('filterCertType').value;

  let filtered = records.filter((r, i) => {
    r._idx = i;
    const text = [r.lastName, r.firstName, r.middleName,
                  r.establishmentName, r.ref].join(' ').toLowerCase();
    if (search && !text.includes(search)) return false;
    if (filterStatus   && r.status !== filterStatus) return false;
    if (filterAppType  && r.applicationType !== filterAppType) return false;
    if (filterCertType && r.healthCertificateType !== filterCertType) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const av = (a[sortCol] || '').toString().toLowerCase();
    const bv = (b[sortCol] || '').toString().toLowerCase();
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  document.getElementById('rowCount').textContent =
    filtered.length + ' record' + (filtered.length !== 1 ? 's' : '');

  if (filtered.length === 0) {
    document.getElementById('emptyState').style.display = 'block';
    return;
  }
  document.getElementById('emptyState').style.display = 'none';

  filtered.forEach(r => {
    const ts = r.timestamp ? new Date(r.timestamp).toLocaleString('en-PH', {
      month:'short', day:'numeric', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    }) : '—';

    const statusBadge = r.status === 'Released'
      ? `<span class="badge badge-released"><span class="badge-dot"></span>Released</span>`
      : `<span class="badge badge-pending"><span class="badge-dot"></span>Pending</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${ts}</td>
      <td><strong>${esc(r.lastName || '—')}</strong></td>
      <td>${esc(r.firstName || '—')}</td>
      <td>${esc(r.middleName || '—')}</td>
      <td>${esc(r.gender || '—')}</td>
      <td>${esc(r.applicationType || '—')}</td>
      <td>${esc(r.healthCertificateType || '—')}</td>
      <td>${esc(r.position || '—')}</td>
      <td>${esc(r.adminPosition || '—')}</td>
      <td>${esc(r.lostCertificate || '—')}</td>
      <td>${esc(r.establishmentName || '—')}</td>
      <td class="mono">${esc(r.healthCertNumber || '—')}</td>
      <td>${statusBadge}</td>
    `;
    tr.addEventListener('click', () => openModal(r._idx));
    tbody.appendChild(tr);
  });
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── SORT ─────────────────────────────────────────────────────────────────
function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  document.querySelectorAll('th').forEach(th => th.classList.remove('sorted'));
  document.querySelector(`th[data-col="${col}"]`)?.classList.add('sorted');
  renderTable();
}

// ─── MODAL ────────────────────────────────────────────────────────────────
function openModal(idx) {
  editingIdx = idx;
  const r = records[idx];

  document.getElementById('modalRef').textContent         = 'Ref: ' + (r.ref || '—');
  document.getElementById('m_lastName').value             = r.lastName || '';
  document.getElementById('m_firstName').value            = r.firstName || '';
  document.getElementById('m_middleName').value           = r.middleName || '';
  document.getElementById('m_gender').value               = r.gender || '';
  document.getElementById('m_residentialAddress').value   = r.residentialAddress || '';
  document.getElementById('m_applicationType').value      = r.applicationType || '';
  document.getElementById('m_healthCertificateType').value = r.healthCertificateType || '';
  document.getElementById('m_lostCertificate').value      = r.lostCertificate || '';
  document.getElementById('m_establishmentName').value    = r.establishmentName || '';
  document.getElementById('m_establishmentAddress').value = r.establishmentAddress || '';
  document.getElementById('m_healthCertNumber').value     = r.healthCertNumber || '';
  document.getElementById('m_status').value               = r.status || 'Pending';

  // Read-only client position display
  const clientPos = document.getElementById('m_clientPosition');
  if (clientPos) clientPos.textContent = r.position || '—';

  // Admin position tag picker
  selectedAdminPosition = r.adminPosition || null;
  renderAdminPositionTags();

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  editingIdx = null;
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ─── ADMIN POSITION TAGS ──────────────────────────────────────────────────
function renderAdminPositionTags() {
  const container = document.getElementById('positionTags');
  if (!container) return;
  container.innerHTML = '';
  adminPositionOptions.forEach(pos => {
    const tag = document.createElement('span');
    tag.className = 'pos-tag' + (selectedAdminPosition === pos ? ' active' : '');
    tag.textContent = pos;
    tag.onclick = () => {
      selectedAdminPosition = selectedAdminPosition === pos ? null : pos;
      renderAdminPositionTags();
    };
    container.appendChild(tag);
  });
}

function addCustomPosition() {
  const input = document.getElementById('newPositionInput');
  const val = input.value.trim();
  if (!val) return;
  if (!adminPositionOptions.includes(val)) adminPositionOptions.push(val);
  selectedAdminPosition = val;
  input.value = '';
  localStorage.setItem('adminPositionOptions', JSON.stringify(adminPositionOptions));
  renderAdminPositionTags();
}

// ─── SAVE RECORD ──────────────────────────────────────────────────────────
function saveRecord() {
  if (editingIdx === null) return;

  const r = records[editingIdx];
  r.lastName               = document.getElementById('m_lastName').value.trim();
  r.firstName              = document.getElementById('m_firstName').value.trim();
  r.middleName             = document.getElementById('m_middleName').value.trim();
  r.gender                 = document.getElementById('m_gender').value;
  r.residentialAddress     = document.getElementById('m_residentialAddress').value.trim();
  r.applicationType        = document.getElementById('m_applicationType').value;
  r.healthCertificateType  = document.getElementById('m_healthCertificateType').value;
  r.lostCertificate        = document.getElementById('m_lostCertificate').value;
  r.establishmentName      = document.getElementById('m_establishmentName').value.trim();
  r.establishmentAddress   = document.getElementById('m_establishmentAddress').value.trim();
  r.healthCertNumber       = document.getElementById('m_healthCertNumber').value.trim();
  r.status                 = document.getElementById('m_status').value;
  r.adminPosition          = selectedAdminPosition || '';
  // r.position is NOT touched — it stays as the client submitted it

  pushRecordToSheets(r)
    .then(() => showToast('Record saved'))
    .catch(() => showToast('Saved locally — sync pending'));

  renderTable();
  closeModal();
}

// ─── DELETE ───────────────────────────────────────────────────────────────
function confirmDelete() {
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
}
function deleteRecord() {
  if (editingIdx === null) return;
  const ref = records[editingIdx].ref;
  records.splice(editingIdx, 1);
  deleteRecordFromSheets(ref)
    .then(() => showToast('Record deleted'))
    .catch(() => showToast('Deleted locally — sync pending'));
  renderTable();
  closeConfirm();
  closeModal();
}

// ─── TOAST ────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── EXPORT CSV ───────────────────────────────────────────────────────────
function exportCSV() {
  const headers = [
    'Ref','Timestamp','Last Name','First Name','Middle Name','Gender',
    'Residential Address','Application Type','Health Cert Type','Lost Certificate',
    'Client Position','Admin Position','Establishment Name','Establishment Address',
    'Health Cert Number','Status'
  ];
  const rows = records.map(r => [
    r.ref, r.timestamp, r.lastName, r.firstName, r.middleName, r.gender,
    r.residentialAddress, r.applicationType, r.healthCertificateType, r.lostCertificate,
    r.position, r.adminPosition, r.establishmentName, r.establishmentAddress,
    r.healthCertNumber, r.status
  ].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(','));

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'attendance_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

// ─── AUTH GUARD ───────────────────────────────────────────────────────────
/*
  TODO (PHP migration): replace with server-side session check
  fetch('/api/auth.php').then(r=>r.json()).then(d=>{
    if(!d.loggedIn) window.location.href='admin-login.html';
    else document.getElementById('headerUser').textContent = d.username;
  });
*/
function checkAuth() {
  const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
  if (!session) {
    try {
      if (!window.location.href.includes('admin-login'))
        window.location.href = 'admin-login.html';
    } catch(e) {}
    const u = document.getElementById('headerUser');
    if (u) u.textContent = '(not logged in)';
    return;
  }
  const u = document.getElementById('headerUser');
  if (u) u.textContent = session.username;
}

function logout() {
  stopPolling();
  localStorage.removeItem('adminSession');
  window.location.href = 'admin-login.html';
}

// ─── INIT ─────────────────────────────────────────────────────────────────
checkAuth();

const savedAdminPos = localStorage.getItem('adminPositionOptions');
if (savedAdminPos) adminPositionOptions = JSON.parse(savedAdminPos);

loadRecords();
startPolling();
