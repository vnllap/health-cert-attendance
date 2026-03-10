// ─── CONFIG ──────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyUbQGYc6kaMGX91JQKgWuGD4CEw2BYjovL-0vO64BJHMbajE1GpioTvvkTbfceFK6l/exec';
const POLL_INTERVAL   = 30000;

// ─── DATA ────────────────────────────────────────────────────────────────
let records        = [];
let filteredCache  = []; // last filtered result — used by export current view
let editingIdx     = null;
let sortCol        = 'timestamp';
let sortDir        = -1;
let pollTimer      = null;
let lastRowCount   = 0;
let lastPollTime   = null; // ISO string — used for delta polling
let selectedAdminPosition = null;
let viewMode       = 'today'; // 'today' | 'all'

let adminPositionOptions = [
  'Manual', 'Workpass', 'Business Owner',
  'OJT / Student', 'Night Market', 'Replacement', 'Government'
];

// ─── FETCH FROM GOOGLE SHEETS (JSONP) ────────────────────────────────────
// Supports delta polling: passes ?since=ISO_TIMESTAMP so Apps Script
// can return only new/updated rows, then merges them into the local array.
// Falls back to full fetch if lastPollTime is null (first load).
function loadRecords(forceFull = false) {
  setConnectionStatus('loading');

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    records = JSON.parse(localStorage.getItem('sheetsCache') || '[]');
    records.forEach(ensureAdminFields);
    renderTable();
    setConnectionStatus('offline');
    return;
  }

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

      if (forceFull || !lastPollTime) {
        // Full replace on first load or forced refresh
        records = incoming;
      } else {
        // Delta merge: update/insert incoming rows by ref, keep the rest
        const refMap = new Map(records.map(r => [r.ref, r]));
        incoming.forEach(r => refMap.set(r.ref, r));
        records = Array.from(refMap.values());
      }

      if (lastRowCount > 0 && records.length > lastRowCount) {
        const diff = records.length - lastRowCount;
        showToast(`${diff} new entr${diff === 1 ? 'y' : 'ies'} received`);
      }
      lastRowCount = records.length;
      lastPollTime = new Date().toISOString();
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

  // Pass ?since= for delta polling; Apps Script should honour this parameter
  // and return only rows with timestamp >= since (or all rows if absent)
  const sinceParam = (!forceFull && lastPollTime)
    ? '&since=' + encodeURIComponent(lastPollTime)
    : '';

  script.src = APPS_SCRIPT_URL + '?action=getAll&callback=' + callbackName + sinceParam;
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

// ─── SAVE/LOAD CUSTOM POSITION OPTIONS (Sheets config tab) ──────────────
// Custom positions are pushed to a Sheets "Config" tab via the Apps Script
// and fetched on load, so they survive across devices and browsers.
// Falls back to localStorage if the endpoint is unavailable.
function saveCustomPositionsRemote() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    localStorage.setItem('adminPositionOptions', JSON.stringify(adminPositionOptions));
    return;
  }
  // Persist locally immediately for snappy UI
  localStorage.setItem('adminPositionOptions', JSON.stringify(adminPositionOptions));
  // Also push to Sheets config tab (fire-and-forget)
  fetch(APPS_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'saveConfig', key: 'adminPositionOptions', value: adminPositionOptions })
  }).catch(() => {});
}

function loadCustomPositionsRemote() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    const saved = localStorage.getItem('adminPositionOptions');
    if (saved) adminPositionOptions = JSON.parse(saved);
    return;
  }

  // Use local cache immediately so the UI isn't blank while waiting
  const saved = localStorage.getItem('adminPositionOptions');
  if (saved) adminPositionOptions = JSON.parse(saved);

  // Then try to fetch from Sheets config tab
  const callbackName = '_cfgCallback_' + Date.now();
  const script = document.createElement('script');
  const timeout = setTimeout(() => {
    cleanup();
  }, 5000);

  window[callbackName] = function(data) {
    cleanup();
    try {
      if (data && Array.isArray(data.adminPositionOptions)) {
        adminPositionOptions = data.adminPositionOptions;
        localStorage.setItem('adminPositionOptions', JSON.stringify(adminPositionOptions));
      }
    } catch(e) {}
  };

  function cleanup() {
    clearTimeout(timeout);
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
  }

  script.onerror = cleanup;
  script.src = APPS_SCRIPT_URL + '?action=getConfig&callback=' + callbackName;
  document.head.appendChild(script);
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
  pollTimer = setInterval(() => loadRecords(false), POLL_INTERVAL);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling();
  else { loadRecords(false); startPolling(); }
});

