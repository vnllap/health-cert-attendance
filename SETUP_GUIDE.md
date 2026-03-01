# Setup Guide — Health Certificate Attendance System

## File Structure (deploy all of this to GitHub Pages)

```
/
├── attendance-client.html      ← Client registration form
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
with your actual URL:
```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Do the **exact same thing** in **`js/admin.js`**.

---

## Step 5 — Deploy to GitHub Pages

1. Create a new **public** GitHub repository
2. Upload all files (maintaining the folder structure above)
3. Go to **Settings → Pages**
4. Under "Source", select **main branch → / (root)**
5. Click **Save**
6. Your site will be live at:
   ```
   https://yourusername.github.io/your-repo-name/attendance-client.html
   ```

---

## Step 6 — Test It

1. Open the **client form** and submit a test entry
2. Check your Google Sheet — a new row should appear within seconds
3. Open the **admin login** (`admin-login.html`)
   - Default credentials: `admin` / `admin123`  ← Change this immediately!
4. Open the **admin panel** — your test entry should appear
5. The admin panel auto-refreshes every **10 seconds**

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
       │  GET ?action=getAll  (every 10 seconds)
       ▼
Admin Panel (GitHub Pages)
```

---

## Re-deploying After Code Changes

⚠ Important: Every time you edit the Apps Script code, you must create a **New Deployment** (not update an existing one) to get a fresh URL. Update the URL in both `client.js` and `admin.js` when this happens.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Submissions not appearing in Sheet | Make sure "Who has access" is set to **Anyone** in the deployment |
| Admin shows "Connection error" | Check the URL in `admin.js` is correct and re-deployed |
| CORS errors in browser console | Normal for `no-cors` fetch — data still goes through |
| Sheet has duplicate header rows | Delete extra header rows manually, keep only row 1 |
| Admin login not working | Default is `admin` / `admin123` — check browser localStorage isn't cleared |

---

## Default Admin Credentials

```
Username: admin
Password: admin123
```

**Change this immediately** by logging in and using the "Manage Admin Accounts" section on the login page.

