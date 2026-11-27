/* ═══════════════════════════════════════════════════════════════
   SmartVotes Network — Main Application Script
   Data-integrity revision v3

   WHY DATA WAS BEING LOST (root causes, all fixed in this revision)
   ─────────────────────────────────────────────────────────────────
   1. LOST UPDATES.  The whole database is one JSONBin document.  Two
      browsers that read-then-write at the same time overwrite each
      other; the later PUT silently erases the earlier one.  The old
      "write queue" only ordered writes inside ONE browser tab.
      -> Record-level merge + verified writes + retry (see DATA LAYER).
   2. FALSE SUCCESS.  jbinPut()'s result was ignored, so a rejected or
      failed write (429, size limit, bad key) was reported to the user
      as "saved" and later discarded.
      -> Success is only reported after the server is read back.
   3. LOCAL DATA THROWN AWAY.  loadData() replaced appData and the
      local cache with the server copy, destroying anything not yet
      synced (registrations, votes made while a write was failing).
      -> loadData() now MERGES; unsynced changes live in an outbox.
   4. DELETES COULD NOT STICK / WERE UNSAFE.  mergeData() re-added any
      record a stale browser still held (deleted elections returned),
      and "Clear test data" deleted every vote of an election.
      -> Tombstones; only votes tagged isTest are cleared.
   5. UNBOUNDED PAYLOAD.  Base64 image fallbacks could push the bin over
      its size limit, after which every save failed silently.
   6. VOTE RULES CHECKED OUTSIDE THE WRITE.  Eligibility, duplicate and
      "election still open" checks now run inside the write against the
      freshest data; vote ids are deterministic so a double write
      cannot create a second vote.

   SECURITY FIXES IN THIS FILE
   ───────────────────────────
   - Removed the default-admin-password login bypass (the password sits
     in a public config file, so it let anyone in even after the admin
     changed it).
   - Stored XSS: user-supplied values are now escaped everywhere they
     are written into HTML (email/name/role/image URLs).
   - Session in localStorage stores only the user id (no password hash).
   - CSV export escapes quotes and neutralises spreadsheet formulas.
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
// Advisory only: reports problems, NEVER triggers a reset or a rewrite.
const COLLECTIONS = ['users', 'elections', 'categories', 'candidates', 'votes'];

function findIntegrityIssues(data) {
  const issues = [];
  if (!data || typeof data !== 'object') return ['Data is not an object'];
  for (const c of COLLECTIONS) if (!Array.isArray(data[c])) issues.push(`Missing collection: ${c}`);
  if (issues.length) return issues;

  const ids = new Set(), emails = new Set(), names = new Set();
  for (const u of data.users) {
    if (!u.id) { issues.push('A user record has no id'); continue; }
    if (ids.has(u.id)) issues.push(`Duplicate user id: ${u.id}`);
    ids.add(u.id);
    const em = (u.email || '').toLowerCase();
    if (!em) issues.push(`User ${u.id} has no email`);
    else if (emails.has(em)) issues.push(`Duplicate email: ${em}`);
    emails.add(em);
    const un = (u.username || '').toLowerCase();
    if (un) { if (names.has(un)) issues.push(`Duplicate username: ${un}`); names.add(un); }
  }
  return issues;
}
function validateDataIntegrity(data) { return findIntegrityIssues(data).length === 0; }

// ══════════════════════════════════════════════════════════════════
//  DATA LAYER — how SmartVotes stays correct with many users at once
// ══════════════════════════════════════════════════════════════════
//
//  JSONBin stores ONE document and has no compare-and-swap, so two
//  browsers that read-modify-write at the same moment silently
//  overwrite each other.  Instead of pretending that cannot happen,
//  the layer below makes overwrites harmless:
//
//   1. RECORD-LEVEL MERGE.  Every record has an id and an `updated`
//      stamp.  Two copies of the store are combined by taking, per id,
//      the newest version.  Merging is order-independent, so any
//      interleaving of writers converges on the same result.
//   2. TOMBSTONES.  A delete is stored as {id, deleted:true, updated}.
//      Without it, any browser holding an older copy would bring the
//      deleted record back on its next save.
//   3. OUTBOX.  Every change is written to localStorage BEFORE any
//      network call and stays there until the server is verified to
//      contain it.  Closing the tab, going offline or a 429 cannot
//      lose it; the next visit/poll finishes the job.
//   4. VERIFIED WRITES.  After each PUT we read the bin back and
//      check our changes are really in it.  If another browser
//      overwrote us, we re-merge and write again (with random jitter).
//      A save is only reported as confirmed when verification passed.
//   5. SELF-HEALING.  Each browser keeps a replica of everything it
//      has seen.  If a late overwrite (or someone wiping the bin)
//      removes records, the next sync from any browser puts them back.
//
//  This makes loss very unlikely; it cannot make it impossible while
//  the browser writes straight to a store without transactions.  See
//  the notes delivered with this file about moving writes to FastAPI.

// ── Small helpers ─────────────────────────────────────────────────
const EPOCH = '1970-01-01T00:00:00.000Z';
const LS_RAW    = `svn_raw_${JBIN_BIN || 'local'}`;      // full replica incl. tombstones
const LS_OUTBOX = `svn_outbox_${JBIN_BIN || 'local'}`;   // changes not yet confirmed
const CONFIRM_TTL_MS = 10 * 60 * 1000;                   // keep confirmed changes this long to catch late overwrites

const cloneJSON = (o) => JSON.parse(JSON.stringify(o));

function stable(v) {   // JSON with sorted keys, so equal content => equal string
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

// Monotonic "hybrid" stamp: never lower than anything this browser has seen,
// so an edit made after reading a record always beats that record, even if
// this device's clock is a little slow.
let _lastStamp = 0;
function stamp() {
  const t = Math.max(Date.now(), _lastStamp + 1);
  _lastStamp = t;
  return new Date(t).toISOString();
}
function observeStamp(iso) {
  const t = Date.parse(iso);
  if (isFinite(t) && t > _lastStamp && t < 8e15) _lastStamp = t;
}

const recTime = (r) => r.updated || r.created || r.timestamp || '';

// >0 : a is the newer/winning version, <0 : b wins, 0 : identical.
function cmpRec(a, b) {
  const ta = recTime(a), tb = recTime(b);
  if (ta !== tb) return ta > tb ? 1 : -1;
  if (!!a.deleted !== !!b.deleted) return a.deleted ? 1 : -1;
  const sa = stable(a), sb = stable(b);
  return sa === sb ? 0 : (sa > sb ? 1 : -1);
}

function emptyRaw() { return { users: [], elections: [], categories: [], candidates: [], votes: [] }; }

function normalizeRaw(x) {
  const out = (x && typeof x === 'object' && !Array.isArray(x)) ? { ...x } : {};
  for (const c of COLLECTIONS) {
    const arr = Array.isArray(out[c]) ? out[c] : [];
    out[c] = arr.filter(r => r && typeof r === 'object' && r.id !== undefined && r.id !== null && r.id !== '');
  }
  return out;
}

// Children of a deleted election/category are dropped from the store
// (they are invisible anyway) so deleting an election with thousands of
// votes does not need thousands of tombstones.
function pruneOrphans(raw) {
  const delEl  = new Set(raw.elections.filter(e => e.deleted).map(e => String(e.id)));
  const delCat = new Set(raw.categories.filter(c => c.deleted).map(c => String(c.id)));
  if (!delEl.size && !delCat.size) return raw;
  const orphan = (r) => !r.deleted && (delEl.has(String(r.electionId)) || delCat.has(String(r.categoryId)));
  raw.categories = raw.categories.filter(c => !(!c.deleted && delEl.has(String(c.electionId))));
  raw.candidates = raw.candidates.filter(c => !orphan(c));
  raw.votes      = raw.votes.filter(v => !orphan(v));
  return raw;
}

// Combine two stores: per id, the newest version wins. Never drops an id.
function mergeRaw(a, b) {
  const out = { ...a, ...b };
  for (const c of COLLECTIONS) {
    const map = new Map();
    for (const rec of [...(a[c] || []), ...(b[c] || [])]) {
      const k = String(rec.id), cur = map.get(k);
      if (!cur || cmpRec(rec, cur) > 0) map.set(k, rec);
    }
    out[c] = [...map.values()];
  }
  return pruneOrphans(out);
}

// true if store `a` already contains every record of `b` (same version or newer)
function covers(a, b) {
  for (const c of COLLECTIONS) {
    const m = new Map((a[c] || []).map(r => [String(r.id), r]));
    for (const rb of (b[c] || [])) {
      const ra = m.get(String(rb.id));
      if (!ra || cmpRec(ra, rb) < 0) return false;
    }
  }
  return true;
}

function liveView(raw) {
  const v = {};
  for (const c of COLLECTIONS) v[c] = raw[c].filter(r => !r.deleted);
  return v;
}

function applyChanges(raw, changes) {
  const patch = emptyRaw();
  for (const ch of changes || []) {
    if (ch && patch[ch.col] && ch.rec && ch.rec.id !== undefined) patch[ch.col].push(ch.rec);
  }
  return mergeRaw(raw, patch);
}

// Turn "the caller edited a copy of the data" into record-level changes.
function diffLive(before, after, ts) {
  const changes = [], removed = [];
  const stripU = (r) => { const { updated, ...rest } = r; return rest; };
  for (const c of COLLECTIONS) {
    const old = new Map((before[c] || []).map(r => [String(r.id), r]));
    const seen = new Set();
    for (const r of (after[c] || [])) {
      if (!r || r.id === undefined || r.id === null) continue;
      const k = String(r.id);
      seen.add(k);
      const prev = old.get(k);
      if (!prev || stable(stripU(prev)) !== stable(stripU(r))) changes.push({ col: c, rec: { ...r, updated: ts } });
    }
    for (const [k, prev] of old) if (!seen.has(k)) removed.push({ col: c, prev });
  }
  const delEl  = new Set(removed.filter(x => x.col === 'elections').map(x => String(x.prev.id)));
  const delCat = new Set(removed.filter(x => x.col === 'categories').map(x => String(x.prev.id)));
  for (const { col, prev } of removed) {
    const cascaded =
      (col === 'categories' && delEl.has(String(prev.electionId))) ||
      (col === 'candidates' && (delEl.has(String(prev.electionId)) || delCat.has(String(prev.categoryId)))) ||
      (col === 'votes'      && (delEl.has(String(prev.electionId)) || delCat.has(String(prev.categoryId))));
    if (!cascaded) changes.push({ col, rec: { id: prev.id, deleted: true, updated: ts } });
  }
  return changes;
}

// ── Local storage (replica, outbox, session) ──────────────────────
function lsGet() {   // LEGACY cache from older versions; only read by svnRecoverLegacyCache()
  try { return JSON.parse(localStorage.getItem('svn_data') || 'null'); } catch { return null; }
}
function lsRawGet() {
  try { return normalizeRaw(JSON.parse(localStorage.getItem(LS_RAW) || 'null')); } catch { return emptyRaw(); }
}
function lsRawPut(raw) {
  try { localStorage.setItem(LS_RAW, JSON.stringify(raw)); return true; }
  catch (e) { console.warn('SmartVotes: could not write local replica (storage full?)', e.message); return false; }
}
function outboxGet() {
  try {
    const a = JSON.parse(localStorage.getItem(LS_OUTBOX) || '[]');
    return Array.isArray(a) ? a.filter(e => e && COLLECTIONS.includes(e.col) && e.rec && e.rec.id !== undefined) : [];
  } catch { return []; }
}
function outboxSet(list) {
  let ok = true;
  try { localStorage.setItem(LS_OUTBOX, JSON.stringify(list)); }
  catch (e) { ok = false; console.error('SmartVotes: could not persist outbox!', e.message); }
  updateSyncBadge(list);
  return ok;
}
function outboxAdd(changes) {
  const map = new Map(outboxGet().map(e => [`${e.col}:${e.rec.id}`, e]));
  for (const ch of changes) {
    const k = `${ch.col}:${ch.rec.id}`, cur = map.get(k);
    if (!cur || cmpRec(ch.rec, cur.rec) > 0) map.set(k, { col: ch.col, rec: ch.rec, queuedAt: now() });
  }
  return outboxSet([...map.values()]);
}

function lsSession(u)     { localStorage.setItem('svn_session', JSON.stringify({ id: u.id })); }   // id only — never store password hashes here
function lsSessionGet()   { try { return JSON.parse(localStorage.getItem('svn_session') || 'null'); } catch { return null; } }
function lsSessionClear() { localStorage.removeItem('svn_session'); }

// Small unobtrusive badge so nobody wrongly assumes unconfirmed work is safe on the server.
function updateSyncBadge(list) {
  try {
    const pending = (list || outboxGet()).filter(e => !e.confirmedAt).length;
    let b = document.getElementById('svn-sync-badge');
    if (!pending) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div');
      b.id = 'svn-sync-badge';
      b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;background:#92400e;color:#fff;' +
        'padding:8px 12px;border-radius:8px;font:600 12px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)';
      document.body.appendChild(b);
    }
    b.textContent = `⏳ ${pending} change${pending === 1 ? '' : 's'} not yet confirmed by the server — keep this page open`;
  } catch { /* UI only */ }
}

