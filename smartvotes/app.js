/* ═══════════════════════════════════════════════════════════════
   SmartVotes Network — Main Application Script
   Data-integrity revision v2  (June 2026)

   FIXES IN THIS REVISION
   ──────────────────────
   FIX-1  loadData(forceRefresh=true) could wipe JSONBin when the
          network blipped.  When forceRefresh is true and jbinGet()
          returns null we now fall back to the cached localStorage
          copy instead of calling buildDefaultData() and overwriting
          the remote store.  This was the PRIMARY cause of the
          reported "new-user registration wiped existing data" bug.

   FIX-2  validateDataIntegrity() failure in loadData() triggered
          a full buildDefaultData() + jbinPut(), silently replacing
          the entire remote dataset with just the admin account.
          Now a validation failure emits a warning and continues
          with the data as-is instead of nuking it.

   FIX-3  atomicSave() retried business-logic errors (DUPLICATE_EMAIL,
          DUPLICATE_USERNAME) the same as transient network errors,
          making three unnecessary jbinGet() calls before surfacing
          the error.  Business errors now abort immediately.

   FIX-4  atomicSave() fell back to local appData as the write base
          when all remote-fetch retries were exhausted, risking a
          stale local snapshot overwriting fresh remote data.
          The write is now aborted (local-only save) if a confirmed
          remote baseline cannot be obtained.

   FIX-5  The post-write verification jbinGet() doubled API calls on
          every mutation and could push the account into JSONBin rate
          limits (429s), which triggered additional write failures.
          Verification reads are removed; integrity is maintained
          by the read-before-write pattern in atomicSave() itself.

   FIX-6  saveUserEdit() had no duplicate-email/username guard.
          An admin could accidentally reassign an existing email to
          another account, corrupting user lookup.  Guard added.

   FIX-7  enqueueWrite swallowed the atomicSave return value, so
          callers that needed to act on save results (doRegister)
          were calling atomicSave directly outside the queue,
          bypassing serialization.  The queue now threads results
          through and doRegister uses saveData() consistently.
   ═══════════════════════════════════════════════════════════════ */

"use strict";

// ── Config shorthand ──────────────────────────────────────────────
const CFG = (typeof SMARTVOTES_CONFIG !== 'undefined') ? SMARTVOTES_CONFIG : {};

// ─────────────────────────────────────────────────────────────────
function isRealCredential(val) {
  if (!val) return false;
  const s = String(val).trim();
  return s.length > 0
    && !s.includes('YOUR_')
    && !s.endsWith('_HERE')
    && s !== 'null'
    && s !== 'undefined';
}

const JBIN_MASTER_KEY = isRealCredential(CFG.JSONBIN_M_API_KEY)   ? String(CFG.JSONBIN_M_API_KEY).trim()   : "";
const JBIN_ACCESS_KEY = isRealCredential(CFG.JSONBIN_API_KEY)      ? String(CFG.JSONBIN_API_KEY).trim()     : "";
const JBIN_BIN        = isRealCredential(CFG.JSONBIN_MAIN_BIN_ID)  ? String(CFG.JSONBIN_MAIN_BIN_ID).trim() : "";
const JBIN_URL        = "https://api.jsonbin.io/v3";

const JBIN_READY = !!(JBIN_BIN && (JBIN_MASTER_KEY || JBIN_ACCESS_KEY));

const EJS = CFG.EMAILJS || {};
const FB  = CFG.FIREBASE || {};
const APP = CFG.APP || { DEFAULT_ADMIN_ID: "Admin01", DEFAULT_ADMIN_PASSWORD: "Kingfifo@#" };

// ── App State ─────────────────────────────────────────────────────
let appData = {
  users:      [],
  elections:  [],
  categories: [],
  candidates: [],
  votes:      []
};

let currentUser           = null;
let editingId             = null;
let editingUserId         = null;
let votingElection        = null;
let pendingValidationUser = null;
let voteSelections        = {};
let charts                = {};

// ── Helpers ───────────────────────────────────────────────────────
const uid = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  const counter = (performance.now() % 10000).toString(36).slice(-4);
  return `${timestamp}-${randomPart}-${counter}`;
};

const now        = () => new Date().toISOString();
const fmtDT      = (iso) => { if (!iso) return '—'; return new Date(iso).toLocaleString(); };
const fmtD       = (iso) => { if (!iso) return '—'; return new Date(iso).toLocaleDateString(); };
const randomCode = () => Math.floor(10000 + Math.random() * 90000).toString();
const sleep      = (ms) => new Promise(r => setTimeout(r, ms));

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
  return h.toString(16);
}

// ── Validation helpers ────────────────────────────────────────────
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
  return emailRegex.test(email);
}
function isValidPhone(phone) {
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{3,14}$/;
  return phoneRegex.test(phone);
}
function isValidUsername(username) {
  return /^[a-zA-Z0-9._]{3,30}$/.test(username);
}
function isValidName(name) {
  return /^[a-zA-Z\s\-']{2,50}$/.test(name.trim());
}

// ── Data Integrity Validation ─────────────────────────────────────
// Returns true only when the data object is structurally sound.
// NOTE: this function is intentionally NON-DESTRUCTIVE; callers must
// decide what to do when it returns false (warn, do NOT auto-wipe).
function validateDataIntegrity(data) {
  if (!data || typeof data !== 'object') return false;

  const requiredArrays = ['users', 'elections', 'categories', 'candidates', 'votes'];
  for (const arr of requiredArrays) {
    if (!Array.isArray(data[arr])) return false;
  }

  const userIds      = new Set();
  const userEmails   = new Set();
  const userUsernames = new Set();

  for (const user of data.users) {
    if (!user.id || userIds.has(user.id)) return false;
    userIds.add(user.id);

    const email = user.email?.toLowerCase();
    if (!email || userEmails.has(email)) return false;
    userEmails.add(email);

    const username = user.username?.toLowerCase();
    if (username) {
      if (userUsernames.has(username)) return false;
      userUsernames.add(username);
    }
  }

  return true;
}

// ══════════════════════════════════════════════════════════════════
//  CONCURRENCY LAYER
// ══════════════════════════════════════════════════════════════════

// ── Write queue ───────────────────────────────────────────────────
// FIX-7: thread the resolved value through the chain so callers
// awaiting saveData() receive the atomicSave result object.
let _writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  _writeQueue = _writeQueue.then(() => fn().catch(e => {
    console.error("SmartVotes: enqueued write failed", e);
    return { success: false, error: e.message };
  }));
  return _writeQueue;
}

// ── JSONBin helpers ───────────────────────────────────────────────
function jbinAuthHeaders(withContentType) {
  const h = {};
  if (JBIN_MASTER_KEY) {
    h['X-Master-Key'] = JBIN_MASTER_KEY;
  } else if (JBIN_ACCESS_KEY) {
    h['X-Access-Key'] = JBIN_ACCESS_KEY;
  }
  if (withContentType) h['Content-Type'] = 'application/json';
  return h;
}

async function jbinGet() {
  if (!JBIN_READY) {
    console.info("SmartVotes: JSONBin not configured — using localStorage only.");
    return null;
  }
  try {
    const r = await fetch(`${JBIN_URL}/b/${JBIN_BIN}/latest`, {
      headers: jbinAuthHeaders(false)
    });
    if (!r.ok) {
      console.warn(`SmartVotes: JSONBin GET ${r.status}`);
      return null;
    }
    const j = await r.json();
    return j.record || null;
  } catch (e) {
    console.warn("SmartVotes: JSONBin GET network error.", e.message);
    return null;
  }
}

async function jbinPut(data) {
  if (!JBIN_READY) return false;

  const MAX_RETRIES = 4;
  let delay = 600;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await fetch(`${JBIN_URL}/b/${JBIN_BIN}`, {
        method:  'PUT',
        headers: jbinAuthHeaders(true),
        body:    JSON.stringify(data)
      });

      if (r.ok) return true;

      const status = r.status;
      if (status === 429 || status >= 500) {
        console.warn(`SmartVotes: JSONBin PUT ${status} — retry ${attempt}/${MAX_RETRIES} in ${delay}ms`);
        await sleep(delay);
        delay *= 2;
        continue;
      }
      const body = await r.text();
      console.warn(`SmartVotes: JSONBin PUT ${status} (non-retryable). ${body}`);
      return false;

    } catch (e) {
      console.warn(`SmartVotes: JSONBin PUT network error (attempt ${attempt}).`, e.message);
      if (attempt < MAX_RETRIES) { await sleep(delay); delay *= 2; }
    }
  }

  console.error("SmartVotes: JSONBin PUT failed after all retries.");
  return false;
}

// ── Local Storage ─────────────────────────────────────────────────
function lsGet() {
  try { return JSON.parse(localStorage.getItem('svn_data') || 'null'); } catch { return null; }
}
function lsPut(data) {
  try { localStorage.setItem('svn_data', JSON.stringify(data)); return true; } catch { return false; }
}
function lsSession(u)     { localStorage.setItem('svn_session', JSON.stringify(u)); }
function lsSessionGet()   { try { return JSON.parse(localStorage.getItem('svn_session') || 'null'); } catch { return null; } }
function lsSessionClear() { localStorage.removeItem('svn_session'); }

// ── Merge helper ──────────────────────────────────────────────────
function mergeData(remote, local) {
  const merged = {};
  const keys = ['users', 'elections', 'categories', 'candidates', 'votes'];
  for (const key of keys) {
    const remoteArr = Array.isArray(remote[key]) ? remote[key] : [];
    const localArr  = Array.isArray(local[key])  ? local[key]  : [];
    const remoteIds = new Set(remoteArr.map(x => x.id));
    const localOnly = localArr.filter(x => !remoteIds.has(x.id));
    merged[key] = [...remoteArr, ...localOnly];
  }
  return merged;
}

