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
   - 4.4 [Reports](#44-reports)
5. [Data Fields Reference](#5-data-fields-reference)
6. [Google Sheets & Apps Script](#6-google-sheets--apps-script)
7. [Deployment Guide (GitHub Pages)](#7-deployment-guide-github-pages)
8. [Configuration](#8-configuration)
9. [Duplicate Prevention](#9-duplicate-prevention)
10. [Admin Position vs Client Position](#10-admin-position-vs-client-position)
11. [Auto-Refresh & Delta Polling](#11-auto-refresh--delta-polling)
12. [Authentication](#12-authentication)
13. [CSV Export](#13-csv-export)
14. [Reports](#14-reports)
15. [Concurrency & Simultaneous Submissions](#15-concurrency--simultaneous-submissions)
16. [Known Limitations & Future Improvements](#16-known-limitations--future-improvements)
17. [Troubleshooting](#17-troubleshooting)
18. [Changelog](#18-changelog)

---

## 1. Project Overview

A web-based attendance and registration system for health certificate applicants.
Built with plain HTML, CSS, and JavaScript — no frameworks, no build tools.
Data is stored in Google Sheets via a Google Apps Script Web App.
The client form and admin panel are hosted on GitHub Pages (free, always online).

**Tech stack:**
- Frontend: HTML5, CSS3, vanilla JavaScript
- Storage: Google Sheets (via Apps Script)
- Hosting: GitHub Pages (client + admin)
- Auth: localStorage-based (to be replaced with PHP sessions for production)

---

## 2. File Structure

```
/
├── index.html                  ← Rename of attendance-client.html (GitHub Pages root)
├── attendance-admin.html       ← Admin panel
├── admin-login.html            ← Admin login page
│
├── css/
│   ├── client.css
│   ├── admin.css
│   └── login.css
│
├── js/
│   ├── client.js
│   ├── admin.js
│   └── login.js
│
├── apps-script.gs
├── SETUP_GUIDE.md
└── DOCUMENTATION.md
```

---

## 3. How It Works

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT FORM (GitHub Pages)                             │
│                                                         │
│  1. Cache warm: JSONP fetch populates sheetsCache       │
│  2. Client fills out form and hits Submit               │
│  3. Duplicate check runs (name match, hard block)       │
│  4. POST sent to Apps Script Web App URL                │
│  5. Reference number shown on success screen            │
└──────────────────────┬──────────────────────────────────┘
                       │  fetch POST (no-cors)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT (apps-script.gs)                    │
│                                                         │
│  doPost()  → appends new row to Sheets                  │
│  doGet()   → returns records as JSON (supports ?since=) │
│  update()  → edits existing row by ref number           │
│  delete()  → removes row by ref number                  │
│  saveConfig() / getConfig() → custom position options   │
└──────────────────────┬──────────────────────────────────┘
                       │  stored in
                       ▼
┌─────────────────────────────────────────────────────────┐
│  GOOGLE SHEETS                                          │
│  16 columns — one row per submission                    │
└──────────────────────┬──────────────────────────────────┘
                       │  GET ?action=getAll&since=... (every 30s)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  ADMIN PANEL (GitHub Pages)                             │
│                                                         │
│  - Delta poll every 30s (only fetches new rows)         │
│  - Click any row to open edit modal                     │
│  - Admin fills in: Health Cert #, Status, Admin Position│
│  - Edits pushed back to Sheets via POST                 │
│  - Monthly and daily reports with breakdowns            │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Pages & Features

### 4.1 Client Registration Form

**URL:** `yourusername.github.io/repo-name` (if renamed to index.html)

**On page load:** A one-time JSONP fetch warms the local `sheetsCache` so duplicate detection works cross-device even before the admin panel has polled.

**Sections:**
1. **Personal Information** — Last name, First name, Middle name, Gender, Residential address
2. **Application Details** — Application type, Health certificate type, Lost certificate, Position
3. **Establishment Information** — Establishment name and address

**Input limits (maxlength):**

| Field | Limit |
|---|---|
| Last / First / Middle name | 80 characters |
| Establishment name | 150 characters |
| Residential address | 300 characters |
| Establishment address | 300 characters |

**Behaviors:**
- Live clock in header (display only)
- Timestamp captured silently at submission
- Required field validation with inline error messages
- Scrolls to first error on failed submit
- Submit button shows "Submitting…" while POST is in flight
- On success (normal): green success screen with reference number
- On success (offline): **amber warning screen** — visually distinct, tells client to inform staff. Submission is saved locally and will sync when connection is restored.
- Duplicate check: hard block if name already exists in system (see Section 9)

**Position options (client-facing — exactly 3):**
- Worker
- Business Owner
- OJT / Student

### 4.2 Admin Login

**URL:** `yourusername.github.io/repo-name/admin-login.html`

**Features:**
- Username + password login
- Show/hide password toggle
- Redirects to admin panel on successful login
- Redirects back here if admin panel is accessed without a session

**Manage Accounts panel (below login card):**
- Protected by password gate — verifies against the **current logged-in user's own password** (not just any admin password)
- Add new admin accounts (username min 3 chars, password min 6 chars)
- Remove existing accounts
- Cannot remove the last account (prevents lockout)

**Default credentials (change immediately):**
```
Username: admin
Password: admin123
```

### 4.3 Admin Panel

**URL:** `yourusername.github.io/repo-name/attendance-admin.html`

**Header buttons:**
- **Monthly Report** — opens the report modal (see Section 14)
- **Export CSV** (split button) — primary exports all records; dropdown offers "Export current view"
- **Sign Out**

**Toolbar Row 1:**
- Today / All Records view toggle (Today badge shows live count)
- Search by name, establishment, or reference number
- Filter by Status, Application Type, Certificate Type
- Record count display
- Live connection status indicator
- Manual Refresh button

**Toolbar Row 2 (date range):**
- From / To date pickers — work in both Today and All Records modes
- Clear button resets both date inputs

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
| Health Cert # | Admin only — shows ⚠ amber warning if blank on a Released record |
| Status | Admin (default: Pending) |

**Edit Modal (click any row):**
- All client fields are editable (for corrections), with same maxlength limits as the client form
- Client Position is displayed read-only
- Admin fields: Health Certificate Number, Status, Admin Position
- Admin Position tag picker — custom positions sync to Sheets config tab (cross-device)
- Delete button with confirmation dialog

### 4.4 Reports

See Section 14 for full details.

---

## 5. Data Fields Reference

| Field | Key | Set By | Type |
|---|---|---|---|
| Reference Number | `ref` | Auto-generated | `ATT-` + base36 ms timestamp |
| Timestamp | `timestamp` | Auto (submission time) | ISO 8601 |
| Last Name | `lastName` | Client | Text (max 80) |
| First Name | `firstName` | Client | Text (max 80) |
| Middle Name | `middleName` | Client | Text (max 80, optional) |
| Gender | `gender` | Client | Male / Female |
| Residential Address | `residentialAddress` | Client | Text (max 300) |
| Application Type | `applicationType` | Client | New / Renewal |
| Health Cert Type | `healthCertificateType` | Client | Food Handler / Non-Food Handler |
| Lost Certificate | `lostCertificate` | Client | Yes / No |
| Client Position | `position` | Client | Worker / Business Owner / OJT / Student |
| Establishment Name | `establishmentName` | Client | Text (max 150) |
| Establishment Address | `establishmentAddress` | Client | Text (max 300) |
| Health Cert Number | `healthCertNumber` | Admin | Text (max 50) |
| Status | `status` | Admin | Pending / Released |
| Admin Position | `adminPosition` | Admin | See Section 10 |

---

## 6. Google Sheets & Apps Script

### Sheet Structure

The Apps Script creates a tab called **Attendance** with 16 columns:

```
ref | timestamp | lastName | firstName | middleName | gender |
residentialAddress | applicationType | healthCertificateType |
lostCertificate | position | establishmentName | establishmentAddress |
healthCertNumber | status | adminPosition
```

Row 1 is the header, frozen and styled. Each subsequent row is one submission.

### Apps Script Actions

| Action | Method | Description |
|---|---|---|
| `getAll` | GET `?action=getAll` | Returns all rows. Supports optional `?since=ISO` for delta polling. |
| `submit` | POST `{ action:'submit', data:{...} }` | Appends new row |
| `update` | POST `{ action:'update', data:{...} }` | Updates row by `ref` |
| `delete` | POST `{ action:'delete', ref:'...' }` | Deletes row by `ref` |
| `saveConfig` | POST `{ action:'saveConfig', key, value }` | Saves config (e.g. custom positions) |
| `getConfig` | GET `?action=getConfig` | Returns config values |

### Re-deploying After Changes

Every time you edit the Apps Script, create a **New Deployment** and update the URL in both `client.js` and `admin.js`.

---

## 7. Deployment Guide (GitHub Pages)

See `SETUP_GUIDE.md` for the full step-by-step guide.

Quick summary:
1. Create Google Sheet
2. Paste `apps-script.gs` into Apps Script editor, deploy as Web App (Anyone access)
3. Paste the Web App URL into `js/client.js` and `js/admin.js`
4. Upload all files to a public GitHub repo, enable Pages from root of main branch
5. Rename `attendance-client.html` → `index.html`

---

## 8. Configuration

### Changing the Poll Interval

In `js/admin.js` line 3:
```js
const POLL_INTERVAL = 30000; // milliseconds
```

### Poll Quota Estimate (Google free tier: 20,000 reads/day)

With delta polling, each poll after the first returns only new rows — actual data transferred is much smaller than a full fetch. The quota figures below are for request count, not data size.

| Interval | 1 Panel | 4 Panels (8hr active) |
|---|---|---|
| 10 seconds | 2,880/day | 11,520/day ✅ |
| 30 seconds | 960/day | 3,840/day ✅ |
| 60 seconds | 480/day | 1,920/day ✅ |

Polling auto-pauses when the browser tab is hidden.

---

## 9. Duplicate Prevention

### How it works

When a client submits, the system checks for an existing name match against:

1. **`submittedKeys`** in localStorage — a list of `lastName|firstName|middleName` keys from this device's past submissions
2. **`sheetsCache`** in localStorage — a cached copy of all Sheets records

If a match is found, submission is **hard blocked** — a modal shows the existing entry and the client cannot proceed. They are directed to speak with staff.

### Cross-device detection

On page load, the client form performs a one-time JSONP fetch to warm the `sheetsCache` from the live Sheets data. This means a client who previously submitted on a different device or kiosk will still be caught by the duplicate check, even if this device has never seen their record before.

### What the duplicate modal shows

Timestamp, full name, application type, certificate type, establishment name, reference number, and status.

---

## 10. Admin Position vs Client Position

| | Client Position (`position`) | Admin Position (`adminPosition`) |
|---|---|---|
| **Set by** | Client at submission | Admin in edit modal |
| **Options** | Worker, Business Owner, OJT/Student | Manual, Workpass, Business Owner, OJT/Student, Night Market, Replacement, Government, + custom |
| **Editable by admin** | No (read-only display) | Yes |
| **Purpose** | What the client declared | How admin classifies for processing |

Custom admin positions are saved to both localStorage and the Sheets Config tab (via `saveConfig` action), so they persist across devices and browsers. If the Apps Script doesn't support `saveConfig`/`getConfig`, it falls back to localStorage only.

---

## 11. Auto-Refresh & Delta Polling

The admin panel refreshes data from Google Sheets every **30 seconds**.

### Delta polling

After the first full fetch, each subsequent poll sends `?since=LAST_POLL_TIMESTAMP`. The Apps Script returns only rows with a timestamp at or after that value. New/updated rows are merged into the local array by `ref` — existing records are updated, new ones are added.

A manual **Refresh** button always triggers a full fetch (`forceFull=true`) to ensure nothing is missed.

### Smart behaviors
- Pauses automatically when the browser tab is hidden
- Resumes and fetches immediately when the tab becomes visible
- Shows a toast notification when new entries are detected
- Connection status indicator: 🟢 Live / 🟡 Loading / 🔴 Error / ⚫ Offline

---

## 12. Authentication

> ⚠️ Current implementation uses localStorage — suitable for internal/intranet use only. For internet-facing deployments, migrate to PHP sessions.

### How it works

- Users stored in `localStorage['adminUsers']` as `[{ username, password }]`
- Session stored in `localStorage['adminSession']` as `{ username, loginTime }`
- Admin panel checks for session on load — redirects to login if missing
- The "Manage Accounts" gate verifies the **current logged-in user's own password**, not just any admin password in the list

### Security notes

- Passwords stored in plain text — acceptable for closed internal use on a trusted local network
- Anyone with browser dev tools access can read localStorage
- Do not use for internet-facing systems handling sensitive personal data without migrating to PHP + MySQL

---

## 13. CSV Export

The **Export CSV** button in the admin panel header is a split button:

- **Primary (Export CSV)** — downloads all records regardless of current filters
- **Dropdown → Export current view** — downloads only the rows currently visible in the table (respects all active filters, search, date range, and Today/All mode)

Files are named:
- `attendance_all_YYYY-MM-DD.csv`
- `attendance_filtered_YYYY-MM-DD.csv`

**Columns exported:**
Ref, Timestamp, Last Name, First Name, Middle Name, Gender, Residential Address, Application Type, Health Cert Type, Lost Certificate, Client Position, Admin Position, Establishment Name, Establishment Address, Health Cert Number, Status

---

## 14. Reports

Click **Monthly Report** in the admin panel header. The modal has a **Monthly / Daily** mode toggle.

### Monthly Report

Select a month and year, click Generate.

**Summary cards:** Total Applications · Released · Pending · Release Rate (%)

**Breakdown tables** (each shows Total / Released / Pending / Release Rate with a progress bar):
- By Certificate Type
- By Application Type
- By Client Position
- By Gender
- Weekly Breakdown (Week 1: days 1–7, Week 2: 8–14, Week 3: 15–21, Week 4: 22–31)

**Export:** Downloads `report_january_2025.csv` (all raw records for that month)

### Daily Report

Select a specific date, click Generate.

**Summary cards:** Same four cards as monthly.

**Breakdown tables:**
- By Certificate Type
- By Application Type
- By Client Position
- By Gender
- By Hour of Day — groups submissions by the hour they arrived (e.g. `09:00–09:59`)
- All Applicants This Day — a full numbered list sorted by submission time, showing name, cert type, app type, position, establishment, health cert #, and status. Released records missing a cert number show a ⚠ amber warning.

**Export:** Downloads `report_daily_2025-03-10.csv`

Both modes show a clean empty state if no records exist for the selected period.

---

## 15. Concurrency & Simultaneous Submissions

The system handles multiple clients submitting at the same time safely.

**Client submissions are fully concurrent-safe:**
- Reference numbers use millisecond-precision timestamps — two clients submitting at the same minute but different milliseconds get different refs
- Google Sheets `appendRow()` is atomic — each POST independently appends a new row; Sheets queues concurrent appends internally without conflict
- The duplicate check is name-based, not time-based — two different people submitting simultaneously both go through fine

**Admin edits:**
- The `update` action finds a row by `ref` and overwrites it (last-write-wins)
- In this system's workflow, each admin handles only the client physically in front of them — so two admins editing the same record simultaneously is not a real-world scenario
- This is a non-issue for this use case

**High load:**
- The Apps Script free tier handles up to 30 concurrent requests comfortably for a walk-in counter scenario
- The only realistic bottleneck at very high volume would be the 20,000 read requests/day quota, which delta polling significantly reduces

---

## 16. Known Limitations & Future Improvements

| Limitation | Impact | Recommended Fix |
|---|---|---|
| localStorage auth | Passwords readable in dev tools | Migrate to PHP + MySQL sessions |
| Cross-device duplicate check relies on cache warm | If JSONP warm fails (network down), cross-device dup check may miss | Server-side name lookup on submit (PHP) |
| `update` / `delete` do linear sheet scan | Slow at very large row counts | Index by ref or migrate to MySQL |
| Custom positions fall back to localStorage if Apps Script config actions absent | Positions don't sync cross-device | Implement `saveConfig`/`getConfig` in Apps Script |
| Apps Script 20,000 reads/day free quota | Delta polling reduces this significantly; still a limit at scale | Google Workspace or PHP backend |
| No offline submission queue | Submissions lost if network fails mid-POST | IndexedDB queue with retry |

### Recommended next steps (in priority order)

1. **Implement `?since=` and config actions in Apps Script** — unlocks delta polling and cross-device position sync with no infrastructure changes
2. **PHP + MySQL backend** — replaces Apps Script + localStorage auth in one go
3. **Server-side duplicate check** — POST to PHP that queries MySQL before accepting submission
4. **Print/receipt view** — printable confirmation for the client after submission

---

## 17. Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| 404 on GitHub Pages root | No `index.html` | Rename `attendance-client.html` to `index.html` |
| Sheet tab is empty | Wrong tab name | Look for **Attendance** tab |
| Admin shows no records | URL not set in `admin.js` | Paste Apps Script URL in `js/admin.js` |
| Submissions not in Sheets | URL not set in `client.js` | Paste Apps Script URL in `js/client.js` |
| Apps Script access error | Wrong deployment settings | Set "Who has access" to **Anyone** |
| `{"ok":true}` but no new column | Old deployment active | Create **New Deployment**, update URL in both JS files |
| Admin login not working | Default creds changed / localStorage cleared | Open dev tools → Application → Local Storage → delete `adminUsers` key to reset |
| Duplicate check not catching cross-device submissions | JSONP cache warm failed on load | Check network; if Apps Script URL is correct, it will retry on next page load |
| Custom positions not persisting across devices | `saveConfig` not in Apps Script | Implement config actions in Apps Script, or accept localStorage-only behavior |
| Delta polling not working | `?since=` not supported in Apps Script | Implement it in Apps Script; system falls back to full fetch in the meantime |
| CORS errors in console | Normal for no-cors fetch | Not an error — data still submits. Ignore. |
| Missing cert ⚠ showing in table/report | Record set to Released with no Health Cert # | Open the record, fill in the Health Cert Number, save |

---

## 18. Changelog

### Current Version

**Reports**
- Monthly Report modal with summary stat cards (total, released, pending, release rate)
- Breakdowns by certificate type, application type, client position, gender
- Monthly mode includes weekly breakdown (weeks 1–4)
- Daily Report mode — select any single date
- Daily mode includes hourly breakdown and full applicant list for the day
- Monthly / Daily toggle within a single modal
- Export Report CSV for both modes

**Admin panel improvements**
- Delta polling — sends `?since=LAST_POLL_TIMESTAMP`; merges only new/updated rows
- Date range filter (From / To) in toolbar row 2
- Sorted column highlight persists through filter and search changes
- Missing Health Cert # warning (⚠ amber) on Released records in table and daily report
- Custom admin positions sync to Sheets config tab (cross-device)
- Split CSV export: all records or current filtered view

**Client form improvements**
- Cross-device duplicate detection via JSONP cache warm on page load
- Amber offline warning state on success screen (visually distinct from normal green)
- `maxlength` on all text inputs and textareas

**Auth improvements**
- `unlockManage()` gate now verifies against the current logged-in user's own password (security fix)

### Previous changes
- Added `adminPosition` column (separate from client-declared `position`)
- Removed "Submit Anyway" from duplicate modal
- Fixed sticky table header overflow context
- Added live connection status dot to admin toolbar
- Reduced poll interval to 30s for quota safety
- Separated HTML / CSS / JS into individual files
- Added Today / All Records view toggle
- Added Today badge count