// ── Application state derived from the replica ────────────────────
let _raw = lsRawGet();      // full store incl. tombstones
let _lastIssueKey = '';

function defaultAdminRecord(ts) {
  return {
    id: "Admin01", name: "System Administrator", username: "Admin01",
    email: "admin@smartvotes.net", password: hashStr(APP.DEFAULT_ADMIN_PASSWORD),
    gender: "Male", age: 30, phone: "09038197586", address: "",
    role: "admin", validated: "Yes", validation_code: "",
    created: ts, updated: ts
  };
}
function withAdmin(raw) {
  if (raw.users.some(u => String(u.id) === 'Admin01' && !u.deleted)) return raw;
  const hadTombstone = raw.users.some(u => String(u.id) === 'Admin01');
  raw.users = [defaultAdminRecord(hadTombstone ? stamp() : EPOCH), ...raw.users.filter(u => String(u.id) !== 'Admin01')];
  return raw;
}

// remote store (or null) + everything we know locally + our unconfirmed changes
function combine(remote) {
  let raw = mergeRaw(normalizeRaw(remote), _raw);
  raw = applyChanges(raw, outboxGet());
  return withAdmin(raw);
}

function adoptRaw(raw) {
  _raw = raw;
  for (const c of COLLECTIONS) for (const r of raw[c]) if (r.updated) observeStamp(r.updated);
  appData = liveView(raw);
  lsRawPut(mergeRaw(lsRawGet(), raw));   // merge, so a second tab's data is not overwritten
}