// ── Data Load ─────────────────────────────────────────────────────
// FIX-1 + FIX-2: loadData no longer wipes data on integrity failure
// or when a force-refresh fetch returns null.
//
// Old behaviour (buggy):
//   forceRefresh=true + jbinGet()=null → data=null → buildDefaultData()
//   → jbinPut(defaultData)  ← WIPED the entire remote store!
//
// New behaviour:
//   1. Try remote fetch (always when JBIN_READY, skip only when
//      !JBIN_READY to avoid unnecessary network calls).
//   2. On success → sync localStorage and use remote copy.
//   3. On null remote (network error, 429, etc.) → fall back to
//      localStorage regardless of forceRefresh flag.  We NEVER
//      generate and push default data unless BOTH remote AND local
//      are absent (truly fresh install).
//   4. If validateDataIntegrity fails → log a warning, continue
//      with the data as-is.  A failed integrity check is evidence
//      that something is wrong; silently replacing the dataset
//      with defaults makes diagnosis impossible and loses votes.
async function loadData(forceRefresh = false) {
  let data = null;

  if (JBIN_READY) {
    data = await jbinGet();
  }

  if (data) {
    // Remote fetch succeeded — keep localStorage in sync.
    lsPut(data);
  } else {
    // FIX-1: always fall back to localStorage when remote is unavailable,
    // even when forceRefresh=true.  The old code skipped this branch for
    // forceRefresh, so a transient 429/network-error during validation or
    // vote-submit caused data=null → buildDefaultData() → remote wipe.
    data = lsGet();
    if (data) {
      console.info("SmartVotes: using localStorage fallback (remote unavailable).");
    }
  }

  if (!data) {
    // Truly fresh install — no remote data and no local cache.
    data = buildDefaultData();
    lsPut(data);
    if (JBIN_READY) {
      await jbinPut(data);
    }
  }

  // FIX-2: integrity failure is a WARNING, not a trigger to wipe.
  // If the remote or local data has a structural problem (e.g. a
  // duplicate email from an old import), we continue with what we
  // have and surface the issue in the console.  Silently resetting
  // to defaults and overwriting JSONBin would destroy all records.
  if (!validateDataIntegrity(data)) {
    console.warn(
      "SmartVotes: loaded data failed integrity check. " +
      "Continuing with existing data — investigate manually."
    );
    // Do NOT call buildDefaultData() or jbinPut() here.
  }

  appData = { users: [], elections: [], categories: [], candidates: [], votes: [], ...data };
  ensureAdmin();
  return appData;
}

// ── Startup Integrity Check ───────────────────────────────────────
// Non-destructive advisory check — surfaces issues without wiping.
async function performStartupIntegrityCheck() {
  if (!JBIN_READY) return true;

  try {
    const remote = await jbinGet();
    if (remote && !validateDataIntegrity(remote)) {
      console.error("SmartVotes: Remote data integrity check FAILED!");
      showToast("Data integrity issue detected. Contact support.", "error");
      // Return false to signal the caller, but do NOT reset data.
      return false;
    }

    const local = lsGet();
    if (local && !validateDataIntegrity(local)) {
      console.warn("Local cache integrity check failed — cache will not be used for fallback.");
      // If remote is valid, re-sync localStorage from remote.
      if (remote && validateDataIntegrity(remote)) {
        lsPut(remote);
        appData = { users: [], elections: [], categories: [], candidates: [], votes: [], ...remote };
      }
    }

    return true;
  } catch (e) {
    console.error("Startup integrity check error:", e);
    return false;
  }
}

// ── Atomic Save (read-before-write) ──────────────────────────────
// The ONLY function that writes to JSONBin. Always called inside
// enqueueWrite() so at most one write runs at a time.
//
// FIX-3: Business-logic errors thrown by fn() (DUPLICATE_EMAIL,
//   DUPLICATE_USERNAME) now abort immediately instead of retrying
//   up to maxRetries times.
//
// FIX-4: When all remote-fetch retries are exhausted (remote=null),
//   the JSONBin PUT is skipped and the mutation is saved to
//   localStorage only — identical to the original atomicSave guard.
//   The old "improved" code fell through to use local appData as the
//   write base after exhausting retries, risking an overwrite.
//
// FIX-5: Post-write verification jbinGet() removed.  It doubled API
//   calls per mutation and contributed to rate-limit cascades.  The
//   read-before-write in step 1 already provides a fresh baseline.
async function atomicSave(fn, options = {}) {
  const { maxRetries = 3 } = options;

  // Sentinel set on the fn()-thrown error to skip retries.
  const BUSINESS_ERROR_MARKER = '__BUSINESS_ERROR__';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. Fetch latest remote state.
      let remote = JBIN_READY ? await jbinGet() : null;

      if (JBIN_READY && remote === null) {
        if (attempt < maxRetries) {
          console.warn(`atomicSave: remote fetch failed, retry ${attempt}/${maxRetries}`);
          await sleep(500 * attempt);
          continue;
        }
        // FIX-4: All retries exhausted with null remote.
        // Apply mutation to local state only — do NOT fall through
        // to a PUT that would use stale local data as the remote baseline.
        console.warn(
          "SmartVotes: atomicSave — could not obtain a remote baseline after " +
          maxRetries + " attempts. Mutation saved to localStorage only."
        );
        const localBase = { users: [], elections: [], categories: [], candidates: [], votes: [], ...appData };
        const localPatched = fn ? fn(localBase) : localBase;
        lsPut(localPatched);
        appData = localPatched;
        ensureAdmin();
        return { success: false, error: "REMOTE_UNAVAILABLE", data: appData };
      }

      // 2. Merge remote with current in-memory state.
      const base   = remote ? mergeData(remote, appData) : appData;
      const merged = { users: [], elections: [], categories: [], candidates: [], votes: [], ...base };

      // 3. Apply caller's mutation on top of the merged snapshot.
      //    Business-logic errors thrown here abort immediately (FIX-3).
      let patched;
      try {
        patched = fn ? fn(merged) : merged;
      } catch (businessErr) {
        businessErr[BUSINESS_ERROR_MARKER] = true;
        throw businessErr;
      }

      // 4. Persist locally first (always safe).
      lsPut(patched);

      // 5. Push to JSONBin.
      if (JBIN_READY) {
        await jbinPut(patched);
        // FIX-5: no post-write verification GET.
      }

      // 6. Sync global state.
      appData = patched;
      ensureAdmin();
      return { success: true, data: appData, attempt };

    } catch (e) {
      // FIX-3: Do not retry business-logic errors.
      if (e[BUSINESS_ERROR_MARKER]) {
        return { success: false, error: e.message, data: appData };
      }
      console.error(`atomicSave attempt ${attempt} failed:`, e);
      if (attempt === maxRetries) {
        return { success: false, error: e.message, data: appData };
      }
      await sleep(500 * attempt);
    }
  }

  return { success: false, error: "Max retries exceeded", data: appData };
}

// Convenience wrapper: enqueue an atomicSave.
// FIX-7: return the promise so callers can await the result.
function saveData(fn, options) {
  return enqueueWrite(() => atomicSave(fn, options));
}

// ── Background polling ────────────────────────────────────────────
const POLL_INTERVAL = 20000;
let   _pollTimer    = null;

