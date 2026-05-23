/* ============================================================
   FAITHWORKS — app.js
   DB: JSONBin.io | Images: Firebase Storage
   Payments: Paystack | Emails: EmailJS
   ============================================================ */

/* ─── CONFIG ─────────────────────────────────────────────── */

/* ─── CATEGORIES ─────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'artisans',      name: 'Artisans',                icon: '🔨' },
  { id: 'skilled',       name: 'Skilled Workers',          icon: '⚙️' },
  { id: 'consultants',   name: 'Consultants',              icon: '💼' },
  { id: 'professionals', name: 'Professionals',            icon: '👔' },
  { id: 'traders',       name: 'Traders / Sellers',        icon: '🛒' },
  { id: 'suppliers',     name: 'Suppliers & Distributors', icon: '📦' },
  { id: 'creatives',     name: 'Creatives',                icon: '🎨' },
  { id: 'domestic',      name: 'Domestic Workers',         icon: '🏠' },
  { id: 'events',        name: 'Event Handlers',           icon: '🎉' },
  { id: 'digital',       name: 'Digital Services',         icon: '💻' },
  { id: 'education',     name: 'Education / Teachers',     icon: '📚' },
  { id: 'healthcare',    name: 'Healthcare Workers',       icon: '🏥' },
  { id: 'others',        name: 'Others',                   icon: '🌟' },
];

/* ─── RUNTIME STATE ──────────────────────────────────────── */
let DB            = null;
let currentUser   = null;
let activeChatId  = null;
let selectedRating = 0;
let ratingContext = null;
let payContext    = null;
let pollInterval  = null;

/* ─── DEFAULT SUPER ADMIN ────────────────────────────────── */
const DEFAULT_SUPERADMIN = {
  userId    : 'Admin01',
  password  : 'Kingfifo@#',
  email     : 'geocorpsys@gmail.com',
  user_group: 0,
  createdAt : new Date().toISOString(),
  active    : true,
};


/* ═══════════════════════════════════════════════════════════
   FIREBASE — Image Storage
   Lazily initialised on first use.
   index.html must load the Firebase compat SDK before app.js.
   ═══════════════════════════════════════════════════════════ */
let _fbApp     = null;
let _fbStorage = null;

function _initFirebase() {
  if (_fbStorage) return true;
  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded. Add the compat scripts to index.html.');
      return false;
    }
    if (!firebase.apps || !firebase.apps.length) {
      _fbApp = firebase.initializeApp({
        apiKey           : CONFIG.FIREBASE_API_KEY,
        authDomain       : CONFIG.FIREBASE_AUTH_DOMAIN,
        projectId        : CONFIG.FIREBASE_PROJECT_ID,
        storageBucket    : CONFIG.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: CONFIG.FIREBASE_MESSAGING_SENDER_ID,
        appId            : CONFIG.FIREBASE_APP_ID,
      });
    } else {
      _fbApp = firebase.app();
    }
    _fbStorage = firebase.storage();
    console.log('✅ Firebase initialised');
    return true;
  } catch (e) {
    console.error('Firebase init error:', e);
    return false;
  }
}

/**
 * Upload a File object to Firebase Storage.
 * @param {File}   file  — browser File object
 * @param {string} path  — storage path, e.g. 'faithworks/jobs/myfile.jpg'
 * @returns {Promise<string>} public download URL
 */
async function uploadImageToFirebase(file, path) {
  if (!_initFirebase()) throw new Error('Firebase not available');
  const ref      = _fbStorage.ref(path || `faithworks/${Date.now()}_${file.name}`);
  const snapshot = await ref.put(file);
  const url      = await snapshot.ref.getDownloadURL();
  console.log('✅ Firebase upload:', url);
  return url;
}

/**
 * Upload up to 4 photos from a <input type="file" multiple> element.
 * Returns a comma-separated string of download URLs.
 */
async function uploadJobPhotos(fileInput) {
  if (!fileInput || !fileInput.files || !fileInput.files.length) return '';
  const urls = [];
  for (const file of Array.from(fileInput.files).slice(0, 4)) {
    try {
      const url = await uploadImageToFirebase(
        file, `faithworks/jobs/${Date.now()}_${file.name}`
      );
      urls.push(url);
    } catch (e) {
      console.error('Upload failed for', file.name, e);
    }
  }
  return urls.join(', ');
}


/* ═══════════════════════════════════════════════════════════
   JSONBIN.IO — DB LAYER
   Correct header structure (from the reference ApiService):
     X-Master-Key  →  CONFIG.JSONBIN_M_API_KEY   (admin access)
     X-Access-Key  →  CONFIG.JSONBIN_API_KEY      (read/write)
     X-Bin-Meta    →  'false'                     (no wrapper)
   ═══════════════════════════════════════════════════════════ */
const _JBBASE = 'https://api.jsonbin.io/v3/b/' + CONFIG.JSONBIN_BIN_ID;

/** Build the correct headers for every JSONBin request */
function _jbHeaders(withBody = false) {
  const h = {
    'X-Master-Key' : CONFIG.JSONBIN_M_API_KEY,  // MUST be the M_API_KEY
    'X-Access-Key' : CONFIG.JSONBIN_API_KEY,     // MUST be the API_KEY
    'X-Bin-Meta'   : 'false',                   // strip metadata wrapper
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma'       : 'no-cache',
    'Expires'      : '0',
  };
  if (withBody) h['Content-Type'] = 'application/json';
  return h;
}

/* --- In-memory read cache (30 s TTL) --- */
const _readCache = { ts: 0, data: null };
const CACHE_TTL  = 30_000;

/* --- Write-lock (prevent concurrent PUTs) --- */
let   _writeLocked = false;
const _writeQueue  = [];

/**
 * Read the DB from JSONBin (or cache).
 * @param {boolean} force  skip cache and fetch fresh from server
 */
async function dbRead(force = false) {
  if (!force && _readCache.data && (Date.now() - _readCache.ts) < CACHE_TTL) {
    DB = _readCache.data;
    return DB;
  }

  try {
    const url = `${_JBBASE}/latest?_t=${Date.now()}`;   // cache-buster
    const res = await fetch(url, {
      method     : 'GET',
      headers    : _jbHeaders(),
      mode       : 'cors',
      credentials: 'omit',
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => res.status);
      throw new Error(`JSONBin GET ${res.status}: ${msg}`);
    }

    const raw = await res.json();
    /*
      With X-Bin-Meta:false the body IS the stored document.
      Guard for both cases in case the header is ever ignored:
        - raw.record exists  →  metadata was included anyway
        - otherwise          →  raw IS the document
    */
    DB = (raw && raw.record !== undefined) ? raw.record : raw;
    ensureSchema();

    _readCache.data = DB;
    _readCache.ts   = Date.now();

    try { localStorage.setItem('fw_db_cache', JSON.stringify(DB)); } catch (_) {}
    console.log(`✅ dbRead OK — ${(DB.users||[]).length} users, ${(DB.jobs||[]).length} jobs`);
    return DB;

  } catch (e) {
    console.error('dbRead failed:', e);
    // Graceful fallback to localStorage backup
    try {
      const local = localStorage.getItem('fw_db_cache');
      if (local) {
        DB = JSON.parse(local);
        ensureSchema();
        console.warn('⚠️ Using localStorage DB fallback');
        return DB;
      }
    } catch (_) {}
    DB = {};
    ensureSchema();
    return DB;
  }
}

/**
 * Write DB back to JSONBin with retry and write-lock.
 * @param {number} retries
 */
async function dbWrite(retries = 4) {
  // Queue if a write is already in flight
  if (_writeLocked) {
    return new Promise((resolve, reject) => {
      _writeQueue.push({ resolve, reject });
    });
  }
  _writeLocked = true;

  try {
    for (let i = 0; i < retries; i++) {
      try {
        DB._version     = (DB._version || 0) + 1;
        DB._lastUpdated = new Date().toISOString();

        const res = await fetch(_JBBASE, {
          method     : 'PUT',
          headers    : _jbHeaders(true),
          mode       : 'cors',
          credentials: 'omit',
          body       : JSON.stringify(DB),
        });

        if (!res.ok) {
          const msg = await res.text().catch(() => res.status);
          throw new Error(`JSONBin PUT ${res.status}: ${msg}`);
        }

        _readCache.data = DB;
        _readCache.ts   = Date.now();
        try { localStorage.setItem('fw_db_cache', JSON.stringify(DB)); } catch (_) {}
        console.log(`✅ dbWrite OK — v${DB._version}`);
        return true;

      } catch (e) {
        if (i < retries - 1) {
          console.warn(`dbWrite attempt ${i + 1} failed — re-reading before retry…`);
          await dbRead(true);            // refresh before retry to avoid stomping
          await sleep(700 * (i + 1));
        } else {
          throw e;
        }
      }
    }
  } finally {
    _writeLocked = false;
    // Drain queued writes one at a time
    if (_writeQueue.length) {
      const next = _writeQueue.shift();
      dbWrite().then(next.resolve).catch(next.reject);
    }
  }
}

/** Atomic read-then-write.  Always force-reads to avoid stale overwrites. */
async function dbTransaction(mutatorFn) {
  await dbRead(true);
  mutatorFn(DB);
  await dbWrite();
}

