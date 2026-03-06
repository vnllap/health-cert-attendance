# Health Certificate Attendance System
## Full Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [File Structure](#2-file-structure)
3. [How It Works](#3-how-it-works)
4. [Pages & Features](#4-pages--features)
   - 4.1 [Client Registration Form](#41-client-registration-form)
   - 4.2 [Admin Login](#42-admin-login)
   - 4.3 [Admin Panel](#43-admin-panel)
5. [Data Fields Reference](#5-data-fields-reference)
6. [Google Sheets & Apps Script](#6-google-sheets--apps-script)
7. [Deployment Guide (GitHub Pages)](#7-deployment-guide-github-pages)
8. [Configuration](#8-configuration)
9. [Duplicate Prevention](#9-duplicate-prevention)
10. [Admin Position vs Client Position](#10-admin-position-vs-client-position)
11. [Auto-Refresh & Polling](#11-auto-refresh--polling)
12. [Authentication](#12-authentication)
13. [CSV Export](#13-csv-export)
14. [Known Limitations & Future Improvements](#14-known-limitations--future-improvements)
15. [Troubleshooting](#15-troubleshooting)
16. [Changelog](#16-changelog)

---

## 1. Project Overview

A web-based attendance and registration system for health certificate applicants.
Built with plain HTML, CSS, and JavaScript — no frameworks, no build tools.
Data is stored in Google Sheets via a Google Apps Script Web App.
The client form is hosted on GitHub Pages (free, always online).

**Tech stack:**
- Frontend: HTML5, CSS3, vanilla JavaScript
- Storage: Google Sheets (via Apps Script)
- Hosting: GitHub Pages (client + admin)
- Auth: localStorage-based (to be replaced with PHP sessions)

---

## 2. File Structure

Deploy this exact structure to your GitHub repository root:

```
/
├── index.html                  ← Rename of attendance-client.html (GitHub Pages root)
├── attendance-admin.html       ← Admin panel
├── admin-login.html            ← Admin login page
│
├── css/
│   ├── client.css              ← Styles for client form
│   ├── admin.css               ← Styles for admin panel
│   └── login.css               ← Styles for login page
│
├── js/
│   ├── client.js               ← Logic for client form
│   ├── admin.js                ← Logic for admin panel
│   └── login.js                ← Logic for login page
│
├── apps-script.gs              ← Paste into Google Apps Script editor
├── SETUP_GUIDE.md              ← Quick setup steps
└── DOCUMENTATION.md            ← This file
```
---

## 3. How It Works

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT FORM (GitHub Pages)                             │
│  index.html + css/client.css + js/client.js             │
│                                                         │
│  1. Client fills out form and hits Submit               │
│  2. Duplicate check runs (name match, hard block)       │
│  3. POST sent to Apps Script Web App URL                │
│  4. Data saved to Google Sheets                         │
│  5. Reference number shown on success screen            │
└──────────────────────┬──────────────────────────────────┘
                       │  fetch POST (no-cors)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT (apps-script.gs)                    │
│                                                         │
│  doPost()  → appends new row to Sheets                  │
│  doGet()   → returns all records as JSON                │
│  update()  → edits existing row by ref number           │
│  delete()  → removes row by ref number                  │
└──────────────────────┬──────────────────────────────────┘
                       │  stored in
                       ▼
┌─────────────────────────────────────────────────────────┐
│  GOOGLE SHEETS (Attendance tab)                         │
│  16 columns — one row per submission                    │
│  Admin can also edit directly in Sheets as backup       │
└──────────────────────┬──────────────────────────────────┘
                       │  GET ?action=getAll (every 30s)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  ADMIN PANEL (GitHub Pages)                             │
│  attendance-admin.html + css/admin.css + js/admin.js    │
│                                                         │
│  - Auto-refreshes every 30 seconds                      │
│  - Click any row to open edit modal                     │
│  - Admin fills in: Health Cert #, Status, Admin Position│
│  - Edits are pushed back to Sheets via POST             │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Pages & Features

### 4.1 Client Registration Form

**URL:** `yourusername.github.io/repo-name` (if renamed to index.html)
**File:** `index.html` (formerly `attendance-client.html`)

**Sections:**
1. **Personal Information** — Last name, First name, Middle name, Gender, Residential address
2. **Application Details** — Application type, Health certificate type, Lost certificate, Position
3. **Establishment Information** — Establishment name and address

**Behaviors:**
- Live clock in header (display only, not submitted)
- Timestamp is captured silently at moment of submission
- Required field validation with inline error messages
- Scrolls to first error on failed submit
- Submit button shows "Submitting…" while the POST is in flight
- On success: shows reference number (e.g. `ATT-MM5S7RGQ`)
- On connection failure: shows offline warning, saves to localStorage as fallback
- "Submit Another Entry" button resets the form completely

**Position options (client-facing — exactly 3):**
- Worker
- Business Owner
- OJT / Student

### 4.2 Admin Login

**URL:** `yourusername.github.io/repo-name/admin-login.html`
**File:** `admin-login.html`

**Features:**
- Username + password login
- Show/hide password toggle
- Redirects to admin panel on successful login
- Redirects back here if admin panel is accessed without a session

**Manage Accounts section (below login card):**
- Protected by a second password verification gate
- Add new admin accounts (username min 3 chars, password min 6 chars)
- Remove existing accounts
- Cannot remove the last account (prevents lockout)
- Custom position options are preserved in localStorage

**Default credentials (change immediately):**
```
Username: admin
Password: admin123
```

### 4.3 Admin Panel

**URL:** `yourusername.github.io/repo-name/attendance-admin.html`
**File:** `attendance-admin.html`

**Toolbar:**
- Search by name, establishment, or reference number
- Filter by Status (Pending / Released)
- Filter by Application Type (New / Renewal)
- Filter by Certificate Type (Food Handler / Non-Food Handler)
- Record count display
- Live connection status indicator (green = live, red = error, grey = offline)
- Manual Refresh button

**Table columns:**
| Column | Source |
|---|---|
| Timestamp | Client submission |
| Last Name | Client |
| First Name | Client |
| Middle Name | Client |
| Gender | Client |
| App Type | Client |
| Cert Type | Client |
| Client Position | Client (read-only) |
| Admin Position | Admin only |
| Lost Cert | Client |
| Establishment | Client |
| Health Cert # | Admin only |
| Status | Admin (default: Pending) |

**Edit Modal (click any row):**
- All client fields are editable (for corrections)
- Client Position is displayed read-only (cannot be changed)
- Admin fields: Health Certificate Number, Status, Admin Position
- Delete button with confirmation dialog
- Save pushes changes back to Google Sheets

---

## 5. Data Fields Reference

| Field | Key | Set By | Type |
|---|---|---|---|
| Reference Number | `ref` | Auto-generated | `ATT-` + base36 timestamp |
| Timestamp | `timestamp` | Auto (submission time) | ISO 8601 string |
| Last Name | `lastName` | Client | Text |
| First Name | `firstName` | Client | Text |
| Middle Name | `middleName` | Client | Text (optional) |
| Gender | `gender` | Client | Male / Female |
| Residential Address | `residentialAddress` | Client | Text |
| Application Type | `applicationType` | Client | New / Renewal |
| Health Cert Type | `healthCertificateType` | Client | Food Handler / Non-Food Handler |
| Lost Certificate | `lostCertificate` | Client | Yes / No |
| Client Position | `position` | Client | Worker / Business Owner / OJT / Student |
| Establishment Name | `establishmentName` | Client | Text |
| Establishment Address | `establishmentAddress` | Client | Text |
| Health Cert Number | `healthCertNumber` | Admin | Text (e.g. HC-2024-00001) |
| Status | `status` | Admin | Pending / Released |
| Admin Position | `adminPosition` | Admin | See section 10 |

---

## 6. Google Sheets & Apps Script

### Sheet Structure

The Apps Script automatically creates a tab called **Attendance** with these 16 columns in order:

```
ref | timestamp | lastName | firstName | middleName | gender |
residentialAddress | applicationType | healthCertificateType |
lostCertificate | position | establishmentName | establishmentAddress |
healthCertNumber | status | adminPosition
```

Row 1 is the header, frozen and styled (blue background, white text).
Each subsequent row is one submission.

### Apps Script Actions

The Web App handles 4 actions:

| Action | Method | Description |
|---|---|---|
| `getAll` | GET `?action=getAll` | Returns all rows as JSON array |
| `submit` | POST `{ action:'submit', data:{...} }` | Appends new row |
| `update` | POST `{ action:'update', data:{...} }` | Updates row matching `ref` |
| `delete` | POST `{ action:'delete', ref:'...' }` | Deletes row matching `ref` |

### Re-deploying After Changes

> ⚠️ Every time you edit the Apps Script code, you must create a **New Deployment**
> (not update existing). Copy the new URL and update both `client.js` and `admin.js`.

---

## 7. Deployment Guide (GitHub Pages)

### Step 1 — Google Sheet
1. Create a blank Google Sheet at [sheets.google.com](https://sheets.google.com)
2. Name it (e.g. "Health Certificate Attendance")

### Step 2 — Apps Script
1. In the sheet: **Extensions → Apps Script**
2. Delete placeholder code
3. Paste the entire contents of `apps-script.gs`
4. Click Save

### Step 3 — Deploy Web App
1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the URL (looks like `https://script.google.com/macros/s/ABC.../exec`)

### Step 4 — Add URL to JS files
In both `js/client.js` and `js/admin.js`, replace:
```js
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```
with your actual URL.

### Step 5 — GitHub Pages
1. Create a public GitHub repository
2. Upload all files maintaining the folder structure
3. Rename `attendance-client.html` → `index.html`
4. Go to **Settings → Pages → Source: main branch / root**
5. Wait ~60 seconds, then visit your Pages URL

### Step 6 — Verify
1. Submit a test entry from the client form
2. Check Google Sheets — new row in **Attendance** tab
3. Open admin panel — entry should appear within 30 seconds
4. Open admin panel URL in browser:
   ```
   https://script.google.com/.../exec?action=getAll
   ```
   Should return `{"records":[{...}]}`

---

## 8. Configuration

### Changing the Poll Interval

In `js/admin.js` line 3:
```js
const POLL_INTERVAL = 30000; // milliseconds — 30 seconds default
```
Change to `10000` for 10 seconds, `60000` for 1 minute, etc.

### Poll Quota Estimate (Google free tier: 20,000 reads/day)

| Interval | 1 Panel | 4 Panels (8hr active) |
|---|---|---|
| 10 seconds | 28,800/day | 11,520/day ✅ |
| 30 seconds | 9,600/day | 3,840/day ✅ |
| 60 seconds | 4,800/day | 1,920/day ✅ |

Note: Polling auto-pauses when the browser tab is hidden.

---

## 9. Duplicate Prevention

### How it works

When a client submits, their name is checked against:

1. **`submittedKeys`** in localStorage — a list of `lastName|firstName|middleName` keys from this device
2. **`sheetsCache`** in localStorage — a cached copy of all Sheets records (updated by the admin panel's auto-poll, or when the client form saves locally)

If a match is found, the submission is **hard blocked** — a modal shows the existing entry details and the client cannot proceed. They are directed to speak with staff.

### Scope

- Permanent block — not limited to same-day
- Case-insensitive, trims whitespace
- Cross-device detection works if the `sheetsCache` has been populated (requires admin panel to have polled at least once on the same browser, OR the submission was made from the same device)
- For full cross-device duplicate prevention, a PHP + MySQL backend with server-side name lookup is recommended

### What the duplicate modal shows

- Timestamp of original submission
- Full name
- Application type
- Certificate type
- Establishment name
- Reference number
- Status (Pending / Released)

---

## 10. Admin Position vs Client Position

The system uses two separate position fields to keep client data clean and auditable:

| | Client Position (`position`) | Admin Position (`adminPosition`) |
|---|---|---|
| **Set by** | Client at submission | Admin in edit modal |
| **Options** | Worker, Business Owner, OJT/Student | Manual, Workpass, Business Owner, OJT/Student, Night Market, Replacement, Government, + custom |
| **Editable by admin** | No (read-only display) | Yes |
| **Purpose** | What the client declared | How admin classifies for processing |
| **Shown in table** | ✅ Client Position column | ✅ Admin Position column |

Admins can add custom position types via the **+ Add** field in the edit modal. Custom positions are saved to `localStorage` and persist across sessions on the same browser.

---

## 11. Auto-Refresh & Polling

The admin panel fetches fresh data from Google Sheets every **30 seconds**.

**Smart behaviors:**
- Pauses automatically when the browser tab is hidden or minimized
- Resumes and fetches immediately when the tab becomes visible again
- Shows a toast notification when new entries are detected
- Connection status indicator in toolbar:
  - 🟢 Green dot = "Live · updates every 30s"
  - 🟡 Yellow dot = "Loading…"
  - 🔴 Red dot = "Connection error — retrying"
  - ⚫ Grey dot = "Offline mode (localStorage)"

**Manual refresh:** Click the **Refresh** button in the toolbar at any time.

---

## 12. Authentication

> ⚠️ Current implementation uses localStorage — suitable for internal use only.
> For public-facing admin panels, migrate to PHP sessions (see section 14).

### How it works now

- Users stored in `localStorage['adminUsers']` as `[{ username, password }]`
- Session stored in `localStorage['adminSession']` as `{ username, loginTime }`
- Admin panel checks for session on load — redirects to login if missing
- Logout clears the session key

### Security notes

- Passwords stored in plain text — acceptable for closed internal use
- Anyone with browser dev tools access can read localStorage
- Do not use this for internet-facing systems with sensitive data

### Migrating to PHP (future)

Replace the auth section in `js/login.js` and `js/admin.js` with:
```js
// Login
fetch('/api/login.php', { method:'POST', body: formData })

// Auth check
fetch('/api/auth.php').then(r => r.json()).then(d => {
  if (!d.loggedIn) window.location.href = 'admin-login.html';
})

// Logout
fetch('/api/logout.php', { method:'POST' })
```

---

## 13. CSV Export

Click **⬇ Export CSV** in the admin panel header to download all current records.

**Columns exported:**
Ref, Timestamp, Last Name, First Name, Middle Name, Gender,
Residential Address, Application Type, Health Cert Type, Lost Certificate,
Client Position, Admin Position, Establishment Name, Establishment Address,
Health Cert Number, Status

The file is named `attendance_YYYY-MM-DD.csv` using today's date.
Filtered/searched records are NOT what exports — the full dataset always exports.

---

## 14. Known Limitations & Future Improvements

### Current limitations

| Limitation | Impact | Recommended Fix |
|---|---|---|
| localStorage auth | Passwords readable in dev tools | Migrate to PHP + MySQL sessions |
| Full dataset fetch on every poll | Slow at 30k+ records | Add server-side pagination |
| Cross-device duplicate check | Only works if sheetsCache is warm | Server-side name lookup on submit |
| No offline queue | Submissions lost if network fails during submit | IndexedDB queue with retry |
| Apps Script quotas | 20,000 reads/day free tier | Google Workspace or PHP backend |
| Single Apps Script file | No version control for backend | Move to PHP |

### Recommended next steps (in priority order)

1. **PHP + MySQL backend** — replaces Apps Script + localStorage auth in one go
2. **Pagination** — load 100 records at a time in admin, with page controls
3. **Date range filter** — admin default view shows only today's submissions
4. **Server-side duplicate check** — POST to PHP endpoint that queries MySQL before accepting submission
5. **Print/receipt view** — client gets a printable confirmation after submission

---

## 15. Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| 404 on GitHub Pages root | No `index.html` | Rename `attendance-client.html` to `index.html` |
| Sheet tab is empty | Wrong tab name | Look for **Attendance** tab, not Sheet1 |
| Admin shows no records | URL not set in `admin.js` | Paste Apps Script URL in `js/admin.js` line 3 |
| Submissions not in Sheets | URL not set in `client.js` | Paste Apps Script URL in `js/client.js` line 3 |
| Apps Script access error | Wrong deployment settings | Set "Who has access" to **Anyone**, not "Anyone with Google account" |
| `{"ok":true}` but no new column | Old deployment active | Create **New Deployment** after editing script — do not update existing |
| Admin login not working | Default creds changed / localStorage cleared | Open browser dev tools → Application → Local Storage → delete `adminUsers` key to reset |
| Duplicate check not working cross-device | sheetsCache not populated | Expected behavior — full fix requires PHP backend |
| Position tags not showing in modal | Custom positions lost | localStorage was cleared — re-add via + Add field |
| CORS errors in console | Normal for no-cors fetch | Not an error — data still submits. Ignore. |

---

## 16. Changelog

### Current Version
- **Dual position fields** — client position (3 options, read-only in admin) and admin position (7 + custom options)
- **Hard duplicate block** — permanent name-match block, no bypass option for clients
- **Google Sheets integration** — Apps Script Web App handles all CRUD
- **Auto-poll** — admin refreshes every 30 seconds, pauses on hidden tab
- **Multi-user admin auth** — localStorage-based, password-gated account management
- **Separated CSS/JS** — clean file structure for maintainability
- **GitHub Pages ready** — static files, no server required for hosting

### Previous changes
- Added `adminPosition` column (separate from client-declared `position`)
- Removed "Submit Anyway" from duplicate modal
- Fixed sticky table header (overflow context issue)
- Fixed "No" toggle button highlight (was invisible)
- Added live connection status dot to admin toolbar
- Reduced poll interval to 30s (from 10s) for quota safety
- Removed timestamp display from client form (still captured silently)
- Separated HTML / CSS / JS into individual files

