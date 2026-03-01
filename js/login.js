/*
  ╔══════════════════════════════════════════════════════════════╗
  ║  localStorage AUTH — TEMPORARY IMPLEMENTATION               ║
  ║                                                              ║
  ║  Users are stored as: localStorage["adminUsers"]            ║
  ║  Format: [{ username: "admin", password: "plain_text" }]    ║
  ║                                                              ║
  ║  Session is stored as: localStorage["adminSession"]         ║
  ║  Format: { username: "admin", loginTime: ISO_string }       ║
  ║                                                              ║
  ║  TODO (PHP migration):                                       ║
  ║  - POST /api/login.php  → validates, sets PHP session        ║
  ║  - GET  /api/auth.php   → checks session, returns user info  ║
  ║  - POST /api/logout.php → destroys PHP session              ║
  ║  - POST /api/users.php  → CRUD for admin_users table        ║
  ╚══════════════════════════════════════════════════════════════╝
*/

// ─── USERS ─────────────────────────────────────────────────────────────
function getUsers() {
  return JSON.parse(localStorage.getItem('adminUsers') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('adminUsers', JSON.stringify(users));
}

// Seed a default admin if no users exist yet
function seedDefault() {
  if (getUsers().length === 0) {
    saveUsers([{ username: 'admin', password: 'admin123' }]);
  }
}

// ─── SESSION ────────────────────────────────────────────────────────────
// TODO (PHP): Replace with server-side session check (session_start / $_SESSION)
function setSession(username) {
  localStorage.setItem('adminSession', JSON.stringify({
    username,
    loginTime: new Date().toISOString()
  }));
}

function getSession() {
  return JSON.parse(localStorage.getItem('adminSession') || 'null');
}

function clearSession() {
  localStorage.removeItem('adminSession');
}

// If already logged in, redirect straight to admin panel
function checkAlreadyLoggedIn() {
  if (getSession()) {
    window.location.href = 'attendance-admin.html';
  }
}

// ─── LOGIN ──────────────────────────────────────────────────────────────
function doLogin() {
  const username = document.getElementById('inputUsername').value.trim();
  const password = document.getElementById('inputPassword').value;
  const btn = document.getElementById('btnLogin');

  hideLoginError();

  if (!username || !password) {
    showLoginError('Please enter both username and password.');
    return;
  }

  // TODO (PHP): Replace with fetch('/api/login.php', { method:'POST', body: formData })
  const users = getUsers();
  const match = users.find(u => u.username === username && u.password === password);

  if (!match) {
    showLoginError('Invalid username or password.');
    document.getElementById('inputPassword').value = '';
    document.getElementById('inputPassword').focus();
    // Shake animation
    btn.style.animation = 'none';
    setTimeout(() => { btn.style.animation = ''; }, 10);
    return;
  }

  setSession(username);
  btn.textContent = 'Redirecting…';
  btn.disabled = true;
  setTimeout(() => { window.location.href = 'attendance-admin.html'; }, 400);
}

// ─── ERROR HELPERS ──────────────────────────────────────────────────────
function showLoginError(msg) {
  document.getElementById('loginErrorMsg').textContent = msg;
  document.getElementById('loginError').classList.add('show');
}
function hideLoginError() {
  document.getElementById('loginError').classList.remove('show');
}

// ─── TOGGLE PASSWORD ────────────────────────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.querySelector('svg').innerHTML = isHidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

// ─── MANAGE PANEL ───────────────────────────────────────────────────────
let manageUnlocked = false;

function toggleManage() {
  const panel = document.getElementById('managePanel');
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (!isOpen && !manageUnlocked) {
    document.getElementById('gatePassword').focus();
  }
}

function unlockManage() {
  const pw = document.getElementById('gatePassword').value;
  const users = getUsers();
  const valid = users.some(u => u.password === pw);

  if (!valid) {
    document.getElementById('gateErr').classList.add('show');
    return;
  }

  document.getElementById('gateErr').classList.remove('show');
  document.getElementById('gatePassword').value = '';
  document.getElementById('manageAuthGate').style.display = 'none';
  document.getElementById('manageContent').style.display = 'block';
  manageUnlocked = true;
  renderUserList();
}

function lockManage() {
  manageUnlocked = false;
  document.getElementById('manageAuthGate').style.display = 'block';
  document.getElementById('manageContent').style.display = 'none';
  document.getElementById('managePanel').classList.remove('open');
  hideManageAlerts();
}

// ─── USER LIST ──────────────────────────────────────────────────────────
function renderUserList() {
  const users = getUsers();
  const list = document.getElementById('userList');
  list.innerHTML = '';

  if (users.length === 0) {
    list.innerHTML = '<p style="font-size:13px;color:var(--text-sub);text-align:center;padding:12px 0;">No accounts yet.</p>';
    return;
  }

  users.forEach((u, i) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    row.innerHTML = `
      <div class="user-row-left">
        <div class="user-avatar">${u.username[0].toUpperCase()}</div>
        <div>
          <div class="user-name">${esc(u.username)}</div>
          <div class="user-role">Admin</div>
        </div>
      </div>
      <button class="btn-del-user" onclick="deleteUser(${i})">Remove</button>
    `;
    list.appendChild(row);
  });
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── ADD USER ───────────────────────────────────────────────────────────
// TODO (PHP): POST to /api/users.php with { action:'add', username, password }
function addUser() {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  hideManageAlerts();

  if (!username || !password) {
    showManageError('Please fill in both username and password.');
    return;
  }

  if (username.length < 3) {
    showManageError('Username must be at least 3 characters.');
    return;
  }

  if (password.length < 6) {
    showManageError('Password must be at least 6 characters.');
    return;
  }

  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    showManageError('Username already exists.');
    return;
  }

  users.push({ username, password });
  saveUsers(users);
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  renderUserList();
  showManageSuccess(`Account "${username}" created.`);
}

// ─── DELETE USER ────────────────────────────────────────────────────────
// TODO (PHP): POST to /api/users.php with { action:'delete', username }
function deleteUser(idx) {
  const users = getUsers();
  if (users.length <= 1) {
    showManageError('Cannot remove the last admin account.');
    return;
  }
  const removed = users[idx].username;
  users.splice(idx, 1);
  saveUsers(users);
  renderUserList();
  showManageSuccess(`Account "${removed}" removed.`);
}

// ─── MANAGE ALERT HELPERS ───────────────────────────────────────────────
function showManageError(msg) {
  document.getElementById('manageErrorMsg').textContent = msg;
  document.getElementById('manageError').classList.add('show');
  document.getElementById('manageSuccess').classList.remove('show');
}
function showManageSuccess(msg) {
  document.getElementById('manageSuccessMsg').textContent = msg;
  document.getElementById('manageSuccess').classList.add('show');
  document.getElementById('manageError').classList.remove('show');
}
function hideManageAlerts() {
  document.getElementById('manageError').classList.remove('show');
  document.getElementById('manageSuccess').classList.remove('show');
}

// ─── INIT ───────────────────────────────────────────────────────────────
seedDefault();
checkAlreadyLoggedIn();
document.getElementById('inputUsername').focus();