// Decide which outbox entries are confirmed, which must be re-sent, which can be dropped.
function settleOutbox(remote) {
  const m = {};
  for (const c of COLLECTIONS) m[c] = new Map((remote[c] || []).map(r => [String(r.id), r]));
  const t = Date.now(), keep = [];
  for (const e of outboxGet()) {
    const ra = m[e.col] && m[e.col].get(String(e.rec.id));
    const satisfied = !!ra && cmpRec(ra, e.rec) >= 0;
    if (!satisfied) { const { confirmedAt, ...rest } = e; keep.push(rest); }          // missing/overwritten: keep and re-send
    else if (!e.confirmedAt) keep.push({ ...e, confirmedAt: t });                      // first confirmation
    else if (t - e.confirmedAt < CONFIRM_TTL_MS) keep.push(e);                         // still watching for late overwrites
    // else: confirmed long enough ago -> drop
  }
  outboxSet(keep);
}

// ── Write queue (serialises writes inside this tab) ───────────────
let _writeQueue = Promise.resolve();
function enqueueWrite(fn) {
  _writeQueue = _writeQueue.then(() => fn().catch(e => {
    console.error("SmartVotes: queued write failed", e);
    return { success: false, error: e.message };
  }));
  return _writeQueue;
}

// ── JSONBin transport ─────────────────────────────────────────────
function jbinAuthHeaders(withContentType) {
  const h = {};
  if (JBIN_MASTER_KEY) h['X-Master-Key'] = JBIN_MASTER_KEY;
  else if (JBIN_ACCESS_KEY) h['X-Access-Key'] = JBIN_ACCESS_KEY;
  if (withContentType) h['Content-Type'] = 'application/json';
  return h;
}

// Returns the record, or null on ANY failure (null never means "empty").
async function jbinGet() {
  if (!JBIN_READY) return null;
  try {
    const r = await fetch(`${JBIN_URL}/b/${JBIN_BIN}/latest`, { headers: jbinAuthHeaders(false) });
    if (!r.ok) { console.warn(`SmartVotes: JSONBin GET ${r.status}`); return null; }
    const j = await r.json();
    return (j && typeof j.record === 'object' && j.record !== null) ? j.record : null;
  } catch (e) {
    console.warn("SmartVotes: JSONBin GET network error.", e.message);
    return null;
  }
}

