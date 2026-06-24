# Firestore & Google Drive Real-Connection Smoke Procedure

This document provides a safe, repeatable manual smoke procedure to verify that the app can authenticate, access Firestore, call the Google Drive API, perform a one-step folder debug scan, and persist folder metadata.

> **⚠️ WARNING:** 
> Do **NOT** delete Google Drive files/folders or generated `index.md` files during this smoke test.
> Do **NOT** run full Drive-wide indexing by default.
> Do **NOT** generate or update `index.md` files unless explicitly instructed.
> This smoke test is strictly read-only for Google Drive, and writes metadata only to the authenticated user's own path in Firestore.

## Prerequisites
- The app must be running locally or in a deployment environment.
- A user account with a valid Google login.
- Valid Firestore Security Rules deployed (`indexmd-db`).

## 1. Safe Smoke Test Procedures
- **Drive Re-Auth Flow**: Revoke token or force expiration, then verify the "Drive Access Required" screen appears instead of a full logout.
- **AI Summary Test**: Use the `/summary-debugger` route to safely test structured schema validation using **manual synthetic input** without writing `index.md` files or running Drive scans.

## 2. Routing Smoke
**Goal:** Verify basic client-side routing and fallback works.
- Open the app and verify you land on the dashboard (or login page, then dashboard).
- Visit the following URLs directly (or refresh the browser while on them):
  - `/dashboard`
  - `/debugger`
  - `/summary-debugger`
  - `/firestore-test`
  - `/logs`
- **Expected:** The page loads correctly without 404 errors. In Dev, Vite handles SPA navigation. In Prod, Express fallback serves `index.html`.

## 2. Firestore Diagnostic Smoke
**Goal:** Verify Firestore rules permit read/write on the user's diagnostic document.
- Navigate to the **Debugger** (`/debugger`) or **Firestore Test** (`/firestore-test`) tab.
- Locate the **Firestore Diagnostic / Permission Check** button and execute it.
- **Expected Logs/UI:**
  - Writes to `users/{uid}/state/diagnostics`.
  - Reads back from the same document.
  - Displays database ID (`indexmd-db`).
  - Displays the target path.
  - Result should be `confirmed`.
- **Failures:**
  - `failed` (Permission Denied): Indicates Firestore rules mismatch, wrong database ID, or wrong UID.
  - `timeout`: Indicates network/offline/Firestore latency. It is NOT necessarily a permission error.

## 3. Google Drive Read & One-Step Debug Scan
**Goal:** Verify Drive API token validity, permissions, and one-step debug scan pipeline.
- Authenticate via Google to obtain a Drive OAuth token (automatically managed by the app).
- Navigate to the **Debugger** tab.
- Click the **One-Step Debug Scan** button.
- **Under the hood:** Calls `/api/drive/scan` with `scanMode: "debug-step"`, `pageSize: 1`, `bypassCache: true`, `cacheScope: userId`.
- **Expected:**
  - Google Drive returns zero or one folder.
  - If one folder is returned, Firestore metadata write is attempted.
  - Result is classified as `confirmed`.
  - Cache is bypassed.
- **Failures:**
  - `401 Unauthorized`: Drive token expired or invalid.
  - `403 Forbidden`: Drive permission or API scope issue.
  - `Empty result`: No eligible folder found for the current cursor/filter (valid state).

## 4. Bounded Scan Smoke
**Goal:** Verify folder traversal works with strict limits, without full drive-wide scanning.
- Set the **Scan Limit** to `1` or `5`.
- Click the **Run Scan** (or equivalent limited scan) button.
- **Expected:**
  - The scan stops exactly at the limit.
  - No full Drive-wide scanning occurs.
  - Only Firestore metadata under `users/{uid}/directories/{driveId}` is written.
  - No `index.md` files are written to Drive.
  - The System Logs show the correct scan mode, cache hit/miss, and discovered/skipped/ignored/removed counts.
  
## 5. Cache & Page Token Recovery Smoke
**Goal:** Verify caching layers and token recovery mechanisms.
- **Cache Smoke:** 
  - After a Bounded Scan, run the exact same scan again. The logs should indicate a `cache hit`.
  - Run the One-Step Debug Scan. The logs should indicate the cache was bypassed (`bypassCache: true`).
- **Page Token Recovery:**
  - Simulating a stale page token is difficult without manipulating internals. 
  - When a token naturally goes stale or is manually altered in a test, the server will retry without `pageToken`.
  - **Expected if token goes stale:** The server responds with `pageTokenRecovered: true` and the client logs the recovery. Tokens must NOT be exposed in logs.

## 6. Smoke Execution Record (Template)
When executing a smoke test manually, copy this template, fill it out, and record it in your PR or Issue.

```text
### Smoke Test Record
**Date/Time:** YYYY-MM-DD HH:MM
**Commit SHA:** (e.g. abc1234)
**Environment:** (Local Dev | Local Prod Build | Deployed)
**Node Version:** vX.Y.Z
**Firebase Project ID:** 
**Firestore Database ID:** indexmd-db
**Authenticated UID:** (Partial UID, e.g. a1b2...c3)

**Results:**
- **Firestore Diagnostic:** [ confirmed | timeout | failed ]
- **One-Step Debug Scan:** [ empty | confirmed | timeout | failed ]
- **Bounded Scan Limit:** (e.g. 5)
- **Bounded Scan Result:** [ Pass | Fail ]
- **Route Refresh (Dashboard/Debugger):** [ Pass | Fail ]
- **Cache Observation:** [ Hit observed | Miss observed ]
- **Page Token Recovery:** [ Not triggered naturally | Recovered successfully ]

**Blockers / Notes:**
(Any errors, exceptions, or unexpected behaviors)
```