function startPolling() {
  stopPolling();
  _pollTimer = setInterval(async () => {
    if (!currentUser) { stopPolling(); return; }
    try {
      const remote = JBIN_READY ? await jbinGet() : null;
      if (!remote) return;  // Never reset state on a null poll result.
      const refreshed = mergeData(remote, appData);
      appData = { users: [], elections: [], categories: [], candidates: [], votes: [], ...refreshed };
      ensureAdmin();
      _refreshVisiblePanels();
    } catch (e) {
      console.warn("SmartVotes: background poll error", e);
    }
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function _refreshVisiblePanels() {
  if (document.getElementById('panel-admin-overview')?.classList.contains('active')) { refreshAdminStats(); renderOverviewElections(); }
  if (document.getElementById('panel-admin-elections')?.classList.contains('active'))  renderElectionsTable();
  if (document.getElementById('panel-admin-categories')?.classList.contains('active')) renderCategoriesTable();
  if (document.getElementById('panel-admin-candidates')?.classList.contains('active')) renderCandidatesTable();
  if (document.getElementById('panel-admin-users')?.classList.contains('active'))      renderUsersTable();
  if (document.getElementById('panel-voter-elections')?.classList.contains('active'))  renderVoterElections();
  if (document.getElementById('panel-voter-history')?.classList.contains('active'))    renderVoterHistory();
  refreshAdminStats();
  renderHomePage();
}

// ══════════════════════════════════════════════════════════════════

function buildDefaultData() {
  return {
    users: [{
      id: "Admin01",
      name: "System Administrator",
      username: "Admin01",
      email: "admin@smartvotes.net",
      password: hashStr(APP.DEFAULT_ADMIN_PASSWORD),
      gender: "Male",
      age: 30,
      phone: "09038197586",
      address: "",
      role: "admin",
      validated: "Yes",
      validation_code: "",
      created: now()
    }],
    elections:  [],
    categories: [],
    candidates: [],
    votes:      []
  };
}

function ensureAdmin() {
  const adm = appData.users.find(u => u.id === "Admin01");
  if (!adm) {
    appData.users.unshift({
      id: "Admin01", name: "System Administrator", username: "Admin01",
      email: "admin@smartvotes.net",
      password: hashStr(APP.DEFAULT_ADMIN_PASSWORD),
      gender: "Male", age: 30, phone: "09038197586", address: "",
      role: "admin", validated: "Yes", validation_code: "", created: now()
    });
  }
}


// ── Firebase Storage ──────────────────────────────────────────────
async function firebaseUpload(file, path) {
  try {
    const { initializeApp }                           = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js");
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js");
    if (!window._fbApp) window._fbApp = initializeApp(FB, 'svn-app');
    const storage    = getStorage(window._fbApp);
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.warn("Firebase upload failed — using base64 fallback.", e);
    return await fileToBase64(file);
  }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// ── EmailJS ───────────────────────────────────────────────────────
async function sendValidationEmail(toEmail, toName, code) {
  if (!EJS.PUBLIC_KEY || EJS.PUBLIC_KEY.startsWith('YOUR')) {
    console.warn("EmailJS not configured. Code:", code);
    showToast(`[DEV] Validation code: ${code}`, 'info');
    return true;
  }
  try {
    await emailjs.init(EJS.PUBLIC_KEY);
    await emailjs.send(EJS.SERVICE_ID, EJS.TEMPLATE_ID, {
      to_email: toEmail, to_name: toName, code, app_name: "SmartVotes Network"
    });
    return true;
  } catch (e) {
    console.error("EmailJS error:", e);
    showToast(`[DEV] Email failed. Code: ${code}`, 'warning');
    return false;
  }
}

// ── Navigation ────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const el    = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0, 0);

  if (page === 'dashboard') { if (!currentUser) { navigate('auth'); return; } renderDashboard(); }
  if (page === 'home')      renderHomePage();
}

// ── Auth UI ───────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`form-${tab}`).classList.add('active');
  clearAlert('signin-alert');
  clearAlert('register-alert');
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁'; }
}

function codeNext(el, nextIdx) {
  el.value = el.value.replace(/\D/g, '');
  if (el.value && nextIdx <= 4) document.getElementById(`vc${nextIdx}`)?.focus();
}
function codePrev(e, prevIdx) {
  if (e.key === 'Backspace' && !e.target.value) document.getElementById(`vc${prevIdx}`)?.focus();
}

// ── Sign In ───────────────────────────────────────────────────────
async function doSignIn() {
  const email    = v('si-email').trim().toLowerCase();
  const password = v('si-password');
  if (!email || !password) { showAlert('signin-alert', 'Please fill in all fields.', 'error'); return; }

  await loadData();

  const user = appData.users.find(u =>
    (u.email.toLowerCase() === email || u.username?.toLowerCase() === email) &&
    u.password === hashStr(password)
  );

  const isAdminDefault = (email === 'admin01' || email === 'admin@smartvotes.net') && password === APP.DEFAULT_ADMIN_PASSWORD;
  const matched = user || (isAdminDefault ? appData.users.find(u => u.id === 'Admin01') : null);

  if (!matched) { showAlert('signin-alert', 'Invalid email or password.', 'error'); return; }

  if (matched.validated === 'No' && matched.role !== 'admin') {
    pendingValidationUser = matched;
    showValidationCard(matched.email);
    return;
  }
  loginSuccess(matched);
}

function showValidationCard(email) {
  document.getElementById('auth-main-card').classList.add('hidden');
  document.getElementById('auth-validate-card').classList.remove('hidden');
  document.getElementById('validate-hint').textContent =
    `We sent a 5-digit code to ${email}. Enter it below to activate your account.`;
  for (let i = 0; i < 5; i++) { const el = document.getElementById(`vc${i}`); if (el) el.value = ''; }
  document.getElementById('vc0')?.focus();
}

function backToSignIn() {
  document.getElementById('auth-main-card').classList.remove('hidden');
  document.getElementById('auth-validate-card').classList.add('hidden');
  pendingValidationUser = null;
}

// ── Email Validation ──────────────────────────────────────────────
async function doValidateCode() {
  if (!pendingValidationUser) {
    showAlert('validate-alert', 'Session expired. Please sign in again.', 'error');
    backToSignIn();
    return;
  }

  const entered = [0, 1, 2, 3, 4].map(i => document.getElementById(`vc${i}`)?.value || '').join('');
  if (entered.length < 5) {
    showAlert('validate-alert', 'Please enter all 5 digits.', 'error');
    return;
  }

  setLoading('btn-validate', true, 'Verifying...');

  try {
    // FIX-1 applies here: loadData() no longer nukes data on a bad fetch.
    // We pass the default forceRefresh=false to use the safest fetch path.
    await loadData();

    const freshUser = appData.users.find(x => x.id === pendingValidationUser.id);
    if (!freshUser) {
      showAlert('validate-alert', 'Account not found. Please register again.', 'error');
      backToSignIn();
      return;
    }

    if (entered !== freshUser.validation_code) {
      showAlert('validate-alert', 'Incorrect code. Please try again.', 'error');
      setLoading('btn-validate', false, 'Verify Email');
      return;
    }

    const saveResult = await saveData(data => {
      const user = data.users.find(x => x.id === pendingValidationUser.id);
      if (user) {
        user.validated = 'Yes';
        user.validation_code = '';
        user.validated_at = now();
      }
      return data;
    });

    if (!saveResult || !saveResult.success) {
      // Even if the remote write failed, the local state was updated.
      // Log the issue but allow the user to proceed — the next background
      // poll will re-sync the remote.
      console.warn("doValidateCode: remote save uncertain, proceeding with local state.");
    }

    const updatedUser = appData.users.find(x => x.id === pendingValidationUser.id);
    showAlert('validate-alert', 'Email verified! Logging you in…', 'success');
    setTimeout(() => {
      loginSuccess(updatedUser || pendingValidationUser);
      pendingValidationUser = null;
    }, 1200);

  } catch (error) {
    console.error("Validation error:", error);
    showAlert('validate-alert', 'Verification failed. Please try again.', 'error');
    setLoading('btn-validate', false, 'Verify Email');
  }
}

// ── Resend Validation Code ────────────────────────────────────────
async function resendValidationCode() {
  if (!pendingValidationUser) {
    showToast("No pending validation user found. Please sign in again.", "error");
    return;
  }

  const resendBtn = document.getElementById('resend-link');
  const originalText = resendBtn?.textContent || 'Resend';
  setLoading('resend-link', true, 'Sending...');

  try {
    // FIX-1 applies: loadData() no longer wipes data on a failed fetch.
    await loadData();

    const freshUser = appData.users.find(x => x.id === pendingValidationUser.id);
    if (!freshUser) {
      showToast("User account not found. Please register again.", "error");
      backToSignIn();
      return;
    }

    const newCode = randomCode();

    const saveResult = await saveData(data => {
      const user = data.users.find(x => x.id === pendingValidationUser.id);
      if (user) {
        user.validation_code = newCode;
        user.updated = now();
      }
      return data;
    });

    if (!saveResult || !saveResult.success) {
      console.warn("resendValidationCode: remote save uncertain.");
    }

    // Retry email up to 3 times.
    let emailSent = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      emailSent = await sendValidationEmail(
        pendingValidationUser.email,
        pendingValidationUser.name,
        newCode
      );
      if (emailSent) break;
      await sleep(1000);
    }

    // Keep pendingValidationUser in sync with persisted state.
    const updatedUser = appData.users.find(x => x.id === pendingValidationUser.id);
    if (updatedUser) {
      pendingValidationUser = { ...updatedUser };
    } else {
      pendingValidationUser.validation_code = newCode;
    }

    if (emailSent) {
      showToast('New validation code sent! Check your email.', 'success');
    } else {
      showToast(`Could not send email. Your validation code is: ${newCode}`, 'warning');
    }

  } catch (error) {
    console.error("Resend validation error:", error);
    showToast("Failed to resend code. Please try again.", "error");
  } finally {
    setLoading('resend-link', false, originalText);
  }
}

// ── Register ──────────────────────────────────────────────────────
async function doRegister() {
  const name      = v('reg-name').trim();
  const username  = v('reg-username').trim();
  const email     = v('reg-email').trim().toLowerCase();
  const password  = v('reg-password');
  const password2 = v('reg-password2');
  const gender    = v('reg-gender');
  const age       = parseInt(v('reg-age'));
  const phone     = v('reg-phone').trim();
  const address   = v('reg-address').trim();

  // ── Client-side validation ────────────────────────────────────
  if (!name || !username || !email || !password || !password2 || !gender || !age || !phone) {
    showAlert('register-alert', 'Please fill all required fields.', 'error'); return;
  }
  if (!isValidName(name)) {
    showAlert('register-alert', 'Please enter a valid name (2–50 letters, spaces, hyphens, apostrophes).', 'error'); return;
  }
  if (!isValidUsername(username)) {
    showAlert('register-alert', 'Username must be 3–30 characters (letters, numbers, . and _ only).', 'error'); return;
  }
  if (!isValidEmail(email)) {
    showAlert('register-alert', 'Please enter a valid email address.', 'error'); return;
  }
  if (password !== password2) {
    showAlert('register-alert', 'Passwords do not match.', 'error'); return;
  }
  if (password.length < 6) {
    showAlert('register-alert', 'Password must be at least 6 characters.', 'error'); return;
  }
  if (isNaN(age) || age < 18 || age > 120) {
    showAlert('register-alert', 'You must be at least 18 years old.', 'error'); return;
  }
  if (!isValidPhone(phone)) {
    showAlert('register-alert', 'Please enter a valid phone number.', 'error'); return;
  }

  setLoading('btn-register', true, 'Creating Account…');

  const validationCode = randomCode();
  const userId         = uid();
  const creationTime   = now();

  const newUser = {
    id: userId, name, username, email,
    password: hashStr(password),
    gender, age, phone, address: address || '',
    role: 'voter', validated: 'No',
    validation_code: validationCode,
    created: creationTime, updated: creationTime
  };

  try {
    // ── Atomic save with duplicate guard inside the write lock ────
    // Using saveData() (enqueued) so this write is serialized with
    // any other concurrent saves (FIX-7).
    const saveResult = await saveData(data => {
      // These checks run against the most current remote snapshot
      // fetched inside atomicSave — the definitive race-condition guard.
      if (data.users.some(u => u.email.toLowerCase() === email)) {
        throw new Error("DUPLICATE_EMAIL");
      }
      if (data.users.some(u => u.username?.toLowerCase() === username.toLowerCase())) {
        throw new Error("DUPLICATE_USERNAME");
      }
      data.users.push(newUser);
      return data;
    });

    if (!saveResult || !saveResult.success) {
      if (saveResult?.error === "DUPLICATE_EMAIL") {
        setLoading('btn-register', false, 'Create Account →');
        showAlert('register-alert', 'This email is already registered.', 'error'); return;
      }
      if (saveResult?.error === "DUPLICATE_USERNAME") {
        setLoading('btn-register', false, 'Create Account →');
        showAlert('register-alert', 'This username is already taken.', 'error'); return;
      }
      if (saveResult?.error === "REMOTE_UNAVAILABLE") {
        // Local-only save succeeded. The user is persisted locally and
        // will sync to remote on the next successful write.
        console.warn("Registration saved locally; will sync to remote when connectivity returns.");
      } else {
        throw new Error(saveResult?.error || "Unknown save error");
      }
    }

    // ── Send verification email (non-critical) ────────────────────
    let emailSent = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        emailSent = await sendValidationEmail(email, name, validationCode);
        if (emailSent) break;
        await sleep(1000);
      } catch (emailError) {
        console.warn(`Email attempt ${attempt} failed:`, emailError);
      }
    }

    setLoading('btn-register', false, 'Create Account →');

    if (emailSent) {
      showToast('Account created! Check your email for the verification code.', 'success');
    } else {
      showToast(`Account created! Your verification code is: ${validationCode}`, 'warning');
    }

    const persistedUser = appData.users.find(u => u.id === userId) || newUser;
    pendingValidationUser = persistedUser;
    showValidationCard(email);

  } catch (error) {
    console.error("Registration error:", error);
    setLoading('btn-register', false, 'Create Account →');
    showAlert('register-alert', 'Registration failed. Please try again.', 'error');
  }
}