// Returns {ok, fatal, error, ms}. ONE attempt only: on a retryable failure the caller must
// re-read a fresh baseline before writing again (retrying here with an old baseline would widen
// the window in which another browser's write can be overwritten).
async function jbinPut(data) {
  if (!JBIN_READY) return { ok: false, fatal: true, error: 'NOT_CONFIGURED' };
  const body = JSON.stringify(data);
  const limit = Number(CFG.JSONBIN_MAX_BYTES) || 0;
  if (limit && body.length > limit) {
    console.error(`SmartVotes: payload ${body.length} bytes exceeds JSONBIN_MAX_BYTES ${limit}`);
    return { ok: false, fatal: true, error: 'PAYLOAD_TOO_LARGE' };
  }
  const t0 = Date.now();
  try {
    const r = await fetch(`${JBIN_URL}/b/${JBIN_BIN}`, { method: 'PUT', headers: jbinAuthHeaders(true), body });
    const ms = Date.now() - t0;
    if (r.ok) return { ok: true, ms };
    if (r.status === 429 || r.status >= 500) {
      console.warn(`SmartVotes: JSONBin PUT ${r.status} (will retry with a fresh read)`);
      return { ok: false, fatal: false, error: `HTTP_${r.status}`, ms };
    }
    const txt = await r.text();
    console.error(`SmartVotes: JSONBin PUT ${r.status} (not retryable, ${body.length} bytes). ${txt}`);
    return { ok: false, fatal: true, error: `HTTP_${r.status}`, ms };
  } catch (e) {
    console.warn('SmartVotes: JSONBin PUT network error.', e.message);
    return { ok: false, fatal: false, error: 'NETWORK', ms: Date.now() - t0 };
  }
}

async function fetchRemoteRaw() {
  const r = await jbinGet();
  return r === null ? null : normalizeRaw(r);
}

// ── Sync primitives (always run inside the write queue, except loadData's read) ──

// Read the server, fold it into local state. Never replaces local data with remote data.
async function pullRemote() {
  const remote = await fetchRemoteRaw();           // null => unreachable
  const combined = combine(remote);                // evaluated AFTER the await so it sees the latest local state
  adoptRaw(combined);
  if (remote) settleOutbox(remote);
  return { remote, combined, reachable: !JBIN_READY || !!remote };
}

// Write everything the server is missing, then read back to prove it is there.
// Every path that ends in "synced" goes through the same verification.
async function pushPending(opts = {}) {
  if (!JBIN_READY) return { synced: true, local: true };
  const MAX_ATTEMPTS = 10, BUDGET_MS = 40000, started = Date.now();
  const backoff = (n) => sleep(Math.random() * Math.min(6000, 300 * 2 ** n));   // exponential + full jitter: colliding writers spread out
  let remote = opts.remote || null, lastError = 'REMOTE_UNAVAILABLE';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && Date.now() - started < BUDGET_MS; attempt++) {
    if (!remote) remote = await fetchRemoteRaw();
    if (!remote) { lastError = 'REMOTE_UNAVAILABLE'; await backoff(attempt); continue; }

    const combined = combine(remote);
    let proof = remote, putMs = 300, wrote = false;

    if (!covers(remote, combined)) {
      // Safety net: the merged store must never lose a record the server has. The only
      // intended drops are children of an election/category that this merge deletes.
      const delEl  = new Set(combined.elections.filter(e => e.deleted).map(e => String(e.id)));
      const delCat = new Set(combined.categories.filter(c => c.deleted).map(c => String(c.id)));
      const cascaded = (c, r) => !r.deleted && (
        (c === 'categories' && delEl.has(String(r.electionId))) ||
        (c === 'candidates' && (delEl.has(String(r.electionId)) || delCat.has(String(r.categoryId)))) ||
        (c === 'votes'      && (delEl.has(String(r.electionId)) || delCat.has(String(r.categoryId)))));
      for (const c of COLLECTIONS) {
        const have = new Set(combined[c].map(r => String(r.id)));
        const lost = (remote[c] || []).filter(r => !have.has(String(r.id)) && !cascaded(c, r));
        if (lost.length) { console.error(`SmartVotes: ABORTED write — merge would drop ${lost.length} ${c} record(s).`); return { synced: false, error: 'MERGE_GUARD', fatal: true }; }
      }

      const put = await jbinPut({ ...combined, _meta: { schema: 2, writer: _clientId, at: now() } });
      if (!put.ok) {
        lastError = put.error;
        if (put.fatal) return { synced: false, error: lastError, fatal: true };   // e.g. payload too large / bad credentials: retrying will not help
        remote = null; await backoff(attempt); continue;
      }
      wrote = true; putMs = put.ms || putMs;

      proof = await fetchRemoteRaw();                                          // read-after-write verification
      if (!proof) { lastError = 'VERIFY_UNAVAILABLE'; remote = null; await backoff(attempt); continue; }
      if (!covers(proof, combine(proof))) { lastError = 'OVERWRITTEN_BY_OTHER_WRITER'; remote = null; await backoff(attempt); continue; }
    }

    // Settle: another browser that read the bin BEFORE our write can still land its older
    // write a moment later. For critical writes (votes, sign-ups) wait that window out and
    // verify again before telling the user it is safe.
    if (opts.settle && (wrote || outboxGet().some(e => !e.confirmedAt))) {
      await sleep(Math.max(1000, Math.min(5000, 3 * putMs)));
      let again = null;
      for (let i = 0; i < 3 && !again; i++) { again = await fetchRemoteRaw(); if (!again) await sleep(400); }
      if (!again) { lastError = 'VERIFY_UNAVAILABLE'; remote = null; await backoff(attempt); continue; }
      if (!covers(again, combine(again))) { lastError = 'OVERWRITTEN_BY_OTHER_WRITER'; remote = null; await backoff(attempt); continue; }
      proof = again;
    }

    settleOutbox(proof); adoptRaw(combine(proof));
    return { synced: true, attempt };
  }
  return { synced: false, error: lastError };
}
const _clientId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