// ─── VIEW MODE TOGGLE ────────────────────────────────────────────────────
function setViewMode(mode) {
  viewMode = mode;
  const btnToday = document.getElementById('btnToday');
  const btnAll   = document.getElementById('btnAll');
  const searchInput = document.getElementById('searchInput');
  if (mode === 'today') {
    btnToday.classList.add('view-btn-active');
    btnAll.classList.remove('view-btn-active');
    searchInput.placeholder = "Search today's records…";
  } else {
    btnAll.classList.add('view-btn-active');
    btnToday.classList.remove('view-btn-active');
    searchInput.placeholder = 'Search all records by name, establishment, ref…';
  }
  renderTable();
}

function getTodayString() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ─── DATE RANGE HELPERS ──────────────────────────────────────────────────
function getDateRange() {
  const from = document.getElementById('filterDateFrom')?.value || '';
  const to   = document.getElementById('filterDateTo')?.value   || '';
  return { from, to };
}

// ─── RENDER TABLE ─────────────────────────────────────────────────────────
function renderTable() {
  const search         = document.getElementById('searchInput').value.toLowerCase();
  const filterStatus   = document.getElementById('filterStatus').value;
  const filterAppType  = document.getElementById('filterAppType').value;
  const filterCertType = document.getElementById('filterCertType').value;
  const { from, to }   = getDateRange();
  const todayStr       = getTodayString();

  // Update today count badge
  const todayCount = records.filter(r => r.timestamp && r.timestamp.startsWith(todayStr)).length;
  const todayBadge = document.getElementById('todayCountBadge');
  if (todayBadge) todayBadge.textContent = todayCount;

  let filtered = records.filter((r, i) => {
    r._idx = i;

    // Today filter
    if (viewMode === 'today' && !search && !from && !to) {
      if (!r.timestamp || !r.timestamp.startsWith(todayStr)) return false;
    }

    // Date range filter (applies in all view modes when set)
    if (from || to) {
      const rowDate = r.timestamp ? r.timestamp.slice(0, 10) : '';
      if (from && rowDate < from) return false;
      if (to   && rowDate > to)   return false;
    }

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

  // Store filtered result for "export current view"
  filteredCache = filtered;

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  document.getElementById('rowCount').textContent =
    filtered.length + ' record' + (filtered.length !== 1 ? 's' : '') +
    (viewMode === 'today' && !search && !from && !to ? ' · today' : '');

  // Re-apply sorted column highlight (fixes reset bug on filter change)
  document.querySelectorAll('th').forEach(th => th.classList.remove('sorted'));
  const sortedTh = document.querySelector(`th[data-col="${sortCol}"]`);
  if (sortedTh) sortedTh.classList.add('sorted');

  if (filtered.length === 0) {
    const emptyEl = document.getElementById('emptyState');
    const emptyP  = emptyEl.querySelector('p');
    if (emptyP) {
      emptyP.textContent = viewMode === 'today' && !search && !from && !to
        ? 'No records for today yet'
        : 'No records found';
    }
    emptyEl.style.display = 'block';
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

    // Flag records that are Released but missing a Health Cert Number
    const certNumDisplay = r.healthCertNumber
      ? esc(r.healthCertNumber)
      : (r.status === 'Released'
          ? '<span class="missing-cert" title="Released but no cert number assigned">— ⚠</span>'
          : '—');

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
      <td class="mono">${certNumDisplay}</td>
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

  const clientPos = document.getElementById('m_clientPosition');
  if (clientPos) clientPos.textContent = r.position || '—';

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
  saveCustomPositionsRemote();
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
// exportAll=true  → exports full dataset (all records)
// exportAll=false → exports only the currently filtered/visible rows
function exportCSV(exportAll = true) {
  const headers = [
    'Ref','Timestamp','Last Name','First Name','Middle Name','Gender',
    'Residential Address','Application Type','Health Cert Type','Lost Certificate',
    'Client Position','Admin Position','Establishment Name','Establishment Address',
    'Health Cert Number','Status'
  ];

  const source = exportAll ? records : filteredCache;

  const rows = source.map(r => [
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
  const suffix = exportAll ? 'all' : 'filtered';
  a.download = `attendance_${suffix}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(exportAll ? 'Full CSV exported' : `Filtered CSV exported (${source.length} rows)`);
}

// ─── MONTHLY REPORT ──────────────────────────────────────────────────────
let reportData    = []; // rows for current report (for CSV export)
let reportMode    = 'monthly'; // 'monthly' | 'daily'
let reportExportLabel = ''; // filename label for CSV

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function openReport() {
  const now = new Date();
  document.getElementById('reportMonth').value = now.getMonth() + 1;
  document.getElementById('reportYear').value  = now.getFullYear();
  // Default date picker to today
  document.getElementById('reportDate').value  = now.toISOString().slice(0, 10);

  _resetReportContent('Select a period to generate a report');
  setReportMode(reportMode); // restore last-used mode
  document.getElementById('reportOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReport() {
  document.getElementById('reportOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleReportOverlayClick(e) {
  if (e.target === document.getElementById('reportOverlay')) closeReport();
}

function setReportMode(mode) {
  reportMode = mode;
  const isMonthly = mode === 'monthly';

  document.getElementById('rModeMonthly').classList.toggle('report-mode-active', isMonthly);
  document.getElementById('rModeDaily').classList.toggle('report-mode-active', !isMonthly);
  document.getElementById('rControlsMonthly').style.display = isMonthly ? 'flex' : 'none';
  document.getElementById('rControlsDaily').style.display   = isMonthly ? 'none' : 'flex';
  document.getElementById('reportModalTitle').textContent   = isMonthly ? 'Monthly Report' : 'Daily Report';

  _resetReportContent('Select a period to generate a report');
}

function _resetReportContent(subtitle) {
  document.getElementById('reportSubtitle').textContent    = subtitle;
  document.getElementById('reportStats').style.display     = 'none';
  document.getElementById('reportTableWrap').style.display = 'none';
  document.getElementById('reportEmpty').style.display     = 'none';
  document.getElementById('reportExportBtn').style.display = 'none';
}

// ── Shared helpers ────────────────────────────────────────────────────────
function _buildBreakdown(sourceRecords, field) {
  const map = {};
  sourceRecords.forEach(r => {
    const key = r[field] || '(Unknown)';
    if (!map[key]) map[key] = { total: 0, released: 0, pending: 0 };
    map[key].total++;
    if (r.status === 'Released') map[key].released++;
    else map[key].pending++;
  });
  return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
}

function _renderBreakdown(tbodyId, entries) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-sub);padding:12px;">No data</td></tr>';
    return;
  }
  entries.forEach(([label, d]) => {
    const r = d.total > 0 ? Math.round((d.released / d.total) * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(label)}</td>
      <td><strong>${d.total}</strong></td>
      <td class="report-released">${d.released}</td>
      <td class="report-pending">${d.pending}</td>
      <td>
        <div class="report-rate-wrap">
          <div class="report-rate-bar"><div class="report-rate-fill" style="width:${r}%"></div></div>
          <span>${r}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function _renderSummaryStats(sourceRecords) {
  const total    = sourceRecords.length;
  const released = sourceRecords.filter(r => r.status === 'Released').length;
  const pending  = total - released;
  const rate     = total > 0 ? Math.round((released / total) * 100) : 0;
  document.getElementById('rTotalNum').textContent    = total;
  document.getElementById('rReleasedNum').textContent = released;
  document.getElementById('rPendingNum').textContent  = pending;
  document.getElementById('rRateNum').textContent     = rate + '%';
  document.getElementById('reportStats').style.display = 'grid';
}

function _renderSharedBreakdowns(sourceRecords) {
  _renderBreakdown('reportCertBody',   _buildBreakdown(sourceRecords, 'healthCertificateType'));
  _renderBreakdown('reportAppBody',    _buildBreakdown(sourceRecords, 'applicationType'));
  _renderBreakdown('reportPosBody',    _buildBreakdown(sourceRecords, 'position'));
  _renderBreakdown('reportGenderBody', _buildBreakdown(sourceRecords, 'gender'));
}

function _showReportContent() {
  document.getElementById('reportTableWrap').style.display  = 'block';
  document.getElementById('reportEmpty').style.display      = 'none';
  document.getElementById('reportExportBtn').style.display  = 'flex';
}

function _showReportEmpty() {
  document.getElementById('reportStats').style.display      = 'none';
  document.getElementById('reportTableWrap').style.display  = 'none';
  document.getElementById('reportEmpty').style.display      = 'block';
  document.getElementById('reportExportBtn').style.display  = 'none';
}

// ── MONTHLY REPORT ────────────────────────────────────────────────────────
function generateReport() {
  const month = parseInt(document.getElementById('reportMonth').value);
  const year  = parseInt(document.getElementById('reportYear').value);

  if (!year || year < 2020 || year > 2099) { showToast('Please enter a valid year'); return; }

  const monthStr = String(month).padStart(2, '0');
  const prefix   = `${year}-${monthStr}`;
  const src      = records.filter(r => r.timestamp && r.timestamp.startsWith(prefix));

  reportData        = src;
  reportExportLabel = `${MONTH_NAMES[month - 1].toLowerCase()}_${year}`;

  document.getElementById('reportSubtitle').textContent =
    `${MONTH_NAMES[month - 1]} ${year}  ·  ${src.length} record${src.length !== 1 ? 's' : ''}`;

  if (src.length === 0) { _showReportEmpty(); return; }

  _renderSummaryStats(src);
  _renderSharedBreakdowns(src);

  // Show weekly section, hide hourly + list (monthly-only sections)
  document.getElementById('reportWeekSection').style.display = 'block';
  document.getElementById('reportHourSection').style.display = 'none';
  document.getElementById('reportListSection').style.display = 'none';

  // Weekly breakdown — days 1–7, 8–14, 15–21, 22–end
  const weekBuckets = [
    { label: `Week 1 (${MONTH_NAMES[month-1]} 1–7)`,   days: [1,7]   },
    { label: `Week 2 (${MONTH_NAMES[month-1]} 8–14)`,  days: [8,14]  },
    { label: `Week 3 (${MONTH_NAMES[month-1]} 15–21)`, days: [15,21] },
    { label: `Week 4 (${MONTH_NAMES[month-1]} 22–31)`, days: [22,31] },
  ];
  const weekEntries = weekBuckets.map(wb => {
    const wr  = src.filter(r => { const d = new Date(r.timestamp).getDate(); return d >= wb.days[0] && d <= wb.days[1]; });
    const rel = wr.filter(r => r.status === 'Released').length;
    return [wb.label, { total: wr.length, released: rel, pending: wr.length - rel }];
  }).filter(([, d]) => d.total > 0);

  _renderBreakdown('reportWeekBody', weekEntries);
  _showReportContent();
}

// ── DAILY REPORT ─────────────────────────────────────────────────────────
function generateDailyReport() {
  const dateVal = document.getElementById('reportDate').value;
  if (!dateVal) { showToast('Please select a date'); return; }

  const src = records.filter(r => r.timestamp && r.timestamp.startsWith(dateVal));

  reportData        = src;
  reportExportLabel = `daily_${dateVal}`;

  // Format date nicely for subtitle
  const [y, m, d] = dateVal.split('-').map(Number);
  const label = `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  document.getElementById('reportSubtitle').textContent =
    `${label}  ·  ${src.length} record${src.length !== 1 ? 's' : ''}`;

  if (src.length === 0) { _showReportEmpty(); return; }

  _renderSummaryStats(src);
  _renderSharedBreakdowns(src);

  // Show hourly + list, hide weekly (daily-only sections)
  document.getElementById('reportWeekSection').style.display = 'none';
  document.getElementById('reportHourSection').style.display = 'block';
  document.getElementById('reportListSection').style.display = 'block';

  // Hourly breakdown — group by hour of submission
  const hourMap = {};
  src.forEach(r => {
    const hr = new Date(r.timestamp).getHours();
    const hrLabel = `${String(hr).padStart(2,'0')}:00 – ${String(hr).padStart(2,'0')}:59`;
    if (!hourMap[hrLabel]) hourMap[hrLabel] = { total: 0, released: 0, pending: 0, _hr: hr };
    hourMap[hrLabel].total++;
    if (r.status === 'Released') hourMap[hrLabel].released++;
    else hourMap[hrLabel].pending++;
  });
  const hourEntries = Object.entries(hourMap).sort((a, b) => a[1]._hr - b[1]._hr);
  _renderBreakdown('reportHourBody', hourEntries);

  // Full applicant list for the day, sorted by timestamp
  const sorted = [...src].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  const listBody = document.getElementById('reportListBody');
  listBody.innerHTML = '';
  sorted.forEach((r, i) => {
    const name = [r.lastName, r.firstName, r.middleName].filter(Boolean).join(', ');
    const time = r.timestamp
      ? new Date(r.timestamp).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' })
      : '—';
    const statusCell = r.status === 'Released'
      ? `<span class="badge badge-released" style="font-size:11px;padding:2px 8px;"><span class="badge-dot"></span>Released</span>`
      : `<span class="badge badge-pending"  style="font-size:11px;padding:2px 8px;"><span class="badge-dot"></span>Pending</span>`;
    const certWarn = !r.healthCertNumber && r.status === 'Released'
      ? ' <span class="missing-cert" title="No cert # assigned">⚠</span>' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono" style="color:var(--text-sub);font-size:11.5px;">${i + 1}&nbsp; <span style="font-weight:400;">${time}</span></td>
      <td><strong>${esc(name || '—')}</strong></td>
      <td>${esc(r.healthCertificateType || '—')}</td>
      <td>${esc(r.applicationType || '—')}</td>
      <td>${esc(r.position || '—')}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;">${esc(r.establishmentName || '—')}</td>
      <td class="mono" style="font-size:12px;">${esc(r.healthCertNumber || '—')}${certWarn}</td>
      <td>${statusCell}</td>
    `;
    listBody.appendChild(tr);
  });

  _showReportContent();
}

// ── Export the currently generated report as CSV ──────────────────────────
function exportReportCSV() {
  if (reportData.length === 0) return;

  const headers = [
    'Ref','Timestamp','Last Name','First Name','Middle Name','Gender',
    'Residential Address','Application Type','Health Cert Type','Lost Certificate',
    'Client Position','Admin Position','Establishment Name','Establishment Address',
    'Health Cert Number','Status'
  ];
  const rows = reportData.map(r => [
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
  a.download = `report_${reportExportLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Report exported — ${reportData.length} records`);
}

// ─── AUTH GUARD ───────────────────────────────────────────────────────────
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

// ─── DATE RANGE CLEAR ────────────────────────────────────────────────────
function clearDateRange() {
  const from = document.getElementById('filterDateFrom');
  const to   = document.getElementById('filterDateTo');
  if (from) from.value = '';
  if (to)   to.value   = '';
  renderTable();
}

// ─── INIT ─────────────────────────────────────────────────────────────────
checkAuth();
loadCustomPositionsRemote();
loadRecords(true); // force full fetch on first load
startPolling();
