/* ═══════════════════════════════════════════════════════════════
   SmartVotes Network — Main Application Script
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

// Only attempt JSONBin calls when BIN ID + at least one valid key exist
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
const uid        = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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

// ── JSONBin API ───────────────────────────────────────────────────
// Build the correct auth header depending on which key is configured.
function jbinAuthHeaders(withContentType) {
  const h = {};
  if (JBIN_MASTER_KEY) {
    h['X-Master-Key'] = JBIN_MASTER_KEY;   // preferred — full access
  } else if (JBIN_ACCESS_KEY) {
    h['X-Access-Key'] = JBIN_ACCESS_KEY;   // fallback — scoped key
  }
  if (withContentType) h['Content-Type'] = 'application/json';
  return h;
}

async function jbinGet() {
  if (!JBIN_READY) {
    console.info("SmartVotes: JSONBin not configured — running on localStorage only.");
    return null;
  }
  try {
    const r = await fetch(`${JBIN_URL}/b/${JBIN_BIN}/latest`, {
      headers: jbinAuthHeaders(false)
    });
    if (!r.ok) {
      const body = await r.text();
      console.warn(`SmartVotes: JSONBin GET ${r.status} — falling back to localStorage. ${body}`);
      return null;   // graceful fallback, NOT a throw
    }
    const j = await r.json();
    return j.record || null;
  } catch (e) {
    console.warn("SmartVotes: JSONBin GET network error — using localStorage.", e.message);
    return null;
  }
}

async function jbinPut(data) {
  if (!JBIN_READY) return false;
  try {
    const r = await fetch(`${JBIN_URL}/b/${JBIN_BIN}`, {
      method:  'PUT',
      headers: jbinAuthHeaders(true),
      body:    JSON.stringify(data)
    });
    if (!r.ok) {
      const body = await r.text();
      console.warn(`SmartVotes: JSONBin PUT ${r.status}. ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("SmartVotes: JSONBin PUT network error.", e.message);
    return false;
  }
}

// ── Local Storage fallback ────────────────────────────────────────
function lsGet() {
  try { return JSON.parse(localStorage.getItem('svn_data') || 'null'); } catch { return null; }
}
function lsPut(data) {
  try { localStorage.setItem('svn_data', JSON.stringify(data)); return true; } catch { return false; }
}
function lsSession(u)     { localStorage.setItem('svn_session', JSON.stringify(u)); }
function lsSessionGet()   { try { return JSON.parse(localStorage.getItem('svn_session') || 'null'); } catch { return null; } }
function lsSessionClear() { localStorage.removeItem('svn_session'); }

// ── Data Load / Save ──────────────────────────────────────────────
async function loadData() {
  let data = null;

  // Step 1 — try JSONBin (only if configured; failure is silent)
  if (JBIN_READY) data = await jbinGet();

  // Step 2 — fall back to localStorage
  if (!data) data = lsGet();

  // Step 3 — brand-new install: seed defaults and save everywhere
  if (!data) {
    data = buildDefaultData();
    lsPut(data);
    if (JBIN_READY) jbinPut(data); // fire-and-forget
  }

  appData = { users: [], elections: [], categories: [], candidates: [], votes: [], ...data };
  ensureAdmin();
  return appData;
}

async function saveData(d) {
  d = d || appData;
  lsPut(d);                      // save locally first — always fast
  if (JBIN_READY) jbinPut(d);   // sync to cloud — fire-and-forget
}

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
    saveData();
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

async function doValidateCode() {
  if (!pendingValidationUser) return;
  const entered = [0,1,2,3,4].map(i => document.getElementById(`vc${i}`)?.value || '').join('');
  if (entered.length < 5) { showAlert('validate-alert', 'Please enter all 5 digits.', 'error'); return; }

  if (entered === pendingValidationUser.validation_code) {
    pendingValidationUser.validated       = 'Yes';
    pendingValidationUser.validation_code = '';
    await saveData();
    showAlert('validate-alert', 'Email verified! Logging you in…', 'success');
    await sleep(1200);
    loginSuccess(pendingValidationUser);
    pendingValidationUser = null;
  } else {
    showAlert('validate-alert', 'Incorrect code. Please try again.', 'error');
  }
}

async function resendValidationCode() {
  if (!pendingValidationUser) return;
  const code = randomCode();
  pendingValidationUser.validation_code = code;
  await saveData();
  await sendValidationEmail(pendingValidationUser.email, pendingValidationUser.name, code);
  showToast('New validation code sent!', 'success');
}

function loginSuccess(user) {
  currentUser = user;
  lsSession(user);
  updateHeaderForUser(user);
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

// Close user dropdown when clicking/tapping outside it.
// FIX: explicitly ignore clicks on the hamburger so this listener never
// fights with the mobile nav toggle handler.
document.addEventListener('click', e => {
  const dd     = document.getElementById('user-dropdown');
  const btn    = document.getElementById('user-menu-btn');
  const burger = document.getElementById('hamburger');
  if (!dd) return;
  if (burger?.contains(e.target)) return;   // let hamburger handle itself
  if (!dd.contains(e.target) && !btn?.contains(e.target)) {
    dd.classList.add('hidden');
  }
});

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

  if (!name||!username||!email||!password||!password2||!gender||!age||!phone) {
    showAlert('register-alert', 'Please fill all required fields.', 'error'); return;
  }
  if (password !== password2) { showAlert('register-alert', 'Passwords do not match.', 'error'); return; }
  if (password.length < 6)    { showAlert('register-alert', 'Password must be at least 6 characters.', 'error'); return; }
  if (age < 18)               { showAlert('register-alert', 'You must be at least 18 years old.', 'error'); return; }
  if (appData.users.find(u => u.email.toLowerCase() === email)) {
    showAlert('register-alert', 'This email is already registered.', 'error'); return;
  }
  if (appData.users.find(u => u.username?.toLowerCase() === username.toLowerCase())) {
    showAlert('register-alert', 'This username is already taken.', 'error'); return;
  }

  setLoading('btn-register', true, 'Creating Account…');
  const code    = randomCode();
  const newUser = {
    id: uid(), name, username, email,
    password: hashStr(password),
    gender, age, phone, address, role: 'voter',
    validated: 'No', validation_code: code, created: now()
  };
  appData.users.push(newUser);
  await saveData();
  await sendValidationEmail(email, name, code);
  setLoading('btn-register', false, 'Create Account →');
  showToast('Account created! Check your email for the verification code.', 'success');
  pendingValidationUser = newUser;
  showValidationCard(email);
}

// ── Logout ────────────────────────────────────────────────────────
function logout() {
  currentUser = null;
  lsSessionClear();
  updateHeaderForUser(null);
  navigate('home');
  showToast('You have been logged out.', 'info');
}

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

  if (editingId) {
    const idx = appData.elections.findIndex(e => e.id === editingId);
    if (idx >= 0) appData.elections[idx] = { ...appData.elections[idx], title, start, end,
      description: v('el-desc'), viewStatus: v('el-view-status'), status: v('el-status'),
      updated: now(), ...(imageUrl ? { image: imageUrl } : {}) };
  } else {
    appData.elections.push({ id: uid(), title, start, end,
      description: v('el-desc'), viewStatus: v('el-view-status'), status: v('el-status'),
      image: imageUrl, created: now() });
  }

  await saveData();
  setLoading('btn-save-election', false, 'Save Election');
  closeModal('modal-election');
  renderElectionsTable(); renderOverviewElections(); refreshAdminStats(); populateElectionSelects();
  showToast(editingId ? 'Election updated!' : 'Election created!', 'success');
  editingId = null;
}

async function toggleViewStatus(id) {
  const e = appData.elections.find(x => x.id === id);
  if (!e) return;
  e.viewStatus = e.viewStatus === 'visible' ? 'hidden' : 'visible';
  await saveData(); renderElectionsTable();
  showToast(`Election is now ${e.viewStatus}.`, 'info');
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
  if (editingId) {
    const idx = appData.categories.findIndex(c => c.id === editingId);
    if (idx >= 0) appData.categories[idx] = { ...appData.categories[idx], electionId: elId, name, description: v('cat-desc'), updated: now() };
  } else {
    appData.categories.push({ id: uid(), electionId: elId, name, description: v('cat-desc'), created: now() });
  }
  await saveData();
  setLoading('btn-save-category', false, 'Save Category');
  closeModal('modal-category'); renderCategoriesTable(); populateCandidateFilters();
  showToast(editingId ? 'Category updated!' : 'Category created!', 'success');
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
  if (editingId) {
    const idx = appData.candidates.findIndex(c => c.id === editingId);
    if (idx >= 0) appData.candidates[idx] = { ...appData.candidates[idx], name, electionId: elId, categoryId: catId, updated: now(), ...(photoUrl ? { photo: photoUrl } : {}) };
  } else {
    appData.candidates.push({ id: uid(), name, electionId: elId, categoryId: catId, photo: photoUrl, created: now() });
  }
  await saveData();
  setLoading('btn-save-candidate', false, 'Save Candidate');
  closeModal('modal-candidate'); renderCandidatesTable(); refreshAdminStats();
  showToast(editingId ? 'Candidate updated!' : 'Candidate added!', 'success');
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

async function saveUserEdit() {
  const u = appData.users.find(x => x.id === editingUserId);
  if (!u) return;
  u.name = v('eu-name').trim(); u.username = v('eu-username').trim(); u.email = v('eu-email').trim();
  u.gender = v('eu-gender'); u.age = parseInt(v('eu-age'))||u.age; u.phone = v('eu-phone').trim();
  u.validated = v('eu-validated'); u.role = v('eu-role'); u.updated = now();
  await saveData(); closeModal('modal-user'); renderUsersTable();
  showToast('User updated!', 'success'); editingUserId = null;
}

// ── Delete confirm ────────────────────────────────────────────────
function confirmDelete(type, id) {
  const msgs = { election:'This will permanently delete the election and all its categories, candidates and votes.', category:'This will delete this category and its candidates.', candidate:'This will delete this candidate.', user:'This will permanently delete this user account.' };
  openConfirmModal(`Delete ${type}?`, msgs[type]||'Are you sure?', '⚠️', async () => {
    if (type==='election')  { appData.elections=appData.elections.filter(e=>e.id!==id); appData.categories=appData.categories.filter(c=>c.electionId!==id); appData.candidates=appData.candidates.filter(c=>c.electionId!==id); appData.votes=appData.votes.filter(v=>v.electionId!==id); renderElectionsTable(); renderOverviewElections(); }
    else if (type==='category')  { appData.categories=appData.categories.filter(c=>c.id!==id); appData.candidates=appData.candidates.filter(c=>c.categoryId!==id); renderCategoriesTable(); }
    else if (type==='candidate') { appData.candidates=appData.candidates.filter(c=>c.id!==id); renderCandidatesTable(); }
    else if (type==='user')      { appData.users=appData.users.filter(u=>u.id!==id); renderUsersTable(); }
    await saveData(); refreshAdminStats();
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

  // ── Build one canvas per category so each category gets its own charts ──
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
    // ── FIX: Overview charts show EVERY candidate across all categories ──
    // Previously only the top candidate per category was pushed, hiding all
    // others. Now we iterate every candidate in every category so all bars
    // and pie slices are rendered with accurate vote counts.
    const overviewLabels = [];
    const overviewBar    = [];
    const overviewPie    = [];

    resultData.forEach(rd => {
      rd.candData.forEach(c => {
        overviewLabels.push(`${rd.cat.name}: ${c.name}`);
        overviewBar.push(c.votes);
        overviewPie.push(c.votes || 0);   // 0 kept so slice still appears
      });
    });

    // Colour palette — spread hues evenly across all candidates
    const totalEntries   = overviewLabels.length;
    const overviewColors = overviewLabels.map((_, i) =>
      `hsl(${Math.round((i / totalEntries) * 360)},62%,52%)`
    );

    // ── Overview bar chart (all candidates) ──
    destroyChart(`result-bar-chart-${elId}`);
    const barCtx = document.getElementById(`result-bar-chart-${elId}`)?.getContext('2d');
    if (barCtx && overviewLabels.length) {
      charts[`result-bar-chart-${elId}`] = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: overviewLabels,
          datasets: [{
            label: 'Votes',
            data:  overviewBar,
            backgroundColor: overviewColors,
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title:  { display: true, text: 'All Candidates — Vote Counts' }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
          }
        }
      });
    }

    // ── Overview pie chart (all candidates) ──
    destroyChart(`result-pie-chart-${elId}`);
    const pieCtx = document.getElementById(`result-pie-chart-${elId}`)?.getContext('2d');
    if (pieCtx && overviewLabels.length) {
      charts[`result-pie-chart-${elId}`] = new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: overviewLabels,
          datasets: [{
            data:            overviewPie,
            backgroundColor: overviewColors
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
            title:  { display: true, text: 'Vote Share — All Candidates' }
          }
        }
      });
    }

    // ── Per-category charts: one bar + one pie per category ──
    resultData.forEach(rd => {
      if (!rd.candData.length) return;

      const catLabels = rd.candData.map(c => c.name);
      const catVotes  = rd.candData.map(c => c.votes);
      const catTotal  = rd.total;
      const catColors = rd.candData.map((_, i) =>
        `hsl(${Math.round((i / rd.candData.length) * 300 + 140)},60%,50%)`
      );

      // Per-category bar
      destroyChart(`cat-bar-${elId}-${rd.cat.id}`);
      const catBarCtx = document.getElementById(`cat-bar-${elId}-${rd.cat.id}`)?.getContext('2d');
      if (catBarCtx) {
        charts[`cat-bar-${elId}-${rd.cat.id}`] = new Chart(catBarCtx, {
          type: 'bar',
          data: {
            labels: catLabels,
            datasets: [{
              label: 'Votes',
              data:  catVotes,
              backgroundColor: catColors,
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title:  { display: true, text: `${rd.cat.name} — Vote Counts` }
            },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
            }
          }
        });
      }

      // Per-category pie
      destroyChart(`cat-pie-${elId}-${rd.cat.id}`);
      const catPieCtx = document.getElementById(`cat-pie-${elId}-${rd.cat.id}`)?.getContext('2d');
      if (catPieCtx) {
        charts[`cat-pie-${elId}-${rd.cat.id}`] = new Chart(catPieCtx, {
          type: 'pie',
          data: {
            labels: catLabels,
            datasets: [{
              data:            catVotes.map(v => v || 0),
              backgroundColor: catColors
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
              title:  { display: true, text: `${rd.cat.name} — Vote Share` },
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const val = ctx.parsed;
                    const pct = catTotal ? Math.round(val / catTotal * 100) : 0;
                    return ` ${ctx.label}: ${val} vote${val !== 1 ? 's' : ''} (${pct}%)`;
                  }
                }
              }
            }
          }
        });
      }
    });
  }, 100);
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

// ── Export ────────────────────────────────────────────────────────
function getResultsRows(elId) {
  const cats=appData.categories.filter(c=>c.electionId===elId), cands=appData.candidates.filter(c=>c.electionId===elId), votes=appData.votes.filter(v=>v.electionId===elId);
  const rows=[['Category','Candidate','Votes','Percentage']];
  cats.forEach(cat=>{ const catCands=cands.filter(c=>c.categoryId===cat.id), total=votes.filter(v=>v.categoryId===cat.id).length; catCands.forEach(c=>{ const count=votes.filter(v=>v.candidateId===c.id).length; rows.push([cat.name,c.name,count,total?`${Math.round(count/total*100)}%`:'0%']); }); });
  return rows;
}
function exportResultsExcel(elId) { const el=appData.elections.find(e=>e.id===elId),rows=getResultsRows(elId),ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Results'); XLSX.writeFile(wb,`${el?.title||'Election'}_Results.xlsx`); showToast('Excel exported!','success'); }
function exportResultsCSV(elId)   { const el=appData.elections.find(e=>e.id===elId),rows=getResultsRows(elId),csv=rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'); downloadFile(`${el?.title||'Election'}_Results.csv`,csv,'text/csv'); showToast('CSV exported!','success'); }
function exportResultsPDF(elId)   { const el=appData.elections.find(e=>e.id===elId),rows=getResultsRows(elId),{jsPDF}=window.jspdf,doc=new jsPDF(); doc.setFontSize(16); doc.text(`${el?.title||'Election'} — Results`,14,18); doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`,14,26); doc.autoTable({head:[rows[0]],body:rows.slice(1),startY:32}); doc.save(`${el?.title||'Election'}_Results.pdf`); showToast('PDF exported!','success'); }
function downloadFile(name,content,type) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }

// ── Voter Elections ───────────────────────────────────────────────
function renderVoterElections() {
  const grid = document.getElementById('voter-elections-grid');
  if (!grid) return;
  const available = appData.elections.filter(e => { const s=computeStatus(e); return s==='active'||s==='test'; });
  if (!available.length) { grid.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🗳️</div><h3>No Active Elections</h3><p>Check back later for elections open for voting.</p></div>`; return; }
  grid.innerHTML = available.map(e => `
    <div class="election-card">
      <div class="election-card-img">${e.image?`<img src="${e.image}" alt="${esc(e.title)}"/>`:'🗳️'} ${statusBadge(e)}</div>
      <div class="election-card-body">
        <h3 class="election-card-title">${esc(e.title)}</h3>
        <p class="election-card-desc">${esc(e.description||'')}</p>
        <div class="election-time">🕐 ${fmtDT(e.start)} → ${fmtDT(e.end)}</div>
      </div>
      <div class="election-card-footer">
        ${hasVoted(e.id)?'<span class="badge badge-success">✅ You voted</span>':`<button class="btn btn-primary btn-sm" onclick="openVoteModal('${e.id}')">🗳️ Vote Now</button>`}
      </div>
    </div>`).join('');
}

function hasVoted(elId) { return appData.votes.some(v => v.electionId===elId && v.voterId===currentUser?.id); }

function renderHomePage() {
  const grid = document.getElementById('home-elections-grid');
  if (!grid) return;
  const active = appData.elections.filter(e => computeStatus(e)==='active' && e.viewStatus==='visible');
  if (!active.length) { grid.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🗳️</div><h3>No Active Elections</h3><p>Sign in to see elections available to you.</p></div>`; return; }
  grid.innerHTML = active.map(e => `
    <div class="election-card">
      <div class="election-card-img">${e.image?`<img src="${e.image}"/>`:'🗳️'} ${statusBadge(e)}</div>
      <div class="election-card-body"><h3 class="election-card-title">${esc(e.title)}</h3><p class="election-card-desc">${esc(e.description||'')}</p><div class="election-time">🕐 ${fmtDT(e.start)} → ${fmtDT(e.end)}</div></div>
      <div class="election-card-footer"><button class="btn btn-primary btn-sm" onclick="navigate('auth')">Sign in to Vote</button></div>
    </div>`).join('');
}

// ── Vote Modal ────────────────────────────────────────────────────
function openVoteModal(elId) {
  const el = appData.elections.find(e => e.id === elId);
  if (!el) return;
  if (hasVoted(elId)) { showToast('You have already voted in this election.','warning'); return; }
  votingElection = el; voteSelections = {};
  const cats=appData.categories.filter(c=>c.electionId===elId), cands=appData.candidates.filter(c=>c.electionId===elId);
  clearAlert('vote-alert');
  document.getElementById('vote-modal-title').textContent = `🗳️ ${el.title}`;
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

async function submitVotes() {
  if (!currentUser || !votingElection) return;
  const cats = appData.categories.filter(c => c.electionId === votingElection.id);
  const unvoted = cats.filter(cat => !voteSelections[cat.id] && appData.candidates.filter(c => c.categoryId === cat.id).length > 0);
  if (unvoted.length) { showAlert('vote-alert', `Please select a candidate for: ${unvoted.map(c=>c.name).join(', ')}`, 'error'); return; }
  setLoading('btn-submit-votes', true, 'Submitting…');
  const timestamp = now();
  Object.entries(voteSelections).forEach(([catId, candId]) => {
    appData.votes.push({ id: uid(), electionId: votingElection.id, categoryId: catId, candidateId: candId, voterId: currentUser.id, timestamp });
  });
  await saveData();
  voteSelections = {};
  setLoading('btn-submit-votes', false, '🗳️ Submit Votes');
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
  const el = appData.elections.find(e => e.id === elId);
  if (!el) return;
  el.status = 'test';
  await saveData(); closeModal('modal-test-election'); renderElectionsTable();
  showToast(`"${el.title}" is now in test mode.`, 'info');
}

async function adminClearTest() {
  const testEls = appData.elections.filter(e => e.status === 'test');
  if (!testEls.length) { showToast('No test elections to clear.','info'); return; }
  openConfirmModal('Clear Test Elections?', `This will clear test status and all test votes for ${testEls.length} election(s).`, '🧹', async () => {
    testEls.forEach(e => { e.status='upcoming'; appData.votes=appData.votes.filter(v=>v.electionId!==e.id); });
    await saveData(); renderElectionsTable(); refreshAdminStats();
    showToast('Test data cleared.', 'success');
  });
}

// ── Mobile Nav ────────────────────────────────────────────────────
// FIX SUMMARY — four problems resolved here:
//
// 1. REPEATED TAPS: The old hamburger used onclick="toggleMobileNav()".
//    On mobile, onclick fires ~300ms after the touchend (tap delay), and
//    the event bubbles to the document-level click listener which was
//    closing things it shouldn't. We now bind via addEventListener using
//    the 'touchend' event (fires instantly, no delay) with a fallback
//    'click' for pointer devices, and call stopPropagation() so the event
//    never reaches parent listeners.
//
// 2. FLICKERING: The CSS #mobile-nav previously had display:none by default
//    and display:flex in the media query. Toggling display forces a full
//    layout + paint pass every open/close cycle, which flickers on mobile
//    GPUs. The new CSS keeps display:flex always and only animates
//    transform:translateX (GPU composited — zero repaint, zero flicker).
//
// 3. NO OUTSIDE-TAP-TO-CLOSE: Added #mobile-nav-overlay backdrop that covers
//    the page content when the drawer is open. Tapping it closes the nav.
//
// 4. BODY SCROLL WHILE NAV OPEN: When the drawer is open, the page behind
//    it could still scroll on iOS, causing a jarring experience. We now
//    lock body overflow while the nav is open and restore it on close.

let _mobileNavOpen = false;

function openMobileNav() {
  if (_mobileNavOpen) return;
  _mobileNavOpen = true;

  const nav      = document.getElementById('mobile-nav');
  const overlay  = document.getElementById('mobile-nav-overlay');
  const burger   = document.getElementById('hamburger');

  nav?.classList.add('open');
  overlay?.classList.add('open');
  burger?.classList.add('is-open');
  burger?.setAttribute('aria-expanded', 'true');
  nav?.setAttribute('aria-hidden', 'false');

  // Prevent the page from scrolling behind the open drawer (critical on iOS)
  document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
  if (!_mobileNavOpen) return;
  _mobileNavOpen = false;

  const nav      = document.getElementById('mobile-nav');
  const overlay  = document.getElementById('mobile-nav-overlay');
  const burger   = document.getElementById('hamburger');

  nav?.classList.remove('open');
  overlay?.classList.remove('open');
  burger?.classList.remove('is-open');
  burger?.setAttribute('aria-expanded', 'false');
  nav?.setAttribute('aria-hidden', 'true');

  document.body.style.overflow = '';
}

function toggleMobileNav() {
  _mobileNavOpen ? closeMobileNav() : openMobileNav();
}

// Bind hamburger with touchend (no 300ms delay) + click fallback.
// We do this in a DOMContentLoaded-safe way so the element exists.
function _initHamburger() {
  const burger = document.getElementById('hamburger');
  if (!burger) return;

  let _touchHandled = false;

  // touchend fires immediately on tap — no 300ms delay
  burger.addEventListener('touchend', (e) => {
    e.preventDefault();        // prevent the ghost click that follows
    e.stopPropagation();
    _touchHandled = true;
    toggleMobileNav();
  }, { passive: false });

  // click handles mouse/trackpad; skip if already handled by touchend
  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_touchHandled) { _touchHandled = false; return; }
    toggleMobileNav();
  });
}

// Close nav when Escape key is pressed
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _mobileNavOpen) closeMobileNav();
});
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
  await loadData();   // always succeeds — falls back to localStorage if JSONBin fails

  // Bind hamburger touch+click (must run after DOM is ready)
  _initHamburger();

  const session = lsSessionGet();
  if (session) {
    const user = appData.users.find(u => u.id === session.id);
    if (user) { currentUser = user; updateHeaderForUser(user); }
  }

  refreshAdminStats();
  renderHomePage();

  const dateEl = document.getElementById('admin-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

document.addEventListener('DOMContentLoaded', init);