// Pull, and push if the server is missing anything. Used by polling and re-checks.
// It keeps itself scheduled while changes are unconfirmed OR the server cannot be reached,
// so work is never stranded (back-off keeps this cheap on a long outage).
let _recheckFails = 0;
async function reconcileInQueue() {
  const p = await pullRemote();
  let out = { synced: p.reachable };
  if (p.remote && !covers(p.remote, p.combined)) out = await pushPending({ remote: p.remote });
  const pending = outboxGet().length > 0;
  const stuck = JBIN_READY && pending && (!p.remote || out.synced === false);
  if (stuck) {
    _recheckFails++;
    scheduleRecheck(out.fatal ? 300000 : Math.min(300000, 15000 * 2 ** Math.min(_recheckFails - 1, 4)));
  } else {
    _recheckFails = 0;
  }
  out.synced = out.synced && outboxGet().every(e => e.confirmedAt);
  return out;
}

let _recheckTimer = null;
function scheduleRecheck(ms = 4000) {   // catches an overwrite that lands just after our verification
  if (!JBIN_READY) return;
  clearTimeout(_recheckTimer);
  _recheckTimer = setTimeout(() => { enqueueWrite(reconcileInQueue).then(() => { try { _refreshVisiblePanels(); } catch {} }); }, ms);
}

let _healQueued = false;
function scheduleHeal() {
  if (_healQueued) return;
  _healQueued = true;
  enqueueWrite(async () => { _healQueued = false; return reconcileInQueue(); });
}

// ── Public data API ───────────────────────────────────────────────

// Refresh appData from the server WITHOUT discarding anything local.
async function loadData() {
  const p = await pullRemote();
  const issues = findIntegrityIssues(appData);
  const key = issues.join('|');
  if (issues.length && key !== _lastIssueKey) {
    console.warn('SmartVotes: integrity issues (data kept as-is):', issues);
    if (currentUser && currentUser.role === 'admin') showToast(`Data check: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}`, 'warning');
  }
  _lastIssueKey = key;
  if (p.remote && !covers(p.remote, p.combined)) scheduleHeal();   // server is missing something we hold
  return appData;
}

// Apply a change to the data.  fn(data) edits a private copy; throw to abort.
// Resolves to { success, synced, error, data }:
//   success=false           -> nothing was changed (e.g. DUPLICATE_EMAIL, or fn threw)
//   success=true, synced    -> change is on the server and verified
//   success=true, !synced   -> change is safe on this device and will keep retrying
async function mutate(fn, options = {}) {
  const pull = await pullRemote();                                   // fresh baseline
  if (options.requireRemote && !pull.reachable) return { success: false, error: 'REMOTE_UNAVAILABLE', data: appData };

  const working = cloneJSON(appData);
  let result;
  try { result = fn(working); }
  catch (e) { return { success: false, error: e.message, data: appData }; }   // business rule failed: abort, no retry
  const finalData = (result && Array.isArray(result.users)) ? result : working;

  const changes = diffLive(appData, finalData, stamp());
  if (!changes.length) return { success: true, noop: true, synced: true, data: appData };

  if (JBIN_READY) outboxAdd(changes);                               // durable BEFORE any network write
  adoptRaw(applyChanges(_raw, changes));                            // UI shows the change immediately
  const push = await pushPending({ remote: pull.remote, settle: !!options.settle });
  scheduleRecheck();
  return { success: true, synced: !!push.synced, error: push.synced ? undefined : push.error, data: appData };
}
function saveData(fn, options) { return enqueueWrite(() => mutate(fn, options)); }

// One-off, deliberate recovery: run svnRecoverLegacyCache() in the browser console on a device
// that still holds the OLD cache. Re-adds records that exist nowhere in the current store.
window.svnRecoverLegacyCache = async function () {
  const legacy = normalizeRaw(lsGet());
  const ts = stamp(), changes = [];
  for (const c of COLLECTIONS) {
    const known = new Set(_raw[c].map(r => String(r.id)));
    for (const r of legacy[c]) if (!known.has(String(r.id))) changes.push({ col: c, rec: { ...r, updated: ts } });
  }
  if (!changes.length) return 'Nothing to recover: every record in the old cache already exists.';
  outboxAdd(changes);
  adoptRaw(applyChanges(_raw, changes));
  await enqueueWrite(() => pushPending());
  return `Recovered ${changes.length} record(s) from the old cache.`;
};

// ── Background polling ────────────────────────────────────────────
const POLL_INTERVAL = 45000;
let   _pollTimer    = null;

function startPolling() {
  stopPolling();
  const tick = () => {
    _pollTimer = setTimeout(async () => {
      if (!currentUser) return;                                       // logged out: stop
      if (!document.hidden) {
        await enqueueWrite(reconcileInQueue);
        try { _refreshVisiblePanels(); } catch (e) { console.warn('SmartVotes: refresh error', e); }
      }
      tick();
    }, POLL_INTERVAL + Math.random() * 10000);                         // jitter spreads load on the API
  };
  tick();
}
function stopPolling() { if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; } }

if (typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => { scheduleHeal(); });        // flush the outbox as soon as connectivity returns
}
if (typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden && currentUser) scheduleHeal(); });
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