/** Guarantee required collections exist in DB */
function ensureSchema() {
  if (!DB) DB = {};
  if (!Array.isArray(DB.users))         DB.users         = [{ ...DEFAULT_SUPERADMIN }];
  if (!Array.isArray(DB.jobs))          DB.jobs          = [];
  if (!Array.isArray(DB.chats))         DB.chats         = [];
  if (!Array.isArray(DB.payments))      DB.payments      = [];
  if (!Array.isArray(DB.ratings))       DB.ratings       = [];
  if (!Array.isArray(DB.notifications)) DB.notifications = [];
  if (!DB._version) DB._version = 0;

  // Always ensure the default super-admin record exists
  if (!DB.users.find(u => u.userId === 'Admin01')) {
    DB.users.unshift({ ...DEFAULT_SUPERADMIN });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


/* ═══════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.auth-tabs .tab-btn').forEach((b, i) => {
    b.classList.toggle('active',
      (i === 0 && tab === 'login') || (i === 1 && tab === 'signup'));
  });
  el('loginForm').classList.toggle('hidden', tab !== 'login');
  el('signupForm').classList.toggle('hidden', tab !== 'signup');
}

function toggleSignupFields() {
  const type = parseInt(el('signupType').value);
  el('sellerFields').classList.toggle('hidden', type !== 2);
  el('merchantFields').classList.toggle('hidden', type !== 1);
  el('churchSelectGroup').classList.toggle('hidden', type === 1);
  el('branchGroup').classList.toggle('hidden', type === 1);
  el('churchRequired').style.display = type === 2 ? '' : 'none';
}

async function doLogin() {
  const uid  = el('loginId').value.trim();
  const pass = el('loginPass').value;
  if (!uid || !pass) return setErr('loginError', 'Please fill in all fields.');

  const btn = document.querySelector('#loginForm .btn-primary');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…'; }

  try {
    // Always force a fresh read for authentication
    await dbRead(true);

    const user = DB.users.find(u => u.userId === uid && u.password === pass);
    if (!user)                  return setErr('loginError', 'Invalid credentials.');
    if (user.active === false)  return setErr('loginError', 'Account deactivated. Contact admin.');

    currentUser = user;
    sessionStorage.setItem('fw_user', JSON.stringify(user));

    // DB is already fresh — tell bootApp to skip its own dbRead
    await bootApp(/* dbAlreadyLoaded = */ true);

  } catch (e) {
    console.error('Login error:', e);
    setErr('loginError', 'Connection error — please try again.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '<i class="fas fa-sign-in-alt"></i> Sign In'; }
  }
}

async function doSignup() {
  const type  = parseInt(el('signupType').value);
  const uid   = el('regId').value.trim();
  const pass  = el('regPass').value;
  const email = el('regEmail').value.trim();
  const phone = el('regPhone').value.trim();
  const state = el('regState').value.trim();
  const addr  = el('regAddress').value.trim();

  const passConfirm = el('regPassConfirm').value;
  if (!uid || !pass || !email) return setErr('signupError', 'Please fill required fields.');
  if (pass !== passConfirm) return setErr('signupError', 'Passwords do not match.');
  if (type === 2 && !el('regChurch').value) return setErr('signupError', 'Sellers must select a Church.');

  await dbRead(true);
  if (DB.users.find(u => u.userId === uid)) return setErr('signupError', 'User ID already taken.');

  const newUser = {
    userId: uid, password: pass, email, phone, state, address: addr,
    user_group: type,
    active: type !== 2,          // sellers start inactive
    createdAt: new Date().toISOString(),
    contactCount: 0, subscribed: false, subscriptionExpiry: null, commissionPct: 10,
  };

  if (type === 3 || type === 2) {
    newUser.churchId = el('regChurch').value || '';
    newUser.branch   = el('regBranch').value.trim();
  }
  if (type === 2) {
    // Upload profile picture if selected
    const picFile  = el('regPicture')?.files?.[0];
    const cardFile = el('regIdCard')?.files?.[0];
    if (picFile) {
      try {
        el('signupError').textContent = 'Uploading profile picture…';
        newUser.picture = await uploadImageToFirebase(
          picFile, `faithworks/users/${uid}_picture_${Date.now()}_${picFile.name}`);
      } catch (e) { console.error('Profile picture upload failed:', e); }
    }
    if (cardFile) {
      try {
        el('signupError').textContent = 'Uploading ID card photo…';
        newUser.idCard = await uploadImageToFirebase(
          cardFile, `faithworks/users/${uid}_idcard_${Date.now()}_${cardFile.name}`);
      } catch (e) { console.error('ID card upload failed:', e); }
    }
    el('signupError').textContent = '';
  }
  if (type === 1) {
    newUser.churchName    = el('regChurchName').value.trim();
    newUser.leader        = el('regLeader').value.trim();
    newUser.denomination  = el('regDenom').value.trim();
    newUser.memberSize    = el('regMemberSize').value;
    newUser.accessMode    = el('regAccess').value;
    newUser.commissionPct = 10;
    newUser.active        = false;   // merchants need superadmin approval
  }

  await dbTransaction(db => db.users.push(newUser));

  if (type === 2) {
    setErr('signupError', 'Account created! Awaiting admin approval. Redirecting to sign in…', false);
    setTimeout(() => {
      setErr('signupError', '', false);
      switchTab('login');
      const card = document.querySelector('.auth-card');
      if (card) card.scrollTop = 0;
    }, 2500);
  } else if (type === 1) {
    setErr('signupError', 'Church account created! Awaiting super admin approval. Redirecting to sign in…', false);
    setTimeout(() => {
      setErr('signupError', '', false);
      switchTab('login');
      const card = document.querySelector('.auth-card');
      if (card) card.scrollTop = 0;
    }, 2500);
  } else {
    currentUser = newUser;
    sessionStorage.setItem('fw_user', JSON.stringify(newUser));
    // dbTransaction already refreshed DB — no need to re-read
    await bootApp(true);
  }
}

function doLogout() {
  currentUser   = null;
  activeChatId  = null;
  selectedRating = 0;
  ratingContext = null;
  payContext    = null;
  clearInterval(pollInterval);
  pollInterval  = null;

  sessionStorage.removeItem('fw_user');

  el('appShell').classList.add('hidden');

  ['jobModal', 'ratingModal', 'payModal'].forEach(id => {
    const m = el(id);
    if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
  });

  const sideNav  = el('sideNav');
  const backdrop = el('sideBackdrop');
  if (sideNav)  sideNav.classList.remove('drawer-open');
  if (backdrop) backdrop.classList.add('hidden');

  ['loginId','loginPass','regId','regPass','regPassConfirm','regEmail','regPhone',
   'regState','regAddress','regBranch',
   'regChurchName','regLeader','regDenom','regMemberSize'].forEach(id => {
    const inp = el(id); if (inp) inp.value = '';
  });
  // Reset file inputs separately
  ['regPicture','regIdCard'].forEach(id => {
    const inp = el(id); if (inp) { try { inp.value = ''; } catch(_) {} }
  });

  const signupType = el('signupType'); if (signupType) signupType.value = '3';
  const regAccess  = el('regAccess');  if (regAccess)  regAccess.value  = 'open';

  ['loginError','signupError'].forEach(id => {
    const e = el(id); if (e) { e.textContent = ''; e.style.color = ''; }
  });

  switchTab('login');
  toggleSignupFields();

  const card = document.querySelector('.auth-card');
  if (card) card.scrollTop = 0;

  // Restore auth screen — use .visible so flex layout is preserved
  const authEl = el('authModal');
  authEl.style.display = '';
  authEl.classList.add('visible');
}


/* ═══════════════════════════════════════════════════════════
   BOOT — called once after successful login / session restore
   dbAlreadyLoaded = true  →  DB was just fetched by the caller,
                               skip the redundant second fetch so
                               panel renderers always get live data
                               on first paint.
   ═══════════════════════════════════════════════════════════ */
async function bootApp(dbAlreadyLoaded = false) {
  const g = currentUser.user_group;

  /* 1 — wipe any section that the HTML pre-marks as active */
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });

  /* 2 — swap screens */
  const authEl = el('authModal');
  authEl.classList.remove('visible');
  authEl.style.display = 'none';
  el('appShell').classList.remove('hidden');

  /* 3 — EmailJS */
  try { if (typeof emailjs !== 'undefined') emailjs.init(CONFIG.EMAILJS_PUBLIC_KEY); } catch(_) {}

  /* 4 — nav avatar */
  const displayName = currentUser.churchName || currentUser.userId || 'U';
  el('navAvatar').textContent   = displayName[0].toUpperCase();
  el('navUserName').textContent = displayName;
  const bnavAv = el('bnavAvatar');
  if (bnavAv) bnavAv.textContent = displayName[0].toUpperCase();

  /* 5 — show/hide role-specific nav items */
  document.querySelectorAll('.seller-only').forEach(e =>
    e.classList.toggle('hidden', g !== 2));
  document.querySelectorAll('.admin-only').forEach(e =>
    e.classList.toggle('hidden', g !== 0 && g !== 1));
  document.querySelectorAll('.merchant-only').forEach(e =>
    e.classList.toggle('hidden', g !== 1));
  document.querySelectorAll('.superadmin-only').forEach(e =>
    e.classList.toggle('hidden', g !== 0));

  /* 6 — ensure DB is loaded BEFORE any renderer runs
         If the caller already fetched it, reuse the cache.          */
  if (!dbAlreadyLoaded || !DB || !DB.users) {
    await dbRead(true);
  }
  populateCategoryFilters();
  populateChurchDropdowns();
  startPolling();
  updateBadges();

  /* 7 — determine landing section */
  const landingMap = { 0: 'superPanel', 1: 'merchantPanel', 2: 'myJobs', 3: 'home' };
  const landing    = landingMap.hasOwnProperty(g) ? landingMap[g] : 'home';

  /* 8 — activate the section element (visibility only, no loader yet) */
  _showSectionEl(landing);

  /* 9 — call the correct renderer DIRECTLY (DB is guaranteed ready) */
  _renderLanding(landing);

  /* 10 — sync nav active states */
  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.section === landing));
  document.querySelectorAll('.bnav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.section === landing));

  /* 11 — seller subscription prompt */
  if (g === 2) checkSellerSubscription();
}