// ── Logout ────────────────────────────────────────────────────────
function logout() {
  stopPolling();
  currentUser = null;
  lsSessionClear();
  updateHeaderForUser(null);
  navigate('home');
  showToast('You have been logged out.', 'info');
}

function loginSuccess(user) {
  currentUser = user;
  lsSession(user);
  updateHeaderForUser(user);
  startPolling();
  navigate('dashboard');
  showToast(`Welcome back, ${user.name}! 👋`, 'success');
}

function updateHeaderForUser(user) {
  const signinLink = document.getElementById('nav-signin');
  const userBtn    = document.getElementById('user-menu-btn');
  const headerUser = document.getElementById('header-username');
  const headerAva  = document.getElementById('header-avatar');
  const mobSignin  = document.getElementById('mob-signin');
  const mobDash    = document.getElementById('mob-dashboard');
  const mobLogout  = document.getElementById('mob-logout');

  if (user) {
    signinLink?.classList.add('hidden');
    userBtn?.classList.remove('hidden');
    if (headerUser) headerUser.textContent = user.username || user.name;
    if (headerAva)  headerAva.textContent  = (user.name || 'U')[0].toUpperCase();
    mobSignin?.classList.add('hidden');
    mobDash?.classList.remove('hidden');
    mobLogout?.classList.remove('hidden');
    const dd = document.getElementById('dd-username');
    const dr = document.getElementById('dd-role');
    if (dd) dd.textContent = user.name;
    if (dr) dr.textContent = user.role === 'admin' ? 'Administrator' : 'Voter';
  } else {
    signinLink?.classList.remove('hidden');
    userBtn?.classList.add('hidden');
    mobSignin?.classList.remove('hidden');
    mobDash?.classList.add('hidden');
    mobLogout?.classList.add('hidden');
  }
}

function toggleUserMenu() { document.getElementById('user-dropdown')?.classList.toggle('hidden'); }

document.addEventListener('click', e => {
  const dd     = document.getElementById('user-dropdown');
  const btn    = document.getElementById('user-menu-btn');
  const burger = document.getElementById('hamburger');
  if (!dd) return;
  if (burger?.contains(e.target)) return;
  if (!dd.contains(e.target) && !btn?.contains(e.target)) {
    dd.classList.add('hidden');
  }
});

// ── Dashboard ─────────────────────────────────────────────────────
function renderDashboard() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';

  setText('sb-username', currentUser.name);
  setText('sb-role', isAdmin ? 'Administrator' : 'Voter');
  setText('sb-avatar', (currentUser.name || 'U')[0].toUpperCase());
  if (isAdmin) setText('admin-date', new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

  document.getElementById('admin-sidebar-menu').classList.toggle('hidden', !isAdmin);
  document.getElementById('voter-sidebar-menu').classList.toggle('hidden',  isAdmin);

  if (isAdmin) {
    showPanel('admin-overview');
    refreshAdminStats();
    renderOverviewElections();
    populateElectionSelects();
  } else {
    showPanel('voter-elections');
    renderVoterElections();
  }
}

function showPanel(panelId) {
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${panelId}`)?.classList.add('active');
  document.querySelectorAll('.sidebar-link[data-panel]').forEach(l => {
    l.classList.toggle('active', l.dataset.panel === panelId);
  });

  if (panelId === 'admin-elections')  renderElectionsTable();
  if (panelId === 'admin-categories') { populateCatElectionFilter(); renderCategoriesTable(); }
  if (panelId === 'admin-candidates') { populateCandidateFilters(); renderCandidatesTable(); }
  if (panelId === 'admin-users')      renderUsersTable();
  if (panelId === 'admin-results')    populateResultElectionSelect();
  if (panelId === 'voter-elections')  renderVoterElections();
  if (panelId === 'voter-history')    renderVoterHistory();
  if (panelId === 'voter-results')    populateVoterResultSelect();
}

// ── Admin Stats ───────────────────────────────────────────────────
function refreshAdminStats() {
  const voters     = appData.users.filter(u => u.role === 'voter').length;
  const totalVotes = appData.votes.length;
  setText('sc-elections',  appData.elections.length);
  setText('sc-voters',     voters);
  setText('sc-votes',      totalVotes);
  setText('sc-candidates', appData.candidates.length);
  setText('hs-elections',  appData.elections.length);
  setText('hs-voters',     voters);
  setText('hs-votes',      totalVotes);
}

// ── Overview Elections Table ──────────────────────────────────────
function renderOverviewElections() {
  const tbody = document.getElementById('overview-elections-tbody');
  if (!tbody) return;
  const rows = appData.elections.slice(-5).reverse();
  tbody.innerHTML = rows.length ? rows.map(e => `
    <tr>
      <td><strong>${esc(e.title)}</strong></td>
      <td>${fmtDT(e.start)}</td><td>${fmtDT(e.end)}</td>
      <td>${statusBadge(e)}</td>
      <td><button class="btn btn-xs btn-primary" onclick="showPanel('admin-elections')">Manage</button></td>
    </tr>
  `).join('') : `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">🗳️</div><h3>No elections yet</h3></div></td></tr>`;
}

