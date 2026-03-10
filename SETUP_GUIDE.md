# Setup Guide — Health Certificate Attendance System

## File Structure (deploy all of this to GitHub Pages)

```
/
├── index.html                  ← Rename of attendance-client.html
├── attendance-admin.html       ← Admin panel
├── admin-login.html            ← Admin login page
├── css/
│   ├── client.css
│   ├── admin.css
│   └── login.css
└── js/
    ├── client.js
    ├── admin.js
    └── login.js
```

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it something like **Health Certificate Attendance**
4. Leave it blank — the Apps Script will create the header row automatically

---

## Step 2 — Set Up the Apps Script

1. Inside your Google Sheet, click **Extensions → Apps Script**
2. Delete the default `function myFunction() {}` placeholder
3. Open the file **`apps-script.gs`** from this folder and **paste the entire contents**
4. Click **Save** (floppy disk icon or Ctrl+S)

### What the Apps Script must support

The system uses several actions. Make sure your `apps-script.gs` handles all of these:

| Action | Method | Description |
|---|---|---|
| `getAll` | GET `?action=getAll` | Returns all records as JSON. Optionally accepts `?since=ISO_TIMESTAMP` to return only records newer than that time (delta polling). |
| `submit` | POST `{ action:'submit', data:{...} }` | Appends a new row |
| `update` | POST `{ action:'update', data:{...} }` | Updates row matching `ref` |
| `delete` | POST `{ action:'delete', ref:'...' }` | Deletes row matching `ref` |
| `saveConfig` | POST `{ action:'saveConfig', key:'adminPositionOptions', value:[...] }` | Saves custom admin position options to a Config tab |
| `getConfig` | GET `?action=getConfig` | Returns saved config values including `adminPositionOptions` |

> The `since` parameter and config actions are optional — the system falls back gracefully if the Apps Script doesn't support them. But implementing them gives you faster polling and cross-device position sync.

---

## Step 3 — Deploy as a Web App

1. Click **Deploy → New deployment**
2. Click the gear icon ⚙ next to "Select type" and choose **Web app**
3. Fill in:
   - **Description:** `Attendance API v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`  ← Important! This allows the client form to POST
4. Click **Deploy**
5. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## Step 4 — Paste the URL into Both JS Files

Open **`js/client.js`** and replace:
```js
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```
with your actual URL. Do the **exact same thing** in **`js/admin.js`**.

---

## Step 5 — Deploy to GitHub Pages

1. Create a new **public** GitHub repository
2. Upload all files (maintaining the folder structure above)
3. Rename `attendance-client.html` → `index.html`
4. Go to **Settings → Pages**
5. Under "Source", select **main branch → / (root)**
6. Click **Save**
7. Your site will be live at:
   ```
   https://yourusername.github.io/your-repo-name/
   ```

---

## Step 6 — Test It

1. Open the **client form** (`index.html`) and submit a test entry
2. Check your Google Sheet — a new row should appear within seconds
3. Open the **admin login** (`admin-login.html`)
   - Default credentials: `admin` / `admin123`  ← **Change this immediately!**
4. Open the **admin panel** — your test entry should appear
5. The admin panel auto-refreshes every **30 seconds**

---

## How Updates Work

```
Client Form (GitHub Pages)
       │
       │  POST (fetch, no-cors)
       ▼
Apps Script Web App URL
       │
       │  appendRow()
       ▼
Google Sheet (stores all data)
       │
       │  GET ?action=getAll&since=...  (every 30 seconds)
       ▼
Admin Panel (GitHub Pages)
```

On each poll after the first, the admin panel sends `?since=LAST_POLL_TIMESTAMP`. The Apps Script should return only records newer than that time and the panel merges them in — keeping bandwidth low. On first load and manual refresh, a full fetch is performed.

---

## Re-deploying After Code Changes

⚠ Important: Every time you edit the Apps Script code, you must create a **New Deployment** (not update an existing one) to get a fresh URL. Update the URL in both `client.js` and `admin.js` when this happens.

---

## Default Admin Credentials

```
Username: admin
Password: admin123
```

**Change this immediately** by logging in and using the "Manage Admin Accounts" panel on the login page. Enter your current password to unlock the panel, then add a new account and remove the default one.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Submissions not appearing in Sheet | Make sure "Who has access" is set to **Anyone** in the deployment |
| Admin shows "Connection error" | Check the URL in `admin.js` is correct and re-deployed |
| CORS errors in browser console | Normal for `no-cors` fetch — data still goes through |
| Sheet has duplicate header rows | Delete extra header rows manually, keep only row 1 |
| Admin login not working | Default is `admin` / `admin123` — check browser localStorage isn't cleared |
| Custom positions not syncing across devices | Requires `saveConfig` / `getConfig` actions in Apps Script; falls back to localStorage if absent |
| Delta polling not working | Requires `?since=` support in Apps Script `getAll`; falls back to full fetch if absent |