/** Show a section element without triggering the loader map */
function _showSectionEl(name) {
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active'); s.classList.add('hidden');
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = el('sec-' + name);
  if (sec) { sec.classList.remove('hidden'); sec.classList.add('active'); }

  const navItem = document.querySelector(`.nav-item:not(.hidden)[data-section="${name}"]`);
  if (navItem) navItem.classList.add('active');
}

/**
 * Call the correct rendering function for the landing page.
 * DB is guaranteed to be populated before this runs.
 */
function _renderLanding(landing) {
  switch (landing) {
    case 'home':          _doRenderHome();            break;
    case 'superPanel':    superTab('users');           break;
    case 'merchantPanel': merchantTab('pendingJobs'); break;
    case 'myJobs':        _doRenderMyJobs();           break;
    case 'adminPanel':    adminTab('pendingJobs');     break;
    default:              _doRenderHome();             break;
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    await dbRead(true);
    updateBadges();
  }, 15_000);
}


/* ═══════════════════════════════════════════════════════════
   NAVIGATION — showSection (user-triggered)
   ═══════════════════════════════════════════════════════════ */
function showSection(name) {
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active'); s.classList.add('hidden');
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = el('sec-' + name);
  if (sec) { sec.classList.remove('hidden'); sec.classList.add('active'); }

  const navItem = document.querySelector(`.nav-item:not(.hidden)[data-section="${name}"]`);
  if (navItem) navItem.classList.add('active');

  const _pm = el('profileMenu');
  if (_pm) _pm.classList.add('hidden');

  const sideNav  = el('sideNav');
  const backdrop = el('sideBackdrop');
  if (sideNav && window.innerWidth < 900) sideNav.classList.remove('drawer-open');
  if (backdrop) backdrop.classList.add('hidden');

  const mc = el('mainContent') || document.querySelector('.main-content');
  if (mc) mc.scrollTop = 0;

  // Loader map — safe to call anytime; each function guards DB internally
  const loaders = {
    home          : renderHome,
    browse        : renderBrowse,
    myJobs        : renderMyJobs,
    newJob        : initNewJob,
    chat          : renderChat,
    profile       : renderProfile,
    adminPanel    : () => adminTab('pendingJobs'),
    merchantPanel : () => merchantTab('pendingJobs'),
    superPanel    : () => superTab('users'),
    testimonials  : renderTestimonials,
    notifications : renderNotifications,
  };
  if (loaders[name]) loaders[name]();
}

function toggleProfileMenu() {
  el('profileMenu').classList.toggle('hidden');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.avatar-wrap') && !e.target.closest('#profileMenu')) {
    const pm = el('profileMenu');
    if (pm) pm.classList.add('hidden');
  }
});


/* ═══════════════════════════════════════════════════════════
   HOME
   ═══════════════════════════════════════════════════════════ */
/** Public — used by showSection loader map */
function renderHome() {
  if (!DB || !DB.jobs) {
    // DB not ready yet (e.g. user clicked very fast) — retry shortly
    setTimeout(renderHome, 200);
    return;
  }
  _doRenderHome();
}

/** Internal — used by bootApp after DB is guaranteed ready */
function _doRenderHome() {
  renderCategories('homeCategories');
  const jobs = getVisibleJobs().slice(0, 6);
  renderJobList('homeLatestJobs', jobs);
}

function renderCategories(containerId) {
  const c = el(containerId);
  if (!c) return;
  c.innerHTML = CATEGORIES.map(cat => `
    <div class="category-card" onclick="filterByCategory('${cat.id}')">
      <span class="cat-icon">${cat.icon}</span>
      <span class="cat-name">${cat.name}</span>
    </div>
  `).join('');
}

function filterByCategory(catId) {
  showSection('browse');
  setTimeout(() => {
    el('filterCategory').value = catId;
    filterJobs();
  }, 100);
}


/* ═══════════════════════════════════════════════════════════
   BROWSE
   ═══════════════════════════════════════════════════════════ */
function renderBrowse() {
  if (!DB || !DB.jobs) { setTimeout(renderBrowse, 200); return; }
  filterJobs();
}

function getVisibleJobs() {
  if (!DB || !DB.jobs) return [];
  const g = currentUser.user_group;
  let jobs = DB.jobs.filter(j => j.status === 'approved');

  jobs = jobs.filter(j => {
    const merchant = DB.users.find(u => u.userId === j.merchantId && u.user_group === 1);
    if (!merchant) return false;
    if (merchant.accessMode === 'closed') {
      if (g === 0 || g === 1) return true;
      return currentUser.churchId === j.merchantId || currentUser.userId === j.merchantId;
    }
    return true;
  });

  if (g === 3 || g === 2) {
    jobs = jobs.filter(j => j.scope === 'global' || j.merchantId === currentUser.churchId);
  }
  return jobs;
}

function filterJobs() {
  const search = (el('searchInput')?.value || '').toLowerCase();
  const cat    = el('filterCategory')?.value || '';
  const church = el('filterChurch')?.value   || '';

  let jobs = getVisibleJobs();
  if (search) jobs = jobs.filter(j =>
    j.title.toLowerCase().includes(search) ||
    j.description.toLowerCase().includes(search));
  if (cat)    jobs = jobs.filter(j => j.category   === cat);
  if (church) jobs = jobs.filter(j => j.merchantId === church);

  renderJobList('browseJobs', jobs);
}