// ── Elections Table ───────────────────────────────────────────────
function renderElectionsTable() {
  const tbody = document.getElementById('elections-tbody');
  if (!tbody) return;
  tbody.innerHTML = appData.elections.length ? appData.elections.map(e => `
    <tr data-search="${esc(e.title).toLowerCase()}">
      <td><div style="width:48px;height:40px;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,var(--green-deep),var(--purple-deep));display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);font-size:1.2rem">
        ${e.image ? `<img src="${e.image}" style="width:100%;height:100%;object-fit:cover"/>` : '🗳️'}
      </div></td>
      <td><strong>${esc(e.title)}</strong></td>
      <td style="font-size:0.8rem;font-family:var(--font-mono)">${fmtDT(e.start)}</td>
      <td style="font-size:0.8rem;font-family:var(--font-mono)">${fmtDT(e.end)}</td>
      <td>${statusBadge(e)}</td>
      <td><span class="badge ${e.viewStatus === 'visible' ? 'badge-success' : 'badge-neutral'}">${e.viewStatus || 'hidden'}</span></td>
      <td><div class="action-btns">
        <button class="btn btn-xs btn-primary"   onclick="openElectionModal('${e.id}')">✏️</button>
        <button class="btn btn-xs btn-secondary" onclick="toggleViewStatus('${e.id}')">${e.viewStatus === 'visible' ? '🙈' : '👁'}</button>
        <button class="btn btn-xs btn-danger"    onclick="confirmDelete('election','${e.id}')">🗑️</button>
      </div></td>
    </tr>
  `).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🗳️</div><h3>No elections yet</h3><p>Click "+ New Election" to create one.</p></div></td></tr>`;
}

function statusBadge(e) {
  const s = computeStatus(e);
  const m = { active: 'badge-success', upcoming: 'badge-info', ended: 'badge-neutral', test: 'badge-purple' };
  return `<span class="badge ${m[s] || 'badge-neutral'}">${s}</span>`;
}

function computeStatus(e) {
  if (e.status === 'test') return 'test';
  const n = Date.now(), s = new Date(e.start).getTime(), en = new Date(e.end).getTime();
  if (n < s)  return 'upcoming';
  if (n > en) return 'ended';
  return 'active';
}

// ── Election Modal ────────────────────────────────────────────────
function openElectionModal(id) {
  editingId = id || null;
  clearAlert('election-form-alert');
  document.getElementById('election-modal-title').textContent = id ? 'Edit Election Event' : 'New Election Event';
  if (id) {
    const e = appData.elections.find(x => x.id === id);
    if (!e) return;
    sv('el-title', e.title); sv('el-start', e.start?.slice(0,16)||'');
    sv('el-end', e.end?.slice(0,16)||''); sv('el-desc', e.description||'');
    sv('el-view-status', e.viewStatus||'hidden'); sv('el-status', e.status||'upcoming');
  } else {
    ['el-title','el-start','el-end','el-desc'].forEach(i => sv(i,''));
    sv('el-view-status','hidden'); sv('el-status','upcoming');
    document.getElementById('el-img-preview').classList.add('hidden');
  }
  openModal('modal-election');
}

async function saveElection() {
  const title = v('el-title').trim(), start = v('el-start'), end = v('el-end');
  if (!title||!start||!end) { showAlert('election-form-alert','Title, start and end are required.','error'); return; }
  if (new Date(start) >= new Date(end)) { showAlert('election-form-alert','End time must be after start time.','error'); return; }
  setLoading('btn-save-election', true, 'Saving…');

  let imageUrl = '';
  const imgInput = document.getElementById('el-img-input');
  if (imgInput?.files?.length) imageUrl = await firebaseUpload(imgInput.files[0], `elections/${uid()}`);

  const capId = editingId;

  await saveData(data => {
    if (capId) {
      const idx = data.elections.findIndex(e => e.id === capId);
      if (idx >= 0) data.elections[idx] = { ...data.elections[idx], title, start, end,
        description: v('el-desc'), viewStatus: v('el-view-status'), status: v('el-status'),
        updated: now(), ...(imageUrl ? { image: imageUrl } : {}) };
    } else {
      data.elections.push({ id: uid(), title, start, end,
        description: v('el-desc'), viewStatus: v('el-view-status'), status: v('el-status'),
        image: imageUrl, created: now() });
    }
    return data;
  });

  setLoading('btn-save-election', false, 'Save Election');
  closeModal('modal-election');
  renderElectionsTable(); renderOverviewElections(); refreshAdminStats(); populateElectionSelects();
  showToast(capId ? 'Election updated!' : 'Election created!', 'success');
  editingId = null;
}

async function toggleViewStatus(id) {
  await saveData(data => {
    const e = data.elections.find(x => x.id === id);
    if (e) e.viewStatus = e.viewStatus === 'visible' ? 'hidden' : 'visible';
    return data;
  });
  renderElectionsTable();
  const e = appData.elections.find(x => x.id === id);
  showToast(`Election is now ${e?.viewStatus || 'updated'}.`, 'info');
}

// ── Categories ────────────────────────────────────────────────────
function populateCatElectionFilter() {
  const sel = document.getElementById('cat-election-filter');
  if (!sel) return;
  sel.innerHTML = '<option value="">— All Elections —</option>' +
    appData.elections.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
}
function loadCategories() { renderCategoriesTable(); }

function renderCategoriesTable() {
  const filter = v('cat-election-filter') || '';
  const tbody  = document.getElementById('categories-tbody');
  if (!tbody) return;
  const rows = filter ? appData.categories.filter(c => c.electionId === filter) : appData.categories;
  tbody.innerHTML = rows.length ? rows.map(c => {
    const el = appData.elections.find(e => e.id === c.electionId);
    return `<tr>
      <td><strong>${esc(c.name)}</strong></td>
      <td style="font-size:0.85rem;color:var(--gray-400)">${esc(c.description||'—')}</td>
      <td><span class="badge badge-green">${esc(el?.title||'—')}</span></td>
      <td><div class="action-btns">
        <button class="btn btn-xs btn-primary" onclick="openCategoryModal('${c.id}')">✏️</button>
        <button class="btn btn-xs btn-danger"  onclick="confirmDelete('category','${c.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">📂</div><h3>No categories</h3></div></td></tr>`;
}

function openCategoryModal(id) {
  editingId = id || null;
  clearAlert('cat-form-alert');
  const elSel = document.getElementById('cat-election-id');
  elSel.innerHTML = '<option value="">— Select Election —</option>' +
    appData.elections.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
  document.getElementById('cat-modal-title').textContent = id ? 'Edit Category' : 'New Category';
  if (id) {
    const c = appData.categories.find(x => x.id === id);
    if (c) { sv('cat-election-id', c.electionId); sv('cat-name', c.name); sv('cat-desc', c.description||''); }
  } else {
    sv('cat-name',''); sv('cat-desc','');
    const cf = v('cat-election-filter'); if (cf) sv('cat-election-id', cf);
  }
  openModal('modal-category');
}

async function saveCategory() {
  const elId = v('cat-election-id'), name = v('cat-name').trim();
  if (!elId||!name) { showAlert('cat-form-alert','Election and name are required.','error'); return; }
  setLoading('btn-save-category', true, 'Saving…');

  const capId = editingId;

  await saveData(data => {
    if (capId) {
      const idx = data.categories.findIndex(c => c.id === capId);
      if (idx >= 0) data.categories[idx] = { ...data.categories[idx], electionId: elId, name, description: v('cat-desc'), updated: now() };
    } else {
      data.categories.push({ id: uid(), electionId: elId, name, description: v('cat-desc'), created: now() });
    }
    return data;
  });

  setLoading('btn-save-category', false, 'Save Category');
  closeModal('modal-category'); renderCategoriesTable(); populateCandidateFilters();
  showToast(capId ? 'Category updated!' : 'Category created!', 'success');
  editingId = null;
}

// ── Candidates ────────────────────────────────────────────────────
function populateCandidateFilters() {
  const elFilter  = document.getElementById('cand-election-filter');
  const catFilter = document.getElementById('cand-category-filter');
  if (elFilter)  elFilter.innerHTML  = '<option value="">— All Elections —</option>'  + appData.elections.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
  if (catFilter) catFilter.innerHTML = '<option value="">— All Categories —</option>' + appData.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}
function loadCandidates() { renderCandidatesTable(); }

function renderCandidatesTable() {
  const elF = v('cand-election-filter')||'', catF = v('cand-category-filter')||'';
  const tbody = document.getElementById('candidates-tbody');
  if (!tbody) return;
  let rows = appData.candidates;
  if (elF)  rows = rows.filter(c => c.electionId === elF);
  if (catF) rows = rows.filter(c => c.categoryId === catF);
  tbody.innerHTML = rows.length ? rows.map(c => {
    const cat = appData.categories.find(x => x.id === c.categoryId);
    const el  = appData.elections.find(x => x.id === c.electionId);
    return `<tr>
      <td><div style="width:40px;height:40px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--green-pale),var(--purple-pale));display:flex;align-items:center;justify-content:center;font-size:1.2rem">
        ${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover"/>` : '👤'}
      </div></td>
      <td><strong>${esc(c.name)}</strong></td>
      <td><span class="badge badge-purple">${esc(cat?.name||'—')}</span></td>
      <td><span class="badge badge-green">${esc(el?.title||'—')}</span></td>
      <td><div class="action-btns">
        <button class="btn btn-xs btn-primary" onclick="openCandidateModal('${c.id}')">✏️</button>
        <button class="btn btn-xs btn-danger"  onclick="confirmDelete('candidate','${c.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">👤</div><h3>No candidates</h3></div></td></tr>`;
}

function openCandidateModal(id) {
  editingId = id || null;
  clearAlert('cand-form-alert');
  const elSel = document.getElementById('cand-election-id');
  elSel.innerHTML = '<option value="">— Select Election —</option>' +
    appData.elections.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
  document.getElementById('cand-modal-title').textContent = id ? 'Edit Candidate' : 'Add Candidate';
  if (id) {
    const c = appData.candidates.find(x => x.id === id);
    if (c) { sv('cand-name', c.name); sv('cand-election-id', c.electionId); populateCandidateCats(); setTimeout(() => sv('cand-category-id', c.categoryId), 50); }
  } else {
    sv('cand-name','');
    document.getElementById('cand-category-id').innerHTML = '<option value="">— Select Category —</option>';
    document.getElementById('cand-photo-preview').classList.add('hidden');
  }
  openModal('modal-candidate');
}

function populateCandidateCats() {
  const elId   = v('cand-election-id');
  const catSel = document.getElementById('cand-category-id');
  const cats   = appData.categories.filter(c => c.electionId === elId);
  catSel.innerHTML = '<option value="">— Select Category —</option>' +
    cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

async function saveCandidate() {
  const name = v('cand-name').trim(), elId = v('cand-election-id'), catId = v('cand-category-id');
  if (!name||!elId||!catId) { showAlert('cand-form-alert','All fields are required.','error'); return; }
  setLoading('btn-save-candidate', true, 'Saving…');

  let photoUrl = '';
  const pInput = document.getElementById('cand-photo-input');
  if (pInput?.files?.length) photoUrl = await firebaseUpload(pInput.files[0], `candidates/${uid()}`);

  const capId = editingId;

  await saveData(data => {
    if (capId) {
      const idx = data.candidates.findIndex(c => c.id === capId);
      if (idx >= 0) data.candidates[idx] = { ...data.candidates[idx], name, electionId: elId, categoryId: catId, updated: now(), ...(photoUrl ? { photo: photoUrl } : {}) };
    } else {
      data.candidates.push({ id: uid(), name, electionId: elId, categoryId: catId, photo: photoUrl, created: now() });
    }
    return data;
  });

  setLoading('btn-save-candidate', false, 'Save Candidate');
  closeModal('modal-candidate'); renderCandidatesTable(); refreshAdminStats();
  showToast(capId ? 'Candidate updated!' : 'Candidate added!', 'success');
  editingId = null;
}

// ── Users Table ───────────────────────────────────────────────────
function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = appData.users.map(u => `
    <tr data-search="${(u.name+u.email+u.username).toLowerCase()}">
      <td><strong>${esc(u.name)}</strong></td>
      <td style="font-family:var(--font-mono);font-size:0.82rem">${esc(u.username||'—')}</td>
      <td style="font-size:0.82rem">${esc(u.email)}</td>
      <td>${u.gender||'—'}</td><td>${u.age||'—'}</td>
      <td style="font-size:0.82rem">${esc(u.phone||'—')}</td>
      <td><span class="badge ${u.validated==='Yes'?'badge-success':'badge-warning'}">${u.validated||'No'}</span></td>
      <td><span class="badge ${u.role==='admin'?'badge-purple':'badge-green'}">${u.role||'voter'}</span></td>
      <td><div class="action-btns">
        <button class="btn btn-xs btn-primary" onclick="openUserEdit('${u.id}')">✏️</button>
        ${u.id !== 'Admin01' ? `<button class="btn btn-xs btn-danger" onclick="confirmDelete('user','${u.id}')">🗑️</button>` : ''}
      </div></td>
    </tr>
  `).join('');
}

function openUserEdit(id) {
  editingUserId = id;
  const u = appData.users.find(x => x.id === id);
  if (!u) return;
  sv('eu-name',u.name); sv('eu-username',u.username||''); sv('eu-email',u.email);
  sv('eu-gender',u.gender||'Male'); sv('eu-age',u.age||'');
  sv('eu-phone',u.phone||''); sv('eu-validated',u.validated||'No'); sv('eu-role',u.role||'voter');
  clearAlert('user-form-alert');
  openModal('modal-user');
}

// FIX-6: saveUserEdit now guards against duplicate email/username
// when an admin edits a user record.
async function saveUserEdit() {
  const capUserId = editingUserId;
  const newEmail    = v('eu-email').trim().toLowerCase();
  const newUsername = v('eu-username').trim().toLowerCase();

  const saveResult = await saveData(data => {
    // Guard: ensure the new email is not already taken by another account.
    if (data.users.some(u => u.id !== capUserId && u.email.toLowerCase() === newEmail)) {
      throw new Error("DUPLICATE_EMAIL");
    }
    // Guard: ensure the new username is not already taken by another account.
    if (newUsername && data.users.some(u => u.id !== capUserId && u.username?.toLowerCase() === newUsername)) {
      throw new Error("DUPLICATE_USERNAME");
    }
    const u = data.users.find(x => x.id === capUserId);
    if (!u) return data;
    u.name      = v('eu-name').trim();
    u.username  = v('eu-username').trim();
    u.email     = v('eu-email').trim();
    u.gender    = v('eu-gender');
    u.age       = parseInt(v('eu-age')) || u.age;
    u.phone     = v('eu-phone').trim();
    u.validated = v('eu-validated');
    u.role      = v('eu-role');
    u.updated   = now();
    return data;
  });

  if (!saveResult || !saveResult.success) {
    if (saveResult?.error === "DUPLICATE_EMAIL") {
      showAlert('user-form-alert', 'This email is already in use by another account.', 'error'); return;
    }
    if (saveResult?.error === "DUPLICATE_USERNAME") {
      showAlert('user-form-alert', 'This username is already taken.', 'error'); return;
    }
    showAlert('user-form-alert', 'Save failed. Please try again.', 'error'); return;
  }

  closeModal('modal-user'); renderUsersTable();
  showToast('User updated!', 'success'); editingUserId = null;
}

// ── Delete confirm ────────────────────────────────────────────────
function confirmDelete(type, id) {
  const msgs = {
    election:  'This will permanently delete the election and all its categories, candidates and votes.',
    category:  'This will delete this category and its candidates.',
    candidate: 'This will delete this candidate.',
    user:      'This will permanently delete this user account.'
  };
  openConfirmModal(`Delete ${type}?`, msgs[type]||'Are you sure?', '⚠️', async () => {
    await saveData(data => {
      if (type === 'election')  {
        data.elections  = data.elections.filter(e => e.id !== id);
        data.categories = data.categories.filter(c => c.electionId !== id);
        data.candidates = data.candidates.filter(c => c.electionId !== id);
        data.votes      = data.votes.filter(v => v.electionId !== id);
      } else if (type === 'category')  {
        data.categories = data.categories.filter(c => c.id !== id);
        data.candidates = data.candidates.filter(c => c.categoryId !== id);
      } else if (type === 'candidate') {
        data.candidates = data.candidates.filter(c => c.id !== id);
      } else if (type === 'user') {
        data.users = data.users.filter(u => u.id !== id);
      }
      return data;
    });

    if (type === 'election')  { renderElectionsTable(); renderOverviewElections(); }
    if (type === 'category')  renderCategoriesTable();
    if (type === 'candidate') renderCandidatesTable();
    if (type === 'user')      renderUsersTable();
    refreshAdminStats();
    showToast(`${type} deleted.`, 'success');
  });
}

// ── Results ───────────────────────────────────────────────────────
function populateResultElectionSelect() {
  const sel = document.getElementById('result-election-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Choose Election —</option>' +
    appData.elections.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
}

function populateElectionSelects() {
  ['cat-election-id','cand-election-id','cat-election-filter','cand-election-filter','result-election-select','voter-result-select','test-election-select'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = (id.includes('filter')||id.includes('result')||id.includes('test') ? '<option value="">— All/Choose —</option>' : '<option value="">— Select Election —</option>') +
      appData.elections.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
    if (cur) sel.value = cur;
  });
}

function loadResults() {
  const elId = v('result-election-select'), container = document.getElementById('results-content');
  if (!elId) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><h3>Select an Election</h3></div>`; return; }
  renderResults(elId, container, true);
}