// Tells the user the truth about a save result. Returns true if the change was applied.
const SAVE_ERRORS = {
  PARENT_GONE:        'The election or category this belongs to was deleted by someone else. Nothing was saved.',
  HAS_REAL_VOTES:     'This election already has real votes. Test mode is only for elections without real votes.',
  REMOTE_UNAVAILABLE: 'Cannot reach the server right now. Nothing was saved — please try again.',
};
const SYNC_FATAL = {
  PAYLOAD_TOO_LARGE: 'The data store is full. Your change is kept on this device only — contact the administrator.',
  HTTP_400:          'The server rejected the save (data store may be full). Your change is kept on this device only — contact the administrator.',
  HTTP_401:          'The server refused the save (credentials). Your change is kept on this device only — contact the administrator.',
  HTTP_403:          'The server refused the save (credentials). Your change is kept on this device only — contact the administrator.',
  HTTP_404:          'The data store could not be found. Your change is kept on this device only — contact the administrator.',
};
function notifySave(res, okMsg, okType = 'success') {
  if (!res || !res.success) {
    showToast(SAVE_ERRORS[res?.error] || 'Could not save your change. Nothing was modified — please try again.', 'error');
    return false;
  }
  if (res.synced === false) {
    showToast(SYNC_FATAL[res.error] || 'Saved on this device but not yet confirmed by the server. It will keep retrying — please keep this page open.', 'warning');
  } else if (okMsg) {
    showToast(okMsg, okType);
  }
  return true;
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
    console.warn("Firebase upload failed.", e);
    // A big base64 image would bloat the shared data store (JSONBin has a size limit, and once
    // it is exceeded EVERY save fails). Only tiny images may be embedded as a fallback.
    const dataUrl = await fileToBase64(file);
    if (dataUrl.length <= 30000) return dataUrl;
    throw new Error('IMAGE_UPLOAD_FAILED');
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
    ((u.email || '').toLowerCase() === email || u.username?.toLowerCase() === email) &&
    u.password === hashStr(password)
  );
  // (The old "default admin password always works" bypass was removed: that password is
  //  readable in the public config file, so it defeated any password change.)
  const matched = user || null;

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
      showAlert('validate-alert', 'Could not save your verification. Please try again.', 'error');
      setLoading('btn-validate', false, 'Verify Email');
      return;
    }
    if (saveResult.synced === false) notifySave(saveResult);   // saved locally, will keep retrying

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
      // Do NOT email a code that was not stored — it would never match.
      showToast("Could not generate a new code. Please try again.", "error");
      return;
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
      if (data.users.some(u => (u.email || '').toLowerCase() === email)) {
        throw new Error("DUPLICATE_EMAIL");
      }
      if (data.users.some(u => u.username?.toLowerCase() === username.toLowerCase())) {
        throw new Error("DUPLICATE_USERNAME");
      }
      data.users.push(newUser);
      return data;
    }, { requireRemote: true, settle: true });   // never create an account blind: the duplicate check needs the live server data

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
        setLoading('btn-register', false, 'Create Account →');
        showAlert('register-alert', 'Cannot reach the server right now. Please check your connection and try again.', 'error'); return;
      }
      throw new Error(saveResult?.error || "Unknown save error");
    }
    if (saveResult.synced === false) notifySave(saveResult);   // saved locally, will keep retrying

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
        ${e.image ? `<img src="${esc(e.image)}" style="width:100%;height:100%;object-fit:cover"/>` : '🗳️'}
      </div></td>
      <td><strong>${esc(e.title)}</strong></td>
      <td style="font-size:0.8rem;font-family:var(--font-mono)">${fmtDT(e.start)}</td>
      <td style="font-size:0.8rem;font-family:var(--font-mono)">${fmtDT(e.end)}</td>
      <td>${statusBadge(e)}</td>
      <td><span class="badge ${e.viewStatus === 'visible' ? 'badge-success' : 'badge-neutral'}">${esc(e.viewStatus || 'hidden')}</span></td>
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
  if (imgInput?.files?.length) {
    try { imageUrl = await firebaseUpload(imgInput.files[0], `elections/${uid()}`); }
    catch (e) {
      setLoading('btn-save-election', false, 'Save Election');
      showAlert('election-form-alert', 'Image upload failed. Check your connection or use a smaller image, then try again.', 'error'); return;
    }
  }

  const capId = editingId;

  const res = await saveData(data => {
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
  if (!res || !res.success) { notifySave(res); return; }   // keep the form open so nothing typed is lost
  closeModal('modal-election');
  renderElectionsTable(); renderOverviewElections(); refreshAdminStats(); populateElectionSelects();
  notifySave(res, capId ? 'Election updated!' : 'Election created!');
  editingId = null;
}

async function toggleViewStatus(id) {
  const res = await saveData(data => {
    const e = data.elections.find(x => x.id === id);
    if (e) e.viewStatus = e.viewStatus === 'visible' ? 'hidden' : 'visible';
    return data;
  });
  renderElectionsTable();
  const e = appData.elections.find(x => x.id === id);
  notifySave(res, `Election is now ${e?.viewStatus || 'updated'}.`, 'info');
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

  const res = await saveData(data => {
    if (!data.elections.some(e => e.id === elId)) throw new Error('PARENT_GONE');
    if (capId) {
      const idx = data.categories.findIndex(c => c.id === capId);
      if (idx >= 0) data.categories[idx] = { ...data.categories[idx], electionId: elId, name, description: v('cat-desc'), updated: now() };
    } else {
      data.categories.push({ id: uid(), electionId: elId, name, description: v('cat-desc'), created: now() });
    }
    return data;
  });

  setLoading('btn-save-category', false, 'Save Category');
  if (!res || !res.success) { notifySave(res); return; }
  closeModal('modal-category'); renderCategoriesTable(); populateCandidateFilters();
  notifySave(res, capId ? 'Category updated!' : 'Category created!');
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
        ${c.photo ? `<img src="${esc(c.photo)}" style="width:100%;height:100%;object-fit:cover"/>` : '👤'}
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
  if (pInput?.files?.length) {
    try { photoUrl = await firebaseUpload(pInput.files[0], `candidates/${uid()}`); }
    catch (e) {
      setLoading('btn-save-candidate', false, 'Save Candidate');
      showAlert('cand-form-alert', 'Photo upload failed. Check your connection or use a smaller image, then try again.', 'error'); return;
    }
  }

  const capId = editingId;

  const res = await saveData(data => {
    if (!data.elections.some(e => e.id === elId) || !data.categories.some(c => c.id === catId && c.electionId === elId)) throw new Error('PARENT_GONE');
    if (capId) {
      const idx = data.candidates.findIndex(c => c.id === capId);
      if (idx >= 0) data.candidates[idx] = { ...data.candidates[idx], name, electionId: elId, categoryId: catId, updated: now(), ...(photoUrl ? { photo: photoUrl } : {}) };
    } else {
      data.candidates.push({ id: uid(), name, electionId: elId, categoryId: catId, photo: photoUrl, created: now() });
    }
    return data;
  });

  setLoading('btn-save-candidate', false, 'Save Candidate');
  if (!res || !res.success) { notifySave(res); return; }
  closeModal('modal-candidate'); renderCandidatesTable(); refreshAdminStats();
  notifySave(res, capId ? 'Candidate updated!' : 'Candidate added!');
  editingId = null;
}

// ── Users Table ───────────────────────────────────────────────────
function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = appData.users.map(u => `
    <tr data-search="${esc((u.name+u.email+u.username).toLowerCase())}">
      <td><strong>${esc(u.name)}</strong></td>
      <td style="font-family:var(--font-mono);font-size:0.82rem">${esc(u.username||'—')}</td>
      <td style="font-size:0.82rem">${esc(u.email)}</td>
      <td>${esc(u.gender||'—')}</td><td>${esc(u.age||'—')}</td>
      <td style="font-size:0.82rem">${esc(u.phone||'—')}</td>
      <td><span class="badge ${u.validated==='Yes'?'badge-success':'badge-warning'}">${esc(u.validated||'No')}</span></td>
      <td><span class="badge ${u.role==='admin'?'badge-purple':'badge-green'}">${esc(u.role||'voter')}</span></td>
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
    u.email     = newEmail;
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
  notifySave(saveResult, 'User updated!'); editingUserId = null;
}

// ── Delete confirm ────────────────────────────────────────────────
function confirmDelete(type, id) {
  const msgs = {
    election:  'This will permanently delete the election and all its categories, candidates and votes.',
    category:  'This will delete this category and its candidates.',
    candidate: 'This will delete this candidate.',
    user:      'This will permanently delete this user account.'
  };

  if (type === 'user' && id === 'Admin01') { showToast('The main administrator account cannot be deleted.', 'warning'); return; }

  // Deleting an election with real votes destroys them irreversibly: require a typed confirmation.
  if (type === 'election') {
    const el   = appData.elections.find(e => e.id === id);
    const real = appData.votes.filter(v => v.electionId === id && !v.isTest).length;
    if (real > 0) {
      const typed = window.prompt(
        `"${el?.title || 'This election'}" has ${real} recorded vote(s).\n` +
        `Deleting it permanently destroys them and cannot be undone.\n\nType DELETE to continue:`);
      if (typed === null || typed.trim() !== 'DELETE') { showToast('Deletion cancelled — nothing was changed.', 'info'); return; }
    }
  }

  openConfirmModal(`Delete ${type}?`, msgs[type]||'Are you sure?', '⚠️', async () => {
    const res = await saveData(data => {
      if (type === 'election')  {
        data.elections  = data.elections.filter(e => e.id !== id);
        data.categories = data.categories.filter(c => c.electionId !== id);
        data.candidates = data.candidates.filter(c => c.electionId !== id);
        data.votes      = data.votes.filter(v => v.electionId !== id);
      } else if (type === 'category')  {
        data.categories = data.categories.filter(c => c.id !== id);
        data.candidates = data.candidates.filter(c => c.categoryId !== id);
        data.votes      = data.votes.filter(v => v.categoryId !== id);
      } else if (type === 'candidate') {
        data.candidates = data.candidates.filter(c => c.id !== id);
      } else if (type === 'user') {
        data.users = data.users.filter(u => u.id !== id);
      }
      return data;
    });

    if (!res || !res.success) { notifySave(res); return; }
    if (type === 'election')  { renderElectionsTable(); renderOverviewElections(); }
    if (type === 'category')  renderCategoriesTable();
    if (type === 'candidate') renderCandidatesTable();
    if (type === 'user')      renderUsersTable();
    refreshAdminStats();
    notifySave(res, `${type} deleted.`);
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
      ${e.image ? `<div class="election-card-img"><img src="${esc(e.image)}" alt="${esc(e.title)}"/></div>` : ''}
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
      ${e.image ? `<div class="election-card-img"><img src="${esc(e.image)}" alt="${esc(e.title)}"/></div>` : ''}
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
            <div class="candidate-photo">${c.photo?`<img src="${esc(c.photo)}" alt="${esc(c.name)}"/>`:'👤'}</div>
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
// Every rule (eligibility, election open, valid candidate, one vote per
// category) is checked INSIDE the write, against the freshest data, so a
// concurrent admin change or a second device cannot slip past it.
// Vote ids are deterministic (election+category+voter): even if the same
// vote were written twice it merges into ONE record, never a double count.
async function submitVotes() {
  if (!currentUser || !votingElection) return;

  setLoading('btn-submit-votes', true, 'Submitting…');
  const voterId    = currentUser.id;
  const elId       = votingElection.id;
  const timestamp  = now();
  const selections = { ...voteSelections };

  const res = await saveData(data => {
    const me = data.users.find(u => u.id === voterId);
    if (!me) throw new Error('USER_GONE');
    if (me.validated !== 'Yes' && me.role !== 'admin') throw new Error('NOT_VALIDATED');

    const el = data.elections.find(e => e.id === elId);
    if (!el) throw new Error('ELECTION_GONE');
    const status = computeStatus(el);
    if (status !== 'active' && status !== 'test') throw new Error('ELECTION_CLOSED');

    const cats    = data.categories.filter(c => c.electionId === elId);
    const already = new Set(data.votes.filter(v => v.voterId === voterId && v.electionId === elId).map(v => v.categoryId));
    const missing = cats.filter(cat =>
      !already.has(cat.id) && !selections[cat.id] && data.candidates.some(c => c.categoryId === cat.id));
    if (missing.length) throw new Error('MISSING:' + missing.map(c => c.name).join(', '));

    const newVotes = [];
    for (const cat of cats) {
      if (already.has(cat.id) || !selections[cat.id]) continue;
      const cand = data.candidates.find(c => c.id === selections[cat.id] && c.categoryId === cat.id);
      if (!cand) throw new Error('INVALID_CANDIDATE');
      newVotes.push({
        id: `vote_${elId}_${cat.id}_${voterId}`,
        electionId: elId, categoryId: cat.id, candidateId: cand.id, voterId, timestamp,
        ...(status === 'test' ? { isTest: true } : {})
      });
    }
    if (!newVotes.length) throw new Error('ALREADY_VOTED');

    data.votes.push(...newVotes);
    return data;
  }, { settle: true });   // wait out the late-overwrite window before saying "cast"

  setLoading('btn-submit-votes', false, '🗳️ Submit Votes');

  if (!res || !res.success) {
    const e = res?.error || '';
    const msg =
      e === 'ALREADY_VOTED'      ? 'You have already voted in this election.' :
      e === 'ELECTION_CLOSED'    ? 'This election is not open for voting right now.' :
      e === 'ELECTION_GONE'      ? 'This election no longer exists.' :
      e === 'INVALID_CANDIDATE'  ? 'A candidate you selected was changed by the administrator. Please reopen the ballot and choose again.' :
      e === 'USER_GONE' || e === 'NOT_VALIDATED' ? 'Your account is not eligible to vote. Please sign in again.' :
      e.startsWith('MISSING:')   ? `Please select a candidate for: ${e.slice(8)}` :
      'Your vote could not be recorded. Nothing was submitted — please try again.';
    showAlert('vote-alert', msg, 'error');
    return;
  }

  voteSelections = {};
  closeModal('modal-vote');
  notifySave(res, '🎉 Your vote has been cast successfully!');
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
  const res = await saveData(data => {
    const el = data.elections.find(e => e.id === elId);
    if (!el) return data;
    // Never mix test mode into an election that already holds real votes.
    if (data.votes.some(x => x.electionId === elId && !x.isTest)) throw new Error('HAS_REAL_VOTES');
    el.status = 'test';
    return data;
  });
  closeModal('modal-test-election'); renderElectionsTable();
  const el = appData.elections.find(e => e.id === elId);
  notifySave(res, `"${el?.title}" is now in test mode.`, 'info');
}

async function adminClearTest() {
  const testEls = appData.elections.filter(e => e.status === 'test');
  if (!testEls.length) { showToast('No test elections to clear.','info'); return; }
  openConfirmModal('Clear Test Elections?',
    `This clears test status for ${testEls.length} election(s) and deletes only the votes that were cast in test mode. Real votes are never touched.`,
    '🧹', async () => {
    const testIds = new Set(testEls.map(e => e.id));
    const untagged = appData.votes.filter(x => testIds.has(x.electionId) && x.isTest !== true).length;
    let removed = 0;
    const res = await saveData(data => {
      data.elections.forEach(e => { if (testIds.has(e.id)) e.status = 'upcoming'; });
      const before = data.votes.length;
      data.votes = data.votes.filter(x => !(testIds.has(x.electionId) && x.isTest === true));
      removed = before - data.votes.length;
      return data;
    });
    renderElectionsTable(); refreshAdminStats();
    if (notifySave(res, `Test data cleared (${removed} test vote${removed === 1 ? '' : 's'} removed).`) && untagged) {
      showToast(`${untagged} vote(s) without a test tag were kept (they may be real). Delete the election to remove them.`, 'info');
    }
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

function csvCell(val) {
  let t = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;          // stop spreadsheet formula injection
  return '"' + t.replace(/"/g, '""') + '"';
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
      csv += `${csvCell(cat.name)},${csvCell(c.name)},${cnt},${votes.length ? Math.round(cnt/votes.length*100) : 0}%\n`;
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
  c.innerHTML = `<div class="alert alert-${type}"><span class="alert-icon">${icons[type]||'ℹ️'}</span>${esc(msg)}</div>`;
}
function clearAlert(containerId) { const c=document.getElementById(containerId); if(c) c.innerHTML=''; }

function showToast(msg, type='info') {
  const container=document.getElementById('toast-container'), icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const toast=document.createElement('div'); toast.className=`toast ${type}`;
  toast.innerHTML=`<span class="toast-icon">${icons[type]||'ℹ️'}</span>${esc(msg)}`;
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
  adoptRaw(combine(null));        // show the last known data immediately (own replica + unconfirmed changes)
  _initHamburger();
  await loadData();               // MERGE with the server — never overwrites anything held locally
  if (JBIN_READY && outboxGet().some(e => !e.confirmedAt)) scheduleHeal();   // finish work a closed tab left behind

  const session = lsSessionGet();
  if (session) {
    const user = appData.users.find(u => u.id === session.id);
    if (user && user.validated === 'Yes') {
      currentUser = user;
      updateHeaderForUser(user);
      startPolling();
    } else if (user && user.validated === 'No') {
      lsSessionClear();           // un-validated accounts do not keep a session
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