function renderJobList(containerId, jobs) {
  const c = el(containerId);
  if (!c) return;
  if (!jobs || !jobs.length) {
    c.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>No listings found.</p></div>`;
    return;
  }
  c.innerHTML = jobs.map(j => {
    const seller  = DB.users.find(u => u.userId === j.sellerId)  || {};
    const church  = DB.users.find(u => u.userId === j.merchantId)|| {};
    const avgRating = getAvgRating(j.jobId);
    const thumb  = (j.photos && j.photos[0])
      ? `<img src="${j.photos[0]}" alt=""/>`
      : `<i class="fas fa-briefcase"></i>`;
    const catObj = CATEGORIES.find(c => c.id === j.category) || { icon: '🌟', name: j.category };
    return `
      <div class="job-item" onclick="openJobDetail('${j.jobId}')">
        <div class="job-thumb">${thumb}</div>
        <div class="job-info">
          <h4>${escHtml(j.title)}</h4>
          <p>${escHtml(j.description).substring(0, 80)}…</p>
          <div class="job-meta">
            <span class="tag">${catObj.icon} ${catObj.name}</span>
            <span class="tag">${escHtml(church.churchName || church.userId || '')}</span>
            ${j.scope === 'global'
              ? '<span class="tag tag-orange">🌍 Public</span>'
              : '<span class="tag">🏛 Local</span>'}
          </div>
        </div>
        <div>
          <div class="job-price">₦${Number(j.price || 0).toLocaleString()}</div>
          <div class="job-rating">${'⭐'.repeat(Math.round(avgRating))} (${avgRating.toFixed(1)})</div>
        </div>
      </div>`;
  }).join('');
}

function populateCategoryFilters() {
  const opts = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  const fc = el('filterCategory');
  const jc = el('jobCategory');
  if (fc) fc.innerHTML = '<option value="">All Categories</option>' + opts;
  if (jc) jc.innerHTML = opts;
}

function populateChurchDropdowns() {
  const churches = (DB.users || []).filter(u => u.user_group === 1 && u.active);
  const opts = churches.map(c =>
    `<option value="${c.userId}">${escHtml(c.churchName || c.userId)}</option>`
  ).join('');
  const fc = el('filterChurch');
  if (fc) fc.innerHTML = '<option value="">All Churches</option>' + opts;
  const rc = el('regChurch');
  if (rc) rc.innerHTML = '<option value="">-- Select a Church --</option>' + opts;
}


/* ═══════════════════════════════════════════════════════════
   JOB DETAIL MODAL
   ═══════════════════════════════════════════════════════════ */
function openJobDetail(jobId) {
  const j = DB.jobs.find(j => j.jobId === jobId);
  if (!j) return;
  const seller   = DB.users.find(u => u.userId === j.sellerId)   || {};
  const church   = DB.users.find(u => u.userId === j.merchantId) || {};
  const avgRating = getAvgRating(jobId);
  const catObj   = CATEGORIES.find(c => c.id === j.category) || { icon: '🌟', name: j.category };
  const photos   = (j.photos || []).filter(Boolean).slice(0, 4);
  const photoHtml = photos.length
    ? `<div class="job-detail-photos">${photos.map(p =>
        `<img src="${p}" alt="" onerror="this.style.display='none'"/>`).join('')}</div>`
    : '';
  const sellerAvatar = seller.picture
    ? `<img src="${seller.picture}" alt=""/>`
    : (seller.userId || 'U')[0].toUpperCase();
  const canChat = currentUser.user_group === 3 ||
    (currentUser.user_group === 2 && currentUser.userId !== j.sellerId);

  el('jobDetailContent').innerHTML = `
    ${photoHtml}
    <h2 class="job-detail-title">${escHtml(j.title)}</h2>
    <div class="job-detail-meta">
      <span class="tag">${catObj.icon} ${catObj.name}</span>
      <span class="status-badge status-${j.status}">${j.status}</span>
      ${j.scope === 'global' ? '<span class="tag tag-orange">🌍 Public</span>' : ''}
      <span class="job-price">₦${Number(j.price || 0).toLocaleString()}</span>
    </div>
    <p class="job-detail-desc">${escHtml(j.description)}</p>
    <p style="color:var(--gray);font-size:.85rem;margin-bottom:12px;">
      <i class="fas fa-clock"></i> ${escHtml(j.availability || 'Flexible')}
    </p>
    <div class="seller-info-row">
      <div class="seller-avatar">${sellerAvatar}</div>
      <div>
        <div style="font-weight:600">${escHtml(seller.userId || '')}</div>
        <div style="font-size:.8rem;color:var(--gray)">
          ${escHtml(church.churchName || '')} ${seller.branch ? '• ' + seller.branch : ''}
        </div>
        <div style="font-size:.82rem">${'⭐'.repeat(Math.round(avgRating))} (${avgRating.toFixed(1)})</div>
      </div>
    </div>
    ${canChat
      ? `<button class="btn-primary" onclick="startChat('${j.sellerId}','${j.jobId}')">
           <i class="fas fa-comment-dots"></i> Contact Seller
         </button>`
      : ''}
  `;
  el('jobModal').classList.remove('hidden');
  el('jobModal').style.display = 'flex';
}

function closeJobModal() {
  el('jobModal').classList.add('hidden');
  el('jobModal').style.display = 'none';
}


/* ═══════════════════════════════════════════════════════════
   MY LISTINGS (Seller)
   ═══════════════════════════════════════════════════════════ */
function renderMyJobs() {
  if (!DB || !DB.jobs) { setTimeout(renderMyJobs, 200); return; }
  _doRenderMyJobs();
}

function _doRenderMyJobs() {
  const jobs = (DB.jobs || []).filter(j => j.sellerId === currentUser.userId);
  const c    = el('myJobsList');
  if (!c) return;
  if (!jobs.length) {
    c.innerHTML = `<div class="empty-state"><i class="fas fa-plus-circle"></i>
      <p>No listings yet. Create your first one!</p></div>`;
    return;
  }
  c.innerHTML = jobs.map(j => {
    const catObj = CATEGORIES.find(ct => ct.id === j.category) || { icon: '🌟', name: j.category };
    const thumb  = (j.photos && j.photos[0])
      ? `<img src="${j.photos[0]}" alt=""/>`
      : `<i class="fas fa-briefcase"></i>`;
    return `
      <div class="job-item">
        <div class="job-thumb">${thumb}</div>
        <div class="job-info">
          <h4>${escHtml(j.title)}</h4>
          <div class="job-meta">
            <span class="tag">${catObj.icon} ${catObj.name}</span>
            <span class="status-badge status-${j.status}">${j.status}</span>
          </div>
          <p style="font-size:.8rem;color:var(--gray);margin-top:4px;">
            ${escHtml(j.description).substring(0, 60)}…
          </p>
        </div>
        <div>
          <div class="job-price">₦${Number(j.price || 0).toLocaleString()}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
            ${j.status === 'approved'
              ? `<button class="btn-orange" onclick="openJobDetail('${j.jobId}')">View</button>`
              : ''}
            <button class="btn-secondary" style="padding:6px 12px;font-size:.82rem;" onclick="openEditJob('${j.jobId}')">
              <i class="fas fa-edit"></i> Edit
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════
   NEW JOB
   ═══════════════════════════════════════════════════════════ */
function initNewJob() {
  const jc = el('jobCategory');
  if (jc) jc.innerHTML = CATEGORIES.map(c =>
    `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  setErr('jobError', '');
}

async function submitJob() {
  const title = el('jobTitle').value.trim();
  const cat   = el('jobCategory').value;
  const desc  = el('jobDesc').value.trim();
  const price = el('jobPrice').value;
  const avail = el('jobAvail').value.trim();
  const scope = el('jobScope').value;

  if (!title || !cat || !desc) return setErr('jobError', 'Please fill required fields.');
  if (!currentUser.churchId)   return setErr('jobError', 'No church linked to your account.');

  // Upload photos from file input
  const photosInput = el('jobPhotos');
  let photos = [];
  if (photosInput && photosInput.files && photosInput.files.length) {
    const statusEl = el('jobPhotosStatus');
    if (statusEl) statusEl.textContent = 'Uploading photos…';
    const submitBtn = document.querySelector('#sec-newJob .btn-primary');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…'; }
    try {
      for (const file of Array.from(photosInput.files).slice(0, 4)) {
        const url = await uploadImageToFirebase(
          file, `faithworks/jobs/${currentUser.userId}_${Date.now()}_${file.name}`);
        photos.push(url);
      }
    } catch (e) {
      console.error('Photo upload error:', e);
      setErr('jobError', 'Photo upload failed. Please try again.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Submit for Approval'; }
      if (statusEl) statusEl.textContent = '';
      return;
    }
    if (statusEl) statusEl.textContent = `${photos.length} photo(s) uploaded.`;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Submit for Approval'; }
  }
  const job = {
    jobId        : genId('job'),
    title, category: cat, description: desc,
    price        : parseFloat(price) || 0,
    availability : avail, scope, photos,
    sellerId     : currentUser.userId,
    merchantId   : currentUser.churchId,
    status       : 'pending',
    createdAt    : new Date().toISOString(),
    updatedAt    : new Date().toISOString(),
    extraFeeApplied: scope === 'global',
  };

  try {
    await dbTransaction(db => db.jobs.push(job));
    addNotification(currentUser.churchId,
      `New job listing pending approval: "${title}" by ${currentUser.userId}`);
    // Email notification to the Merchant administrator
    const merchant = DB.users.find(u => u.userId === currentUser.churchId && u.user_group === 1);
    if (merchant && merchant.email) {
      sendNewListingEmailAlert(merchant.email, merchant.churchName || merchant.userId,
        currentUser.userId, title, cat);
    }
    setErr('jobError', '✅ Listing submitted for approval!', false);
    setTimeout(() => showSection('myJobs'), 1500);
  } catch (e) {
    setErr('jobError', 'Error submitting listing. Please try again.');
  }
}


/* ═══════════════════════════════════════════════════════════
   EDIT JOB (Seller)
   ═══════════════════════════════════════════════════════════ */
function openEditJob(jobId) {
  const j = DB.jobs.find(j => j.jobId === jobId);
  if (!j) return;

  // Populate category dropdown
  const ec = el('editJobCategory');
  if (ec) ec.innerHTML = CATEGORIES.map(c =>
    `<option value="${c.id}" ${c.id === j.category ? 'selected' : ''}>${c.icon} ${c.name}</option>`
  ).join('');

  el('editJobId').value    = j.jobId;
  el('editJobTitle').value = j.title;
  el('editJobDesc').value  = j.description;
  el('editJobPrice').value = j.price || '';
  el('editJobAvail').value = j.availability || '';
  el('editJobScope').value = j.scope || 'local';

  const statusEl = el('editJobPhotosStatus');
  if (statusEl) {
    const existing = (j.photos || []).filter(Boolean).length;
    statusEl.textContent = existing
      ? `${existing} existing photo(s). Upload new files to replace them.`
      : 'No photos uploaded yet.';
  }

  setErr('editJobError', '');
  el('editJobModal').classList.remove('hidden');
  el('editJobModal').style.display = 'flex';
}

function closeEditJobModal() {
  el('editJobModal').classList.add('hidden');
  el('editJobModal').style.display = 'none';
}

async function saveEditJob() {
  const jobId = el('editJobId').value;
  const title = el('editJobTitle').value.trim();
  const cat   = el('editJobCategory').value;
  const desc  = el('editJobDesc').value.trim();
  const price = el('editJobPrice').value;
  const avail = el('editJobAvail').value.trim();
  const scope = el('editJobScope').value;

  if (!title || !cat || !desc) return setErr('editJobError', 'Please fill required fields.');

  const j = DB.jobs.find(j => j.jobId === jobId);
  if (!j) return setErr('editJobError', 'Listing not found.');
  if (j.sellerId !== currentUser.userId) return setErr('editJobError', 'Unauthorised.');

  // Handle optional photo replacement
  const photosInput  = el('editJobPhotos');
  let newPhotos      = j.photos || [];
  if (photosInput && photosInput.files && photosInput.files.length) {
    const statusEl  = el('editJobPhotosStatus');
    const saveBtn   = document.querySelector('#editJobModal .btn-primary');
    if (statusEl) statusEl.textContent = 'Uploading photos…';
    if (saveBtn)  { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…'; }
    try {
      newPhotos = [];
      for (const file of Array.from(photosInput.files).slice(0, 4)) {
        const url = await uploadImageToFirebase(
          file, `faithworks/jobs/${currentUser.userId}_${Date.now()}_${file.name}`);
        newPhotos.push(url);
      }
      if (statusEl) statusEl.textContent = `${newPhotos.length} photo(s) uploaded.`;
    } catch (e) {
      console.error('Photo upload error during edit:', e);
      setErr('editJobError', 'Photo upload failed. Changes not saved.');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
      return;
    }
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
  }

  try {
    await dbTransaction(db => {
      const job = db.jobs.find(j => j.jobId === jobId);
      if (!job) return;
      job.title         = title;
      job.category      = cat;
      job.description   = desc;
      job.price         = parseFloat(price) || 0;
      job.availability  = avail;
      job.scope         = scope;
      job.photos        = newPhotos;
      job.extraFeeApplied = scope === 'global';
      job.updatedAt     = new Date().toISOString();
      // Re-set to pending so the merchant can re-approve the edited listing
      job.status        = 'pending';
    });
    // Notify the merchant that a listing was edited and needs re-approval
    addNotification(currentUser.churchId,
      `Listing "${title}" edited by ${currentUser.userId} — pending re-approval.`);
    const merchant = DB.users.find(u => u.userId === currentUser.churchId && u.user_group === 1);
    if (merchant && merchant.email) {
      sendNewListingEmailAlert(merchant.email, merchant.churchName || merchant.userId,
        currentUser.userId, title, cat);
    }
    setErr('editJobError', '✅ Listing updated and re-submitted for approval.', false);
    setTimeout(() => { closeEditJobModal(); showSection('myJobs'); }, 1600);
  } catch (e) {
    setErr('editJobError', 'Error saving changes. Please try again.');
  }
}
function renderChat() {
  if (!DB) { setTimeout(renderChat, 200); return; }
  const userId  = currentUser.userId;
  const threads = (DB.chats || [])
    .filter(c => c.participants.includes(userId))
    .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

  const tl = el('chatThreads');
  if (!threads.length) {
    tl.innerHTML = '<p style="color:var(--gray);font-size:.85rem;">No conversations yet.</p>';
    return;
  }
  tl.innerHTML = threads.map(t => {
    const other   = t.participants.find(p => p !== userId);
    const lastMsg = t.messages.slice(-1)[0];
    const unread  = (t.messages || []).filter(m => m.to === userId && !m.read).length;
    return `
      <div class="thread-item ${activeChatId === t.chatId ? 'active' : ''}"
           onclick="openChat('${t.chatId}')">
        <div class="thread-avatar">${(other || 'U')[0].toUpperCase()}</div>
        <div class="thread-info">
          <div class="thread-name">${escHtml(other || 'Unknown')}
            ${unread ? `<span class="badge" style="position:static;display:inline-flex">${unread}</span>` : ''}
          </div>
          <div class="thread-preview">
            ${lastMsg ? escHtml(lastMsg.text.substring(0, 40)) : 'No messages'}
          </div>
        </div>
      </div>`;
  }).join('');
}

function openChat(chatId) {
  activeChatId = chatId;
  const chat = DB.chats.find(c => c.chatId === chatId);
  if (!chat) return;

  const other = chat.participants.find(p => p !== currentUser.userId);
  const job   = DB.jobs.find(j => j.jobId === chat.jobId);

  dbTransaction(db => {
    const c = db.chats.find(c => c.chatId === chatId);
    if (c) c.messages.forEach(m => { if (m.to === currentUser.userId) m.read = true; });
  });

  el('chatHeader').innerHTML = `
    <strong>${escHtml(other)}</strong>
    ${job ? `<span style="color:var(--gray);font-size:.82rem;margin-left:8px;">re: ${escHtml(job.title)}</span>` : ''}
  `;

  const msgs = chat.messages || [];
  el('chatMessages').innerHTML = msgs.map(m => `
    <div class="msg-bubble ${m.from === currentUser.userId ? 'mine' : 'theirs'}">
      ${escHtml(m.text)}
      <div class="msg-time">${formatTime(m.sentAt)}</div>
    </div>
  `).join('');
  const cm = el('chatMessages');
  cm.scrollTop = cm.scrollHeight;

  const isSeller = currentUser.user_group === 2 && job && job.sellerId === currentUser.userId;
  const isUser   = currentUser.user_group === 3;
  let actBtns    = '';
  if (!chat.jobCompleted) {
    if (isSeller) {
      actBtns += `<button class="btn-success" onclick="markJobDone('${chatId}','seller')">✅ Mark Job Done</button>`;
      actBtns += `<button class="btn-orange"  onclick="openRating('${chatId}','${other}','buyer')">⭐ Rate Buyer</button>`;
    }
    if (isUser) {
      actBtns += `<button class="btn-success" onclick="markJobDone('${chatId}','user')">✅ Confirm Job Done</button>`;
      actBtns += `<button class="btn-orange"  onclick="openRating('${chatId}','${other}','seller')">⭐ Rate Seller</button>`;
    }
  } else {
    actBtns = '<span style="color:var(--success);font-weight:600;">✅ Job Completed</span>';
  }
  el('chatActions').innerHTML = actBtns;

  document.querySelector('.chat-placeholder').classList.add('hidden');
  el('activeChatArea').classList.remove('hidden');

  renderChat();
  updateBadges();
}

async function startChat(sellerId, jobId) {
  closeJobModal();
  const seller = DB.users.find(u => u.userId === sellerId);
  if (!seller) return;

  let chat = DB.chats.find(c =>
    c.participants.includes(currentUser.userId) &&
    c.participants.includes(sellerId) &&
    c.jobId === jobId);

  if (!chat) {
    const sellerContacts = DB.chats.filter(c => c.participants.includes(sellerId)).length;
    if (sellerContacts >= CONFIG.FREE_CONTACTS && !seller.subscribed) {
      addNotification(sellerId, "You have a new contact. You've used your free contacts — please subscribe.");
    }
    chat = {
      chatId       : genId('chat'),
      participants : [currentUser.userId, sellerId],
      jobId, messages: [], lastUpdated: new Date().toISOString(), jobCompleted: false,
    };
    await dbTransaction(db => {
      db.chats.push(chat);
      const s = db.users.find(u => u.userId === sellerId);
      if (s) s.contactCount = (s.contactCount || 0) + 1;
    });
    sendEmailAlert(seller.email, seller.userId, currentUser.userId, jobId);
  }

  showSection('chat');
  setTimeout(() => openChat(chat.chatId), 200);
}

async function sendChatMsg() {
  const text = el('chatInput').value.trim();
  if (!text || !activeChatId) return;
  const chat  = DB.chats.find(c => c.chatId === activeChatId);
  if (!chat) return;
  const other = chat.participants.find(p => p !== currentUser.userId);
  const msg   = {
    msgId : genId('msg'), from: currentUser.userId, to: other,
    text, sentAt: new Date().toISOString(), read: false,
  };
  el('chatInput').value = '';
  await dbTransaction(db => {
    const c = db.chats.find(c => c.chatId === activeChatId);
    if (c) { c.messages.push(msg); c.lastUpdated = new Date().toISOString(); }
  });
  addNotification(other, `New message from ${currentUser.userId}: "${text.substring(0, 40)}…"`);
  const otherUser = DB.users.find(u => u.userId === other);
  if (otherUser) sendEmailAlert(otherUser.email, other, currentUser.userId, chat.jobId);
  openChat(activeChatId);
}

async function markJobDone(chatId, role) {
  await dbTransaction(db => {
    const c = db.chats.find(c => c.chatId === chatId);
    if (!c) return;
    if (role === 'seller') c.sellerConfirmed = true;
    if (role === 'user')   c.userConfirmed   = true;
    if (c.sellerConfirmed && c.userConfirmed) {
      c.jobCompleted = true;
      const job = db.jobs.find(j => j.jobId === c.jobId);
      if (job) {
        const merchant    = db.users.find(u => u.userId === job.merchantId);
        const merchantPct = (merchant && merchant.commissionPct) || 10;
        const base        = parseFloat(job.price) || 0;
        const extra       = job.extraFeeApplied ? base * 0.2 : 0;
        const total       = base + extra;
        db.payments.push({
          paymentId   : genId('pay'), type: 'service',
          sellerId    : job.sellerId, merchantId: job.merchantId,
          jobId       : c.jobId,     amount: total,
          merchantShare: total * (merchantPct / 100),
          status      : 'pending',   createdAt: new Date().toISOString(),
        });
      }
    }
  });
  openChat(chatId);
}

function sendEmailAlert(toEmail, toName, fromUser, jobId) {
  if (typeof emailjs === 'undefined') return;
  const job = DB.jobs.find(j => j.jobId === jobId) || {};
  emailjs.send(CONFIG.EMAILJS_SERVICE, CONFIG.EMAILJS_TEMPLATE_CHAT, {
    to_email : toEmail, to_name: toName, from_user: fromUser,
    job_title: job.title || '',
    message  : `New message/contact on FaithWorks re: "${job.title || 'a job'}". Login to respond.`,
  }).catch(console.error);
}

/**
 * Notify a Merchant administrator by email when a seller submits a new listing.
 */
function sendNewListingEmailAlert(toEmail, toName, sellerUserId, listingTitle, category) {
  if (typeof emailjs === 'undefined') return;
  const catObj = CATEGORIES.find(c => c.id === category) || { name: category };
  emailjs.send(CONFIG.EMAILJS_SERVICE, CONFIG.EMAILJS_TEMPLATE_CHAT, {
    to_email : toEmail,
    to_name  : toName,
    from_user: sellerUserId,
    job_title: listingTitle,
    message  : `A new service listing "${listingTitle}" (${catObj.name}) has been submitted by ${sellerUserId} and is awaiting your approval. Please log in to your FaithWorks Church Panel to review it.`,
  }).catch(console.error);
}


/* ═══════════════════════════════════════════════════════════
   RATINGS
   ═══════════════════════════════════════════════════════════ */
function getAvgRating(jobId) {
  const r = (DB.ratings || []).filter(r => r.jobId === jobId);
  if (!r.length) return 0;
  return r.reduce((a, b) => a + b.stars, 0) / r.length;
}

function openRating(chatId, targetId, targetRole) {
  ratingContext = { chatId, targetId, targetRole };
  selectedRating = 0;
  el('ratingTarget').textContent = targetRole;
  document.querySelectorAll('.star').forEach(s => s.classList.remove('lit'));
  el('ratingComment').value = '';
  el('ratingModal').classList.remove('hidden');
  el('ratingModal').style.display = 'flex';
}

function closeRatingModal() {
  el('ratingModal').classList.add('hidden');
  el('ratingModal').style.display = 'none';
  ratingContext = null;
}

function setRating(n) {
  selectedRating = n;
  document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('lit', i < n));
}

async function submitRating() {
  if (!selectedRating || !ratingContext) return;
  const chat    = DB.chats.find(c => c.chatId === ratingContext.chatId);
  const comment = el('ratingComment').value.trim();
  await dbTransaction(db => db.ratings.push({
    ratingId  : genId('rat'),
    jobId     : chat ? chat.jobId : '',
    targetId  : ratingContext.targetId,
    fromId    : currentUser.userId,
    stars     : selectedRating,
    comment,
    role      : ratingContext.targetRole,
    createdAt : new Date().toISOString(),
  }));
  closeRatingModal();
  alert('Rating submitted! Thank you.');
}


/* ═══════════════════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════════════════ */
function renderTestimonials() {
  const ratings = (DB.ratings || []).filter(r => r.role === 'seller' && r.comment);
  const tg = el('testimonialsGrid');
  if (!ratings.length) {
    tg.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><p>No testimonials yet.</p></div>';
    return;
  }
  tg.innerHTML = ratings.slice().reverse().slice(0, 20).map(r => {
    const job = DB.jobs.find(j => j.jobId === r.jobId) || {};
    return `
      <div class="testimonial-card">
        <div class="testi-stars">${'⭐'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
        <p class="testi-text">"${escHtml(r.comment)}"</p>
        <div class="testi-author">— ${escHtml(r.fromId)}</div>
        <div class="testi-seller">Service: ${escHtml(job.title || r.targetId)}</div>
      </div>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════
   PROFILE
   ═══════════════════════════════════════════════════════════ */
function renderProfile() {
  const u = currentUser;
  const g = u.user_group;
  const labels = { 0:'Super Admin', 1:'Church / Merchant', 2:'Seller', 3:'General User' };
  const avatarContent = u.picture
    ? `<img src="${u.picture}" alt=""/>`
    : (u.userId[0] || 'U').toUpperCase();

  el('profileCard').innerHTML = `
    <div class="profile-header">
      <div class="profile-big-avatar">${avatarContent}</div>
      <div>
        <h3>${escHtml(u.userId)}</h3>
        <span class="tag">${labels[g] || 'User'}</span>
        ${u.email ? `<p style="color:var(--gray);font-size:.85rem;margin-top:4px;">${escHtml(u.email)}</p>` : ''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      ${u.phone  ? `<div class="form-group"><label>Phone</label><p>${escHtml(u.phone)}</p></div>`      : ''}
      ${u.state  ? `<div class="form-group"><label>State</label><p>${escHtml(u.state)}</p></div>`      : ''}
      ${u.address? `<div class="form-group"><label>Address</label><p>${escHtml(u.address)}</p></div>`  : ''}
      ${u.churchName ? `<div class="form-group"><label>Church</label><p>${escHtml(u.churchName)}</p></div>` : ''}
      ${u.denomination ? `<div class="form-group"><label>Denomination</label><p>${escHtml(u.denomination)}</p></div>` : ''}
      ${g === 2 ? `<div class="form-group"><label>Free Contacts Used</label>
        <p>${u.contactCount || 0} / ${CONFIG.FREE_CONTACTS}</p></div>` : ''}
      ${g === 2 ? `<div class="form-group"><label>Subscription</label>
        <p>${u.subscribed ? '✅ Active' : '❌ Not subscribed'}</p></div>` : ''}
    </div>
    ${g === 2 && !u.subscribed
      ? `<button class="btn-primary" onclick="promptSubscription()">💳 Subscribe Now</button>`
      : ''}
  `;
}


/* ═══════════════════════════════════════════════════════════
   SUBSCRIPTION / PAYSTACK
   ═══════════════════════════════════════════════════════════ */
function checkSellerSubscription() {
  const u = currentUser;
  if (u.user_group !== 2) return;
  if (!u.subscribed && (u.contactCount || 0) >= CONFIG.FREE_CONTACTS) {
    promptSubscription();
  }
}

function promptSubscription() {
  el('payDesc').textContent = 'Subscribe to continue receiving contacts from potential clients.';
  el('payAmount').textContent = `₦${CONFIG.SELLER_FEE_BASE.toLocaleString()}`;
  payContext = { type: 'subscription', amount: CONFIG.SELLER_FEE_BASE };
  el('payModal').classList.remove('hidden');
  el('payModal').style.display = 'flex';
}

function closePayModal() {
  el('payModal').classList.add('hidden');
  el('payModal').style.display = 'none';
}

function initPaystack() {
  if (!payContext) return;
  if (typeof PaystackPop === 'undefined') {
    alert('Paystack is not loaded. Check your internet connection.');
    return;
  }
  PaystackPop.setup({
    key      : CONFIG.PAYSTACK_PUBLIC,
    email    : currentUser.email,
    amount   : payContext.amount * 100,
    currency : 'NGN',
    ref      : genId('psk'),
    metadata : { userId: currentUser.userId, type: payContext.type },
    callback : async (response) => { await processPaymentSuccess(response); closePayModal(); },
    onClose  : () => closePayModal(),
  }).openIframe();
}

async function processPaymentSuccess(response) {
  await dbTransaction(db => {
    const u = db.users.find(u => u.userId === currentUser.userId);
    if (u) {
      u.subscribed          = true;
      u.subscriptionExpiry  = new Date(Date.now() + 30 * 24 * 3_600_000).toISOString();
      currentUser.subscribed = true;
      sessionStorage.setItem('fw_user', JSON.stringify(currentUser));
    }
    const merchant    = db.users.find(u => u.userId === currentUser.churchId && u.user_group === 1);
    const merchantPct = merchant ? merchant.commissionPct : 10;
    db.payments.push({
      paymentId    : genId('pay'), type: 'subscription',
      sellerId     : currentUser.userId, merchantId: currentUser.churchId || '',
      amount       : payContext.amount,
      merchantShare: (payContext.amount || 0) * (merchantPct / 100),
      paystackRef  : response.reference, status: 'paid',
      paidAt       : new Date().toISOString(),
    });
  });
  alert('✅ Payment successful! Subscription is now active.');
}


/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════ */
async function addNotification(userId, message) {
  await dbTransaction(db => {
    db.notifications.push({
      notifId  : genId('notif'), userId, message,
      read     : false, createdAt: new Date().toISOString(),
    });
  });
}

function renderNotifications() {
  const notifs = (DB.notifications || [])
    .filter(n => n.userId === currentUser.userId)
    .slice().reverse();
  const nl = el('notifList');
  if (!notifs.length) {
    nl.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>No notifications.</p></div>';
    return;
  }
  nl.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div>${escHtml(n.message)}</div>
      <div style="font-size:.75rem;color:var(--gray);margin-top:4px;">${formatTime(n.createdAt)}</div>
    </div>
  `).join('');
  dbTransaction(db => {
    db.notifications.filter(n => n.userId === currentUser.userId).forEach(n => n.read = true);
  });
  updateBadges();
}

function updateBadges() {
  if (!DB || !currentUser) return;
  const uid          = currentUser.userId;
  const unreadNotifs = (DB.notifications || []).filter(n => n.userId === uid && !n.read).length;
  const unreadChats  = (DB.chats || []).reduce((acc, c) => {
    if (!c.participants.includes(uid)) return acc;
    return acc + c.messages.filter(m => m.to === uid && !m.read).length;
  }, 0);

  // For Merchant accounts (user_group === 1), add the count of pending listing
  // approvals to the notification bell so it lights up without delay.
  let pendingApprovals = 0;
  if (currentUser.user_group === 1) {
    pendingApprovals = (DB.jobs || []).filter(
      j => j.merchantId === uid && j.status === 'pending'
    ).length;
  }

  setBadge('notifBadge', unreadNotifs + pendingApprovals);
  setBadge('chatBadge',  unreadChats);
  syncBottomNavBadges();   // mirror counts to mobile bottom nav
}

function setBadge(id, count) {
  const b = el(id);
  if (b) { b.textContent = count; b.style.display = count > 0 ? 'flex' : 'none'; }
}


/* ═══════════════════════════════════════════════════════════
   ADMIN PANEL
   ═══════════════════════════════════════════════════════════ */
function adminTab(tab) {
  if (!DB || !DB.users) return;   // DB guaranteed by bootApp; no setTimeout needed

  document.querySelectorAll('#sec-adminPanel .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['pendingJobs','sellers','payments'][i] === tab);
  });

  const c = el('adminContent');
  if (!c) return;

  if (tab === 'pendingJobs') {
    const pending = DB.jobs.filter(j =>
      j.status === 'pending' &&
      (currentUser.user_group === 0 || j.merchantId === currentUser.userId));
    c.innerHTML = pending.length ? `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Title</th><th>Seller</th><th>Category</th><th>Scope</th><th>Actions</th></tr></thead>
        <tbody>${pending.map(j => `
          <tr>
            <td>${escHtml(j.title)}</td><td>${escHtml(j.sellerId)}</td>
            <td>${escHtml(j.category)}</td>
            <td>${j.scope === 'global' ? '🌍 Public' : '🏛 Local'}</td>
            <td class="action-btns">
              <button class="btn-success" onclick="approveJob('${j.jobId}')">Approve</button>
              <button class="btn-danger"  onclick="rejectJob('${j.jobId}')">Reject</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>`
    : '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No pending jobs.</p></div>';

  } else if (tab === 'sellers') {
    const sellers = DB.users.filter(u =>
      u.user_group === 2 &&
      (currentUser.user_group === 0 || u.churchId === currentUser.userId));
    c.innerHTML = sellers.length ? `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>User ID</th><th>Email</th><th>Status</th><th>Subscribed</th><th>Actions</th></tr></thead>
        <tbody>${sellers.map(s => `
          <tr>
            <td>${escHtml(s.userId)}</td><td>${escHtml(s.email||'')}</td>
            <td><span class="status-badge status-${s.active?'active':'inactive'}">${s.active?'Active':'Inactive'}</span></td>
            <td>${s.subscribed ? '✅' : '❌'}</td>
            <td class="action-btns">
              <button class="btn-${s.active?'danger':'success'}"
                onclick="toggleUserActive('${s.userId}', () => adminTab('sellers'))">${s.active?'Deactivate':'Activate'}</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>`
    : '<div class="empty-state"><i class="fas fa-users"></i><p>No sellers found.</p></div>';

  } else if (tab === 'payments') {
    renderPaymentsTable('adminContent', currentUser.user_group === 0 ? null : currentUser.userId);
  }
}

async function approveJob(jobId) {
  await dbTransaction(db => {
    const j = db.jobs.find(j => j.jobId === jobId);
    if (j) { j.status = 'approved'; j.approvedAt = new Date().toISOString(); }
  });
  addNotification((DB.jobs.find(j => j.jobId === jobId)||{}).sellerId, 'Your listing has been approved!');
  adminTab('pendingJobs');
}

async function rejectJob(jobId) {
  const reason = prompt('Reason for rejection (optional):') || '';
  await dbTransaction(db => {
    const j = db.jobs.find(j => j.jobId === jobId);
    if (j) { j.status = 'rejected'; j.rejectionReason = reason; }
  });
  addNotification((DB.jobs.find(j => j.jobId === jobId)||{}).sellerId,
    `Your listing was rejected. Reason: ${reason}`);
  adminTab('pendingJobs');
}

async function toggleUserActive(userId, refreshCallback) {
  await dbTransaction(db => {
    const u = db.users.find(u => u.userId === userId);
    if (u) u.active = !u.active;
  });
  if (typeof refreshCallback === 'function') {
    refreshCallback();
  } else {
    adminTab('sellers');   // safe default
  }
}


/* ═══════════════════════════════════════════════════════════
   MERCHANT PANEL
   ═══════════════════════════════════════════════════════════ */
function merchantTab(tab) {
  if (!DB || !DB.users) return;

  document.querySelectorAll('#sec-merchantPanel .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['pendingJobs','members','settings'][i] === tab);
  });

  const c = el('merchantContent');
  if (!c) return;

  if (tab === 'pendingJobs') {
    const pending = DB.jobs.filter(j =>
      j.merchantId === currentUser.userId && j.status === 'pending');
    c.innerHTML = pending.length ? `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Title</th><th>Seller</th><th>Scope</th><th>Actions</th></tr></thead>
        <tbody>${pending.map(j => `
          <tr>
            <td>${escHtml(j.title)}</td><td>${escHtml(j.sellerId)}</td>
            <td>${j.scope === 'global' ? '🌍 Public' : '🏛 Local'}</td>
            <td class="action-btns">
              <button class="btn-success" onclick="approveJob('${j.jobId}');merchantTab('pendingJobs')">Approve</button>
              <button class="btn-danger"  onclick="rejectJob('${j.jobId}');merchantTab('pendingJobs')">Reject</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>`
    : '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No pending approvals.</p></div>';

  } else if (tab === 'members') {
    const members = DB.users.filter(u =>
      (u.user_group === 2 || u.user_group === 3) && u.churchId === currentUser.userId);
    c.innerHTML = members.length ? `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>User ID</th><th>Type</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${members.map(u => `
          <tr>
            <td>${escHtml(u.userId)}</td>
            <td>${u.user_group === 2 ? 'Seller' : 'Member'}</td>
            <td>${escHtml(u.email||'')}</td>
            <td><span class="status-badge status-${u.active?'active':'inactive'}">${u.active?'Active':'Inactive'}</span></td>
            <td><button class="btn-${u.active?'danger':'success'}"
              onclick="toggleUserActive('${u.userId}', () => merchantTab('members'))">${u.active?'Deactivate':'Activate'}</button></td>
          </tr>`).join('')}
        </tbody></table></div>`
    : '<div class="empty-state"><i class="fas fa-users"></i><p>No members yet.</p></div>';

  } else if (tab === 'settings') {
    const u = currentUser;
    c.innerHTML = `
      <div class="form-card">
        <div class="form-group"><label>Membership Access</label>
          <select id="mAccess" onchange="updateMerchantSetting('accessMode',this.value)">
            <option value="open"   ${u.accessMode==='open'   ?'selected':''}>Open (Public)</option>
            <option value="closed" ${u.accessMode==='closed' ?'selected':''}>Closed (Members Only)</option>
          </select>
        </div>
        <div class="form-group"><label>Commission % (set by Super Admin)</label>
          <input type="number" value="${u.commissionPct||10}" disabled/>
        </div>
        <p style="color:var(--gray);font-size:.82rem;">
          Commission % can only be modified by the Super Administrator.
        </p>
      </div>`;
  }
}

async function updateMerchantSetting(key, value) {
  await dbTransaction(db => {
    const u = db.users.find(u => u.userId === currentUser.userId);
    if (u) {
      u[key] = value;
      currentUser[key] = value;
      sessionStorage.setItem('fw_user', JSON.stringify(currentUser));
    }
  });
}


/* ═══════════════════════════════════════════════════════════
   SUPER ADMIN
   ═══════════════════════════════════════════════════════════ */
function superTab(tab) {
  if (!DB) { setTimeout(() => superTab(tab), 150); return; }

  document.querySelectorAll('#sec-superPanel .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['users','merchants','payments','newAdmin'][i] === tab);
  });

  const c = el('superContent');
  if (!c) return;

  if (tab === 'users') {
    const users  = (DB.users || []).filter(u => u.user_group !== 0);
    const labels = { 0:'SuperAdmin', 1:'Church', 2:'Seller', 3:'User' };
    c.innerHTML = users.length ? `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>User ID</th><th>Role</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td>${escHtml(u.userId)}</td>
            <td>${labels[u.user_group] || u.user_group}</td>
            <td>${escHtml(u.email||'')}</td>
            <td><span class="status-badge status-${u.active?'active':'inactive'}">${u.active?'Active':'Inactive'}</span></td>
            <td class="action-btns">
              <button class="btn-${u.active?'danger':'success'}"
                onclick="toggleUserActive('${u.userId}', () => superTab('users'))">${u.active?'Deactivate':'Activate'}</button>
              <button class="btn-danger" onclick="deleteUser('${u.userId}')">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>`
    : '<div class="empty-state"><i class="fas fa-users"></i><p>No users found.</p></div>';

  } else if (tab === 'merchants') {
    const merchants = DB.users.filter(u => u.user_group === 1);
    c.innerHTML = merchants.length ? `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Church</th><th>Leader</th><th>Commission %</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${merchants.map(m => `
          <tr>
            <td>${escHtml(m.churchName||m.userId)}</td>
            <td>${escHtml(m.leader||'')}</td>
            <td><input type="number" value="${m.commissionPct||10}" style="width:60px"
                 onchange="setCommission('${m.userId}',this.value)"/></td>
            <td>${m.accessMode||'open'}</td>
            <td><span class="status-badge status-${m.active?'active':'inactive'}">${m.active?'Active':'Inactive'}</span></td>
            <td class="action-btns">
              <button class="btn-${m.active?'danger':'success'}"
                onclick="toggleUserActive('${m.userId}', () => superTab('merchants'))">${m.active?'Deactivate':'Activate'}</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>`
    : '<div class="empty-state"><i class="fas fa-church"></i><p>No churches registered.</p></div>';

  } else if (tab === 'payments') {
    renderPaymentsTable('superContent', null);

  } else if (tab === 'newAdmin') {
    c.innerHTML = `
      <div class="form-card">
        <h3>Create Administrator</h3>
        <div class="form-group"><label>User ID</label>
          <input type="text" id="newAdminId" placeholder="Admin User ID"/></div>
        <div class="form-group"><label>Password</label>
          <input type="password" id="newAdminPass"/></div>
        <div class="form-group"><label>Email</label>
          <input type="email" id="newAdminEmail"/></div>
        <div class="form-group"><label>Role</label>
          <select id="newAdminGroup">
            <option value="0">Super Admin</option>
            <option value="1">Church / Merchant</option>
          </select>
        </div>
        <button class="btn-primary" onclick="createAdmin()">Create Admin</button>
        <div id="newAdminErr" class="error-msg"></div>
      </div>`;
  }
}

async function createAdmin() {
  const uid   = el('newAdminId')?.value.trim();
  const pass  = el('newAdminPass')?.value;
  const email = el('newAdminEmail')?.value.trim();
  const grp   = parseInt(el('newAdminGroup')?.value);
  if (!uid || !pass || !email) return setErr('newAdminErr', 'Fill all fields.');
  if (DB.users.find(u => u.userId === uid)) return setErr('newAdminErr', 'User ID taken.');
  await dbTransaction(db => db.users.push({
    userId: uid, password: pass, email, user_group: grp,
    active: true, createdAt: new Date().toISOString(), commissionPct: 10,
  }));
  setErr('newAdminErr', 'Admin created!', false);
}

async function setCommission(merchantId, pct) {
  await dbTransaction(db => {
    const m = db.users.find(u => u.userId === merchantId);
    if (m) m.commissionPct = parseFloat(pct) || 10;
  });
}

async function deleteUser(userId) {
  if (!confirm(`Delete user ${userId}? This cannot be undone.`)) return;
  await dbTransaction(db => { db.users = db.users.filter(u => u.userId !== userId); });
  await dbRead(true);   // ensure local DB reflects the committed state before re-render
  superTab('users');
}

function renderPaymentsTable(containerId, merchantId) {
  const c = el(containerId);
  if (!c) return;
  let payments = DB.payments || [];
  if (merchantId) payments = payments.filter(p =>
    p.merchantId === merchantId || p.sellerId === merchantId);

  c.innerHTML = payments.length ? `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr>
        <th>Type</th><th>Seller</th><th>Church</th>
        <th>Amount (₦)</th><th>Church Share (₦)</th><th>Status</th>
        ${!merchantId ? '<th>Action</th>' : ''}
      </tr></thead>
      <tbody>${payments.map(p => `
        <tr>
          <td>${p.type}</td>
          <td>${escHtml(p.sellerId||'')}</td>
          <td>${escHtml(p.merchantId||'')}</td>
          <td>${Number(p.amount||0).toLocaleString()}</td>
          <td>${Number(p.merchantShare||0).toLocaleString()}</td>
          <td><span class="status-badge status-${p.status==='paid'?'approved':'pending'}">${p.status}</span></td>
          ${!merchantId
            ? `<td>${p.status !== 'merchant_paid'
                ? `<button class="btn-success" onclick="payMerchant('${p.paymentId}')">Pay Church</button>`
                : '✅ Paid'}</td>`
            : ''}
        </tr>`).join('')}
      </tbody></table></div>`
  : '<div class="empty-state"><i class="fas fa-receipt"></i><p>No payment records.</p></div>';
}

async function payMerchant(paymentId) {
  if (!confirm('Mark church share as paid?')) return;
  await dbTransaction(db => {
    const p = db.payments.find(p => p.paymentId === paymentId);
    if (p) { p.status = 'merchant_paid'; p.paidAt = new Date().toISOString(); }
  });
  superTab('payments');
}


/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
function el(id) { return document.getElementById(id); }

/** Toggle a password input between visible text and hidden dots. */
function togglePwVisibility(inputId, btn) {
  const input = el(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) {
    icon.classList.toggle('fa-eye',        !isHidden);
    icon.classList.toggle('fa-eye-slash',  isHidden);
  }
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
}

function setErr(id, msg, isError = true) {
  const e = el(id);
  if (e) { e.textContent = msg; e.style.color = isError ? 'var(--danger)' : 'var(--success)'; }
}


/* ═══════════════════════════════════════════════════════════
   INIT ON LOAD
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {

  /* ── Try to restore a previous session ── */
  const saved = sessionStorage.getItem('fw_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      await dbRead(true);                          // force-fresh for session restore
      const fresh = DB.users.find(u => u.userId === currentUser.userId);
      if (fresh && fresh.active !== false) {
        currentUser = fresh;
        await bootApp(true);                       // DB already loaded
        return;
      }
    } catch (e) {
      console.warn('Session restore failed:', e);
    }
    // Invalid / stale session
    sessionStorage.removeItem('fw_user');
    currentUser = null;
  }

  /* ── No session — show auth screen ── */
  await dbRead(true);          // preload DB for church dropdown on Sign-Up tab
  toggleSignupFields();
  populateChurchDropdowns();

  const authEl = el('authModal');
  authEl.style.display = '';   // clear any inline style left by bootApp
  authEl.classList.add('visible');
  el('appShell').classList.add('hidden');

  switchTab('login');
});


/* ═══════════════════════════════════════════════════════════
   MOBILE DRAWER HELPERS
   (previously in an inline <script> in index.html — moved here
    so they share the same scope as all other app functions)
   ═══════════════════════════════════════════════════════════ */
function toggleSideDrawer() {
  const nav = document.getElementById('sideNav');
  const bd  = document.getElementById('sideBackdrop');
  if (nav) nav.classList.toggle('drawer-open');
  if (bd)  bd.classList.toggle('hidden');
}

function closeSideDrawer() {
  const nav = document.getElementById('sideNav');
  const bd  = document.getElementById('sideBackdrop');
  if (nav) nav.classList.remove('drawer-open');
  if (bd)  bd.classList.add('hidden');
}

function setBnavActive(btn) {
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* ── Bottom-nav badge sync ──────────────────────────────────
   Called inside the existing updateBadges() to mirror counts
   to the mobile bottom navigation bar.
   ─────────────────────────────────────────────────────────── */
function syncBottomNavBadges() {
  const cb  = document.getElementById('chatBadge');
  const nb  = document.getElementById('notifBadge');
  const bcc = document.getElementById('bnavChatBadge');
  const bnb = document.getElementById('bnavNotifBadge');
  const na  = document.getElementById('navAvatar');
  const bna = document.getElementById('bnavAvatar');

  if (cb && bcc) {
    bcc.textContent = cb.textContent;
    bcc.classList.toggle('hidden',
      cb.classList.contains('hidden') || cb.textContent === '0');
  }
  if (nb && bnb) {
    bnb.textContent = nb.textContent;
    bnb.classList.toggle('hidden',
      nb.classList.contains('hidden') || nb.textContent === '0');
  }
  if (na && bna) bna.textContent = na.textContent;
}

/* ── Auto-close drawer when a nav-item is tapped on mobile ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.side-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 900) closeSideDrawer();
    });
  });
});

/* ═══════════════════════════════════════════════════════════
   WINDOW EXPORTS
   Hosting environments that sandbox scripts (e.g. OneApp) do
   not automatically attach top-level declarations to window.
   Every function called from an HTML onclick="…" attribute
   must be explicitly assigned here so the browser can find it.
   ═══════════════════════════════════════════════════════════ */
(function attachToWindow() {
  /* ── Auth ── */
  window.doLogin            = doLogin;
  window.doSignup           = doSignup;
  window.doLogout           = doLogout;
  window.switchTab          = switchTab;
  window.toggleSignupFields = toggleSignupFields;
  window.togglePwVisibility = togglePwVisibility;

  /* ── Navigation ── */
  window.showSection        = showSection;
  window.toggleProfileMenu  = toggleProfileMenu;
  window.filterByCategory   = filterByCategory;
  window.filterJobs         = filterJobs;

  /* ── Jobs ── */
  window.openJobDetail      = openJobDetail;
  window.closeJobModal      = closeJobModal;
  window.submitJob          = submitJob;
  window.approveJob         = approveJob;
  window.rejectJob          = rejectJob;
  window.openEditJob        = openEditJob;
  window.closeEditJobModal  = closeEditJobModal;
  window.saveEditJob        = saveEditJob;

  /* ── Chat ── */
  window.startChat          = startChat;
  window.sendChatMsg        = sendChatMsg;
  window.openChat           = openChat;
  window.markJobDone        = markJobDone;

  /* ── Ratings ── */
  window.openRating         = openRating;
  window.closeRatingModal   = closeRatingModal;
  window.setRating          = setRating;
  window.submitRating       = submitRating;

  /* ── Payments ── */
  window.initPaystack       = initPaystack;
  window.closePayModal      = closePayModal;
  window.promptSubscription = promptSubscription;
  window.payMerchant        = payMerchant;

  /* ── Admin panels ── */
  window.adminTab           = adminTab;
  window.merchantTab        = merchantTab;
  window.superTab           = superTab;
  window.toggleUserActive   = toggleUserActive;
  window.createAdmin        = createAdmin;
  window.setCommission      = setCommission;
  window.deleteUser         = deleteUser;
  window.updateMerchantSetting = updateMerchantSetting;

  /* ── Mobile UI ── */
  window.toggleSideDrawer   = toggleSideDrawer;
  window.closeSideDrawer    = closeSideDrawer;
  window.setBnavActive      = setBnavActive;
})();