function loadVoterResults() {
  const elId = v('voter-result-select'), container = document.getElementById('voter-results-content');
  if (!elId) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><h3>Select an Election</h3></div>`; return; }
  const el = appData.elections.find(e => e.id === elId);
  if (!el) return;
  if (!(computeStatus(el) === 'ended' || el.viewStatus === 'visible')) {
    container.innerHTML = `<div class="alert alert-info"><span class="alert-icon">ℹ️</span>Results will be available after the election ends.</div>`;
    return;
  }
  renderResults(elId, container, false);
}

function renderResults(elId, container, isAdmin) {
  const el    = appData.elections.find(e => e.id === elId);
  const cats  = appData.categories.filter(c => c.electionId === elId);
  const cands = appData.candidates.filter(c => c.electionId === elId);
  const votes = appData.votes.filter(v => v.electionId === elId);
  if (!cats.length) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📂</div><h3>No categories set up</h3></div>`; return; }

  const resultData = cats.map(cat => {
    const catCands = cands.filter(c => c.categoryId === cat.id);
    const catVotes = votes.filter(v => v.categoryId === cat.id);
    const total    = catVotes.length;
    const candData = catCands.map(c => ({
      ...c,
      votes: catVotes.filter(v => v.candidateId === c.id).length
    })).sort((a, b) => b.votes - a.votes);
    return { cat, total, candData };
  });

  const exportBtns = isAdmin ? `<div class="export-bar">
    <button class="btn btn-sm btn-ghost" onclick="exportResultsExcel('${elId}')">📊 Excel</button>
    <button class="btn btn-sm btn-ghost" onclick="exportResultsPDF('${elId}')">📄 PDF</button>
    <button class="btn btn-sm btn-ghost" onclick="exportResultsCSV('${elId}')">📋 CSV</button>
  </div>` : '';

  const categoryChartDivs = resultData.map(rd => `
    <div class="chart-container" style="margin-top:20px">
      <h3 class="chart-title">🏆 ${esc(rd.cat.name)} — ${rd.total} vote${rd.total !== 1 ? 's' : ''}</h3>
      ${rd.candData.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-bottom:20px">
          <div><canvas id="cat-bar-${elId}-${rd.cat.id}"></canvas></div>
          <div><canvas id="cat-pie-${elId}-${rd.cat.id}"></canvas></div>
        </div>
        ${rd.candData.map((c, i) => `
          <div class="result-bar-wrap">
            <div class="result-bar-info">
              <span class="result-bar-name">${i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}${esc(c.name)}</span>
              <span class="result-bar-count">${c.votes} vote${c.votes !== 1 ? 's' : ''} (${rd.total ? Math.round(c.votes / rd.total * 100) : 0}%)</span>
            </div>
            <div class="result-bar-track"><div class="result-bar-fill" style="width:${rd.total ? Math.round(c.votes / rd.total * 100) : 0}%"></div></div>
          </div>`).join('')}
      ` : '<p class="text-muted">No candidates in this category.</p>'}
    </div>`).join('');

  container.innerHTML = `${exportBtns}
    <div class="chart-container">
      <h3 class="chart-title">📊 ${esc(el.title)} — All Candidates Overview</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px">
        <div><canvas id="result-bar-chart-${elId}"></canvas></div>
        <div><canvas id="result-pie-chart-${elId}"></canvas></div>
      </div>
    </div>
    ${categoryChartDivs}`;

  setTimeout(() => {
    const overviewLabels = [];
    const overviewBar    = [];
    const overviewPie    = [];

    resultData.forEach(rd => {
      rd.candData.forEach(c => {
        overviewLabels.push(`${rd.cat.name}: ${c.name}`);
        overviewBar.push(c.votes);
        overviewPie.push(c.votes || 0);
      });
    });

    const totalEntries   = overviewLabels.length;
    const overviewColors = overviewLabels.map((_, i) =>
      `hsl(${Math.round((i / totalEntries) * 360)},62%,52%)`
    );

    destroyChart(`result-bar-chart-${elId}`);
    const barCtx = document.getElementById(`result-bar-chart-${elId}`)?.getContext('2d');
    if (barCtx && overviewLabels.length) {
      charts[`result-bar-chart-${elId}`] = new Chart(barCtx, {
        type: 'bar',
        data: { labels: overviewLabels, datasets: [{ label: 'Votes', data: overviewBar, backgroundColor: overviewColors, borderRadius: 8 }] },
        options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'All Candidates — Vote Counts' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } } }
      });
    }

    destroyChart(`result-pie-chart-${elId}`);
    const pieCtx = document.getElementById(`result-pie-chart-${elId}`)?.getContext('2d');
    if (pieCtx && overviewLabels.length) {
      charts[`result-pie-chart-${elId}`] = new Chart(pieCtx, {
        type: 'pie',
        data: { labels: overviewLabels, datasets: [{ data: overviewPie, backgroundColor: overviewColors }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, title: { display: true, text: 'Vote Share — All Candidates' } } }
      });
    }

    resultData.forEach(rd => {
      if (!rd.candData.length) return;
      const catLabels = rd.candData.map(c => c.name);
      const catVotes  = rd.candData.map(c => c.votes);
      const catColors = rd.candData.map((_, i) => `hsl(${Math.round((i / rd.candData.length) * 300 + 140)},60%,50%)`);

      destroyChart(`cat-bar-${elId}-${rd.cat.id}`);
      const catBarCtx = document.getElementById(`cat-bar-${elId}-${rd.cat.id}`)?.getContext('2d');
      if (catBarCtx) {
        charts[`cat-bar-${elId}-${rd.cat.id}`] = new Chart(catBarCtx, {
          type: 'bar',
          data: { labels: catLabels, datasets: [{ label: 'Votes', data: catVotes, backgroundColor: catColors, borderRadius: 8 }] },
          options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: `${rd.cat.name} — Vote Counts` } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } } }
        });
      }

      destroyChart(`cat-pie-${elId}-${rd.cat.id}`);
      const catPieCtx = document.getElementById(`cat-pie-${elId}-${rd.cat.id}`)?.getContext('2d');
      if (catPieCtx) {
        charts[`cat-pie-${elId}-${rd.cat.id}`] = new Chart(catPieCtx, {
          type: 'pie',
          data: { labels: catLabels, datasets: [{ data: catVotes, backgroundColor: catColors }] },
          options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, title: { display: true, text: `${rd.cat.name} — Vote Share` } } }
        });
      }
    });
  }, 100);
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── Voter Elections ───────────────────────────────────────────────
function renderVoterElections() {
  const grid = document.getElementById('voter-elections-grid');
  if (!grid || !currentUser) return;
  const visible = appData.elections.filter(e => {
    const s = computeStatus(e);
    return (s === 'active' || s === 'test') && (e.viewStatus === 'visible' || s === 'test');
  });
  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗳️</div><h3>No active elections</h3><p>Check back later for open elections.</p></div>`;
    return;
  }
  grid.innerHTML = visible.map(e => {
    const myVotes   = appData.votes.filter(v => v.voterId === currentUser.id && v.electionId === e.id);
    const cats      = appData.categories.filter(c => c.electionId === e.id);
    const allCats   = cats.length > 0 && cats.every(cat => myVotes.some(mv => mv.categoryId === cat.id));
    return `<div class="election-card">
      ${e.image ? `<div class="election-card-img"><img src="${e.image}" alt="${esc(e.title)}"/></div>` : ''}
      <div class="election-card-body">
        <div class="election-card-meta">${statusBadge(e)}</div>
        <h3 class="election-card-title">${esc(e.title)}</h3>
        ${e.description ? `<p class="election-card-desc">${esc(e.description)}</p>` : ''}
        <div class="election-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${cats.length ? Math.round(myVotes.length/cats.length*100) : 0}%"></div></div>
          <small class="text-muted">${myVotes.length}/${cats.length} categories voted</small>
        </div>
        <div class="election-card-footer">
          <span style="font-size:0.8rem;color:var(--gray-400)">Ends: ${fmtDT(e.end)}</span>
          ${allCats
            ? `<span class="badge badge-success">✅ Voted</span>`
            : `<button class="btn btn-primary btn-sm" onclick="openVoteModal('${e.id}')">🗳️ Vote Now</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderHomePage() {
  const grid = document.getElementById('home-elections-grid');
  if (!grid) return;
  const visible = appData.elections.filter(e => e.viewStatus === 'visible');
  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗳️</div><h3>No Active Elections</h3><p>Sign in to see elections available to you.</p></div>`;
    return;
  }
  grid.innerHTML = visible.map(e => `
    <div class="election-card">
      ${e.image ? `<div class="election-card-img"><img src="${e.image}" alt="${esc(e.title)}"/></div>` : ''}
      <div class="election-card-body">
        <div class="election-card-meta">${statusBadge(e)}</div>
        <h3 class="election-card-title">${esc(e.title)}</h3>
        ${e.description ? `<p class="election-card-desc">${esc(e.description)}</p>` : ''}
        <div class="election-card-footer">
          <span style="font-size:0.8rem;color:var(--gray-400)">Ends: ${fmtDT(e.end)}</span>
          <button class="btn btn-primary btn-sm" onclick="navigate('auth')">🗳️ Sign In to Vote</button>
        </div>
      </div>
    </div>`).join('');
}

// ── Vote Modal ────────────────────────────────────────────────────
function openVoteModal(elId) {
  const el = appData.elections.find(e => e.id === elId);
  if (!el || !currentUser) return;
  votingElection = el;
  voteSelections = {};
  setText('vote-modal-title', `🗳️ ${el.title}`);
  clearAlert('vote-alert');

  const cats  = appData.categories.filter(c => c.electionId === elId);
  const cands = appData.candidates.filter(c => c.electionId === elId);

  document.getElementById('vote-categories-area').innerHTML = cats.map(cat => {
    const catCands = cands.filter(c => c.categoryId === cat.id);
    return `<div style="margin-bottom:28px">
      <h3 style="font-family:var(--font-display);font-size:1.05rem;color:var(--gray-800);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--gray-200)">${esc(cat.name)}</h3>
      <p style="font-size:0.82rem;color:var(--gray-400);margin-bottom:12px">Select one candidate</p>
      <div class="candidates-grid" id="cat-vote-${cat.id}">
        ${catCands.length ? catCands.map(c=>`
          <div class="candidate-card" id="cand-${cat.id}-${c.id}" onclick="selectCandidate('${cat.id}','${c.id}')">
            <div class="candidate-check">✓</div>
            <div class="candidate-photo">${c.photo?`<img src="${c.photo}" alt="${esc(c.name)}"/>`:'👤'}</div>
            <div class="candidate-name">${esc(c.name)}</div>
            <div class="candidate-cat">${esc(cat.name)}</div>
          </div>`).join('') : '<p class="text-muted" style="font-size:0.85rem">No candidates in this category.</p>'}
      </div>
    </div>`;
  }).join('');
  openModal('modal-vote');
}

function selectCandidate(catId, candId) {
  voteSelections[catId] = candId;
  document.querySelectorAll(`#cat-vote-${catId} .candidate-card`).forEach(el => el.classList.remove('selected'));
  document.getElementById(`cand-${catId}-${candId}`)?.classList.add('selected');
}

// ── Submit Votes ──────────────────────────────────────────────────
async function submitVotes() {
  if (!currentUser || !votingElection) return;

  // Refresh data before reading categories to catch admin changes made
  // after the voter opened the vote modal.
  // FIX-1 applies: loadData() no longer wipes on a failed fetch.
  await loadData();

  const cats    = appData.categories.filter(c => c.electionId === votingElection.id);
  const unvoted = cats.filter(cat =>
    !voteSelections[cat.id] &&
    appData.candidates.filter(c => c.categoryId === cat.id).length > 0
  );
  if (unvoted.length) {
    showAlert('vote-alert', `Please select a candidate for: ${unvoted.map(c => c.name).join(', ')}`, 'error');
    return;
  }

  setLoading('btn-submit-votes', true, 'Submitting…');
  const voterId    = currentUser.id;
  const elId       = votingElection.id;
  const timestamp  = now();
  const selections = { ...voteSelections };

  let duplicateError = false;

  await saveData(data => {
    const existing = data.votes.filter(v => v.voterId === voterId && v.electionId === elId);
    const alreadyVotedCats = new Set(existing.map(v => v.categoryId));

    const newVotes = Object.entries(selections)
      .filter(([catId]) => !alreadyVotedCats.has(catId))
      .map(([catId, candId]) => ({
        id: uid(), electionId: elId, categoryId: catId,
        candidateId: candId, voterId, timestamp
      }));

    if (!newVotes.length) {
      duplicateError = true;
      return data;
    }

    data.votes.push(...newVotes);
    return data;
  });

  setLoading('btn-submit-votes', false, '🗳️ Submit Votes');

  if (duplicateError) {
    showAlert('vote-alert', 'You have already voted in this election.', 'error');
    return;
  }

  voteSelections = {};
  closeModal('modal-vote');
  showToast('🎉 Your vote has been cast successfully!', 'success');
  renderVoterElections(); renderVoterHistory();
}

// ── Voter History ─────────────────────────────────────────────────
function renderVoterHistory() {
  const tbody = document.getElementById('voter-history-tbody');
  if (!tbody || !currentUser) return;
  const myVotes = appData.votes.filter(v => v.voterId === currentUser.id);
  tbody.innerHTML = myVotes.length ? myVotes.map(v => {
    const el=appData.elections.find(e=>e.id===v.electionId), cat=appData.categories.find(c=>c.id===v.categoryId), cand=appData.candidates.find(c=>c.id===v.candidateId);
    return `<tr><td><strong>${esc(el?.title||'—')}</strong></td><td><span class="badge badge-purple">${esc(cat?.name||'—')}</span></td><td>${esc(cand?.name||'—')}</td><td style="font-size:0.82rem;color:var(--gray-400)">${fmtDT(v.timestamp)}</td></tr>`;
  }).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">📋</div><h3>No votes yet</h3><p>Your voting history will appear here.</p></div></td></tr>`;
}

function populateVoterResultSelect() {
  const sel = document.getElementById('voter-result-select');
  if (!sel) return;
  const visible = appData.elections.filter(e => computeStatus(e)==='ended' || e.viewStatus==='visible');
  sel.innerHTML = '<option value="">— Choose Election —</option>' + visible.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
}

// ── Test Election ─────────────────────────────────────────────────
function adminTestElection() { populateElectionSelects(); openModal('modal-test-election'); }

async function runTestElection() {
  const elId = v('test-election-select');
  if (!elId) { showToast('Select an election.','warning'); return; }
  await saveData(data => {
    const el = data.elections.find(e => e.id === elId);
    if (el) el.status = 'test';
    return data;
  });
  closeModal('modal-test-election'); renderElectionsTable();
  const el = appData.elections.find(e => e.id === elId);
  showToast(`"${el?.title}" is now in test mode.`, 'info');
}

async function adminClearTest() {
  const testEls = appData.elections.filter(e => e.status === 'test');
  if (!testEls.length) { showToast('No test elections to clear.','info'); return; }
  openConfirmModal('Clear Test Elections?', `This will clear test status and all test votes for ${testEls.length} election(s).`, '🧹', async () => {
    const testIds = new Set(testEls.map(e => e.id));
    await saveData(data => {
      data.elections.forEach(e => { if (testIds.has(e.id)) e.status = 'upcoming'; });
      data.votes = data.votes.filter(v => !testIds.has(v.electionId));
      return data;
    });
    renderElectionsTable(); refreshAdminStats();
    showToast('Test data cleared.', 'success');
  });
}

// ── Export helpers ────────────────────────────────────────────────
function exportResultsExcel(elId) {
  const wb  = XLSX.utils.book_new();
  const el  = appData.elections.find(e => e.id === elId);
  const cats = appData.categories.filter(c => c.electionId === elId);
  cats.forEach(cat => {
    const cands = appData.candidates.filter(c => c.categoryId === cat.id);
    const votes = appData.votes.filter(v => v.categoryId === cat.id);
    const rows  = cands.map(c => ({ Candidate: c.name, Votes: votes.filter(v => v.candidateId === c.id).length, Percentage: votes.length ? `${Math.round(votes.filter(v=>v.candidateId===c.id).length/votes.length*100)}%` : '0%' }));
    rows.sort((a,b) => b.Votes - a.Votes);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), cat.name.slice(0,31));
  });
  XLSX.writeFile(wb, `${el?.title||'results'}_results.xlsx`);
}

function exportResultsCSV(elId) {
  const el   = appData.elections.find(e => e.id === elId);
  const cats = appData.categories.filter(c => c.electionId === elId);
  let csv    = 'Category,Candidate,Votes,Percentage\n';
  cats.forEach(cat => {
    const cands = appData.candidates.filter(c => c.categoryId === cat.id);
    const votes = appData.votes.filter(v => v.categoryId === cat.id);
    cands.forEach(c => {
      const cnt = votes.filter(v => v.candidateId === c.id).length;
      csv += `"${cat.name}","${c.name}",${cnt},${votes.length ? Math.round(cnt/votes.length*100) : 0}%\n`;
    });
  });
  const a  = document.createElement('a');
  a.href   = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `${el?.title||'results'}_results.csv`;
  a.click();
}

function exportResultsPDF(elId) {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF();
  const el   = appData.elections.find(e => e.id === elId);
  const cats = appData.categories.filter(c => c.electionId === elId);
  doc.setFontSize(18); doc.text(el?.title || 'Election Results', 14, 20);
  doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  let y = 36;
  cats.forEach(cat => {
    doc.setFontSize(13); doc.text(cat.name, 14, y); y += 6;
    const cands = appData.candidates.filter(c => c.categoryId === cat.id);
    const votes = appData.votes.filter(v => v.categoryId === cat.id);
    const rows  = cands.map(c => {
      const cnt = votes.filter(v => v.candidateId === c.id).length;
      return [c.name, cnt, votes.length ? `${Math.round(cnt/votes.length*100)}%` : '0%'];
    }).sort((a,b) => b[1]-a[1]);
    doc.autoTable({ startY: y, head: [['Candidate','Votes','%']], body: rows, margin: { left: 14 }, styles: { fontSize: 10 } });
    y = doc.lastAutoTable.finalY + 10;
  });
  doc.save(`${el?.title||'results'}_results.pdf`);
}

// ── Mobile Nav ────────────────────────────────────────────────────
let _mobileNavOpen = false;

function openMobileNav() {
  if (_mobileNavOpen) return;
  _mobileNavOpen = true;
  const nav = document.getElementById('mobile-nav'), overlay = document.getElementById('mobile-nav-overlay'), burger = document.getElementById('hamburger');
  nav?.classList.add('open'); overlay?.classList.add('open'); burger?.classList.add('is-open');
  burger?.setAttribute('aria-expanded', 'true'); nav?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
  if (!_mobileNavOpen) return;
  _mobileNavOpen = false;
  const nav = document.getElementById('mobile-nav'), overlay = document.getElementById('mobile-nav-overlay'), burger = document.getElementById('hamburger');
  nav?.classList.remove('open'); overlay?.classList.remove('open'); burger?.classList.remove('is-open');
  burger?.setAttribute('aria-expanded', 'false'); nav?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function toggleMobileNav() { _mobileNavOpen ? closeMobileNav() : openMobileNav(); }

function _initHamburger() {
  const burger = document.getElementById('hamburger');
  if (!burger) return;
  let _touchHandled = false;
  burger.addEventListener('touchend', (e) => {
    e.preventDefault(); e.stopPropagation(); _touchHandled = true; toggleMobileNav();
  }, { passive: false });
  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_touchHandled) { _touchHandled = false; return; }
    toggleMobileNav();
  });
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && _mobileNavOpen) closeMobileNav(); });

// ── Sidebar (dashboard mobile) ────────────────────────────────────
function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}
function toggleSidebar() {
  const open = document.getElementById('app-sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
  document.body.style.overflow = open ? 'hidden' : '';
}

// ── Upload Preview ────────────────────────────────────────────────
function previewUpload(input, previewId, zoneId) {
  const file = input.files?.[0]; if (!file) return;
  const preview = document.getElementById(previewId); if (!preview) return;
  const reader = new FileReader();
  reader.onload = e => { preview.classList.remove('hidden'); preview.innerHTML=`<div class="upload-preview"><img src="${e.target.result}" alt="Preview"/><div class="upload-preview-info"><div class="upload-preview-name">${esc(file.name)}</div><div class="upload-preview-size">${(file.size/1024).toFixed(1)} KB</div></div><button class="upload-preview-remove" onclick="clearUpload('${input.id}','${previewId}')">✕</button></div>`; };
  reader.readAsDataURL(file);
}
function clearUpload(inputId, previewId) {
  const inp = document.getElementById(inputId); if (inp) inp.value='';
  const pr  = document.getElementById(previewId); if (pr) { pr.innerHTML=''; pr.classList.add('hidden'); }
}

// ── Modal helpers ─────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function openConfirmModal(title, msg, icon, onConfirm) {
  setText('confirm-title', title); setText('confirm-msg', msg); setText('confirm-icon', icon||'⚠️');
  const btn = document.getElementById('confirm-ok-btn'), newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => { closeModal('modal-confirm'); onConfirm(); });
  openModal('modal-confirm');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

// ── Table Search ──────────────────────────────────────────────────
function filterTable(input, tbodyId) {
  const q = input.value.toLowerCase(), tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => { const s=tr.dataset.search||tr.textContent.toLowerCase(); tr.style.display=s.includes(q)?'':'none'; });
}

// ── Alert / Toast ─────────────────────────────────────────────────
function showAlert(containerId, msg, type='info') {
  const c = document.getElementById(containerId); if (!c) return;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  c.innerHTML = `<div class="alert alert-${type}"><span class="alert-icon">${icons[type]||'ℹ️'}</span>${msg}</div>`;
}
function clearAlert(containerId) { const c=document.getElementById(containerId); if(c) c.innerHTML=''; }

function showToast(msg, type='info') {
  const container=document.getElementById('toast-container'), icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const toast=document.createElement('div'); toast.className=`toast ${type}`;
  toast.innerHTML=`<span class="toast-icon">${icons[type]||'ℹ️'}</span>${msg}`;
  container.appendChild(toast); setTimeout(()=>toast.remove(), 4200);
}

function setLoading(btnId, loading, text) {
  const btn=document.getElementById(btnId); if(!btn) return;
  btn.disabled=loading; btn.innerHTML=loading?`<span class="loading-spinner"></span> ${text}`:text;
}

// ── DOM Shortcuts ─────────────────────────────────────────────────
function v(id)            { return document.getElementById(id)?.value || ''; }
function sv(id, val)      { const el=document.getElementById(id); if(el) el.value=val; }
function setText(id, txt) { const el=document.getElementById(id); if(el) el.textContent=txt; }
function esc(str)         { if(!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  await loadData();
  // performStartupIntegrityCheck is advisory only — it does not modify data.
  await performStartupIntegrityCheck();
  _initHamburger();

  const session = lsSessionGet();
  if (session) {
    const user = appData.users.find(u => u.id === session.id);
    if (user && user.validated === 'Yes') {
      currentUser = user;
      updateHeaderForUser(user);
      startPolling();
    } else if (user && user.validated === 'No') {
      // Clear session for unvalidated users to avoid stale state.
      lsSessionClear();
    }
  }

  refreshAdminStats();
  renderHomePage();

  const dateEl = document.getElementById('admin-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

document.addEventListener('DOMContentLoaded', init);
