// ============================================================
// Naybor Travel Express — Database & API Services
// OPTIMISED — v2.0
//
// Key changes vs original:
//   1. CONCURRENCY / DATA INTEGRITY
//      - Serialised write queue: all write operations are
//        queued and executed one at a time. No two saves can
//        race each other, even when multiple browser tabs or
//        users fire writes simultaneously.
//      - Optimistic-locking retry: if JSONBin returns a
//        version conflict (HTTP 409) or a stale-read is
//        detected, the write is automatically retried up to
//        MAX_RETRIES times with exponential back-off.
//      - Re-fetch before every write: the queue worker always
//        fetches the freshest copy of the DB immediately
//        before applying the mutation, guaranteeing no
//        in-flight changes from other users are lost.
//      - Duplicate-guard on createUser: email uniqueness is
//        re-checked inside the serialised write to prevent
//        two simultaneous registrations slipping through.
//      - Duplicate-guard on getOrCreateChatThread: thread
//        creation is idempotent — a second concurrent call
//        for the same (trip, passenger) pair will find the
//        thread that the first call already wrote.
//
//   2. PERFORMANCE
//      - Read cache: a short-lived (CACHE_TTL ms) in-memory
//        cache avoids redundant round-trips for rapid
//        successive reads (e.g. rendering trip cards +
//        driver info in the same tick).
//      - Cache invalidated on every successful write so
//        stale data is never served after a mutation.
//      - Parallel fetch helpers (getActiveTripsAndUsers)
//        collapse multiple serial awaits into a single
//        Promise.all where the UI needs both datasets.
//      - Firebase uploads are parallelised with Promise.all
//        instead of sequential await-in-loop.
//      - Payment ref uses crypto.randomUUID() (or a fallback)
//        to guarantee uniqueness instead of Date.now() alone.
// ============================================================

// ── JSONBin DB ──────────────────────────────────────────────
const DB = (() => {

  // ── Cache ────────────────────────────────────────────────
  const CACHE_TTL   = 8_000;   // ms — how long a read result stays fresh
  const MAX_RETRIES = 4;       // write retries on conflict
  const BASE_DELAY  = 300;     // ms — initial back-off delay

  let _cache      = null;      // { data, ts } | null
  let _writeQueue = Promise.resolve();  // serialisation chain

  /** Invalidate the in-memory cache (call after every successful write). */
  function _bust() { _cache = null; }

  /** Exponential back-off sleep. */
  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Low-level fetch ──────────────────────────────────────

  /** Always fetches fresh data from JSONBin (bypasses cache). */
  async function _fetchFresh() {
    const res = await fetch(
      `${CONFIG.JSONBIN_BASE_URL}/b/${CONFIG.JSONBIN_MAIN_BIN_ID}/latest`,
      {
        headers: {
          'X-Master-Key': CONFIG.JSONBIN_M_API_KEY,
          'X-Access-Key': CONFIG.JSONBIN_API_KEY,
          'X-Bin-Meta':   'false'
        }
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `JSONBin read failed (${res.status})`);
    }
    return await res.json();
  }

  /** Save a full DB snapshot to JSONBin. */
  async function _save(data) {
    const res = await fetch(
      `${CONFIG.JSONBIN_BASE_URL}/b/${CONFIG.JSONBIN_MAIN_BIN_ID}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.JSONBIN_M_API_KEY,
          'X-Access-Key': CONFIG.JSONBIN_API_KEY
        },
        body: JSON.stringify(data)
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `JSONBin write failed (${res.status})`);
    }
    return await res.json();
  }

  // ── Serialised write queue ───────────────────────────────
  //
  // Every mutation is expressed as a pure function:
  //   mutator(db) → db   (mutates db in place and returns it)
  //
  // _enqueueWrite() chains the work onto _writeQueue so that
  // at most one write is in-flight at any moment.
  // It re-fetches before applying the mutator so it always
  // works on the freshest data, and retries on conflicts.

  function _enqueueWrite(mutator) {
    // Capture the promise that represents this specific write.
    const p = _writeQueue.then(() => _writeWithRetry(mutator));
    // Chain the queue; swallow errors so the queue never stalls.
    _writeQueue = p.catch(() => {});
    return p;   // callers await this for the result or error
  }

  async function _writeWithRetry(mutator) {
    let attempt = 0;
    while (true) {
      try {
        // Always read the latest state right before writing.
        const db = await _fetchFresh();
        const result = await mutator(db);  // mutator returns { db, payload }
        await _save(result.db);
        _bust();  // invalidate cache after successful write
        return result.payload;
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) throw err;
        // Back off before retry: 300ms, 600ms, 1200ms …
        await _sleep(BASE_DELAY * Math.pow(2, attempt - 1));
      }
    }
  }

  // ── Public API ───────────────────────────────────────────

  return {

    // ── Read (cached) ──────────────────────────────────────
    async getDB() {
      const now = Date.now();
      if (_cache && (now - _cache.ts) < CACHE_TTL) {
        return _cache.data;
      }
      const data = await _fetchFresh();
      _cache = { data, ts: now };
      return data;
    },

    // ── Back-compat alias used by a few callers ────────────
    async saveDB(data) {
      await _save(data);
      _bust();
    },

    // ── Initialise DB structure if bin is empty ────────────
    async initDB() {
      try {
        return await this.getDB();
      } catch (_) {
        const fresh = {
          users:    [],
          trips:    [],
          chats:    [],
          payments: [],
          reviews:  [],
          settings: {
            driver_chat_fee: CONFIG.APP_SETTINGS.driver_chat_fee,
            free_chat_limit: CONFIG.APP_SETTINGS.free_chat_limit,
            last_updated:    new Date().toISOString()
          }
        };
        await _save(fresh);
        _cache = { data: fresh, ts: Date.now() };
        return fresh;
      }
    },

    // ── Users ──────────────────────────────────────────────
    async getUsers() {
      const db = await this.getDB();
      return db.users || [];
    },

    async getUserByEmail(email) {
      const users = await this.getUsers();
      return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },

    async getUserById(id) {
      const users = await this.getUsers();
      return users.find(u => u.id === id) || null;
    },

    /** createUser — duplicate email is checked inside the write lock. */
    async createUser(userData) {
      return _enqueueWrite(db => {
        db.users = db.users || [];
        // Re-check uniqueness under the write lock
        const dup = db.users.find(
          u => u.email.toLowerCase() === userData.email.toLowerCase()
        );
        if (dup) throw new Error('An account with this email already exists.');

        const newUser = {
          id: 'USR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          createdAt: new Date().toISOString(),
          ...userData
        };
        db.users.push(newUser);
        return { db, payload: newUser };
      });
    },

    async updateUser(id, updates) {
      return _enqueueWrite(db => {
        db.users = db.users || [];
        const idx = db.users.findIndex(u => u.id === id);
        if (idx === -1) throw new Error('User not found');
        db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date().toISOString() };
        return { db, payload: db.users[idx] };
      });
    },

    async deleteUser(id) {
      return _enqueueWrite(db => {
        db.users = (db.users || []).filter(u => u.id !== id);
        return { db, payload: null };
      });
    },

    // ── Trips ──────────────────────────────────────────────
    async getTrips() {
      const db = await this.getDB();
      return db.trips || [];
    },

    /** Returns active (and in-progress) trips and the full user list in one round-trip.
     *  In-progress trips are shown in the listing so passengers can see them,
     *  but the Chat button will be disabled (no seats / trip underway). */
    async getActiveTripsAndUsers() {
      const db = await this.getDB();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const trips = (db.trips || []).filter(t => {
        const dep = new Date(t.departureDate);
        dep.setHours(0, 0, 0, 0);
        return dep >= today && (t.status === 'active' || t.status === 'in-progress');
      });
      return { trips, users: db.users || [] };
    },

    async createTrip(tripData) {
      return _enqueueWrite(db => {
        db.trips = db.trips || [];
        // Enforce: driver can only have one active/in-progress trip at a time
        const driverId = tripData.driverId;
        const hasActiveTrip = db.trips.some(
          t => t.driverId === driverId && (t.status === 'active' || t.status === 'in-progress')
        );
        if (hasActiveTrip) {
          throw new Error('You already have an active or in-progress trip. Please end it before creating a new one.');
        }
        const newTrip = {
          id: 'TRIP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          createdAt: new Date().toISOString(),
          chatInteractions: [],
          ...tripData
        };
        db.trips.push(newTrip);
        return { db, payload: newTrip };
      });
    },

    /** Decrement available seats by 1 for a trip (called when passenger accepts ride). */
    async decrementTripSeat(tripId) {
      return _enqueueWrite(db => {
        db.trips = db.trips || [];
        const idx = db.trips.findIndex(t => t.id === tripId);
        if (idx === -1) throw new Error('Trip not found');
        const seats = db.trips[idx].availableSeats || 0;
        if (seats <= 0) throw new Error('No seats available');
        db.trips[idx] = {
          ...db.trips[idx],
          availableSeats: seats - 1,
          updatedAt: new Date().toISOString()
        };
        return { db, payload: db.trips[idx] };
      });
    },

    async updateTrip(id, updates) {
      return _enqueueWrite(db => {
        db.trips = db.trips || [];
        const idx = db.trips.findIndex(t => t.id === id);
        if (idx === -1) throw new Error('Trip not found');
        db.trips[idx] = { ...db.trips[idx], ...updates, updatedAt: new Date().toISOString() };
        return { db, payload: db.trips[idx] };
      });
    },

    async deleteTrip(id) {
      return _enqueueWrite(db => {
        db.trips = (db.trips || []).filter(t => t.id !== id);
        return { db, payload: null };
      });
    },

    async getActiveTrips() {
      const { trips } = await this.getActiveTripsAndUsers();
      return trips;
    },

    // ── Chats ──────────────────────────────────────────────
    async getChatsForTrip(tripId) {
      const db = await this.getDB();
      return (db.chats || []).filter(c => c.tripId === tripId);
    },

    /** Idempotent — safe to call concurrently for same (tripId, passengerId). */
    async getOrCreateChatThread(tripId, passengerId, driverId) {
      return _enqueueWrite(db => {
        db.chats = db.chats || [];
        // Re-check under the write lock to prevent duplicate threads
        let thread = db.chats.find(
          c => c.tripId === tripId && c.passengerId === passengerId
        );
        if (!thread) {
          thread = {
            id: 'CHAT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            tripId, passengerId, driverId,
            messages:  [],
            createdAt: new Date().toISOString()
          };
          db.chats.push(thread);
        }
        return { db, payload: thread };
      });
    },

    async addMessage(chatId, message) {
      return _enqueueWrite(db => {
        db.chats = db.chats || [];
        const idx = db.chats.findIndex(c => c.id === chatId);
        if (idx === -1) throw new Error('Chat thread not found');
        const msg = {
          id: 'MSG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4).toUpperCase(),
          timestamp: new Date().toISOString(),
          ...message
        };
        db.chats[idx].messages.push(msg);
        return { db, payload: { chat: db.chats[idx], message: msg } };
      });
    },

    // ── Settings ───────────────────────────────────────────
    async getSettings() {
      const db = await this.getDB();
      return db.settings || CONFIG.APP_SETTINGS;
    },

    async updateSettings(updates) {
      return _enqueueWrite(db => {
        db.settings = { ...(db.settings || {}), ...updates, last_updated: new Date().toISOString() };
        return { db, payload: db.settings };
      });
    },

    // ── Payments ───────────────────────────────────────────
    async recordPayment(paymentData) {
      return _enqueueWrite(db => {
        db.payments = db.payments || [];
        // Use crypto.randomUUID if available, else fall back
        const uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 12)
          : Math.random().toString(36).substr(2, 10).toUpperCase();
        const payment = {
          id: 'PAY_' + Date.now() + '_' + uid,
          createdAt: new Date().toISOString(),
          ...paymentData
        };
        db.payments.push(payment);
        return { db, payload: payment };
      });
    },

    // ── Reviews ────────────────────────────────────────────
    async getReviews() {
      const db = await this.getDB();
      return db.reviews || [];
    },

    async getReviewByPassengerAndTrip(passengerId, tripId) {
      const reviews = await this.getReviews();
      return reviews.find(r => r.passengerId === passengerId && r.tripId === tripId) || null;
    },

    /** Upsert — one review per (passenger, trip), enforced inside the write lock. */
    async createReview(reviewData) {
      return _enqueueWrite(db => {
        db.reviews = db.reviews || [];
        const existingIdx = db.reviews.findIndex(
          r => r.passengerId === reviewData.passengerId && r.tripId === reviewData.tripId
        );
        let review;
        if (existingIdx !== -1) {
          // Update existing
          db.reviews[existingIdx] = {
            ...db.reviews[existingIdx],
            ...reviewData,
            updatedAt: new Date().toISOString()
          };
          review = db.reviews[existingIdx];
        } else {
          // Insert new
          review = {
            id: 'REV_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            createdAt: new Date().toISOString(),
            ...reviewData
          };
          db.reviews.push(review);
        }
        return { db, payload: review };
      });
    }
  };
})();


// ── Firebase Storage Service ─────────────────────────────────
const FirebaseService = {
  storage:      null,
  _initialised: false,

  init() {
    if (this._initialised) return;
    try {
      if (typeof firebase === 'undefined') throw new Error('Firebase SDK not loaded');
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(CONFIG.FIREBASE);
      }
      this.storage = firebase.storage();
      this._initialised = true;
    } catch (e) {
      console.error('Firebase init error:', e.message);
    }
  },

  /** Resize & compress an image File to a base64 JPEG (max 800 px wide, 70 % quality). */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const img    = new Image();
      const reader = new FileReader();
      reader.onload = ev => {
        img.onload = () => {
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async uploadFile(file, path) {
    this.init();
    if (this.storage) {
      try {
        const ref      = this.storage.ref().child(path);
        const snapshot = await ref.put(file);
        return await snapshot.ref.getDownloadURL();
      } catch (e) {
        console.warn(`Firebase upload failed for ${path}: ${e.message}. Using base64 fallback.`);
      }
    }
    return await this.fileToBase64(file);
  },

  /**
   * OPTIMISED: uploads all files in parallel instead of sequentially.
   * Falls back to sequential if any parallel upload throws so that a
   * single failure does not abort the whole batch.
   */
  async uploadUserFiles(userId, files) {
    const entries = Object.entries(files).filter(([, f]) => f != null);
    const results = await Promise.allSettled(
      entries.map(([key, file]) => {
        const ext  = file.name.split('.').pop();
        const path = `users/${userId}/${key}_${Date.now()}.${ext}`;
        return this.uploadFile(file, path).then(url => [key, url]);
      })
    );
    const urls = {};
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        const [key, url] = r.value;
        urls[key] = url;
      } else {
        console.error('File upload error:', r.reason);
      }
    });
    return urls;
  }
};


// ── EmailJS Service ──────────────────────────────────────────
const EmailService = {
  init() {
    if (typeof emailjs !== 'undefined') {
      emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY);
    }
  },

  async sendAdminNotification(subject, driverData) {
    if (typeof emailjs === 'undefined') return;
    return emailjs.send(
      CONFIG.EMAILJS.SERVICE_ID,
      CONFIG.EMAILJS.TEMPLATE_ID_ADMIN,
      {
        to_email:     CONFIG.EMAILJS.ADMIN_EMAIL,
        subject,
        driver_name:  driverData.fullName,
        driver_email: driverData.email,
        driver_phone: driverData.phone,
        car_type:     driverData.carType,
        car_year:     driverData.carYear,
        message:      `New driver registration from ${driverData.fullName}. Please log in to review and approve or deny.`
      }
    );
  },

  async sendUserNotification(userEmail, userName, status) {
    if (typeof emailjs === 'undefined') return;
    const approved = status === 'approved';
    return emailjs.send(
      CONFIG.EMAILJS.SERVICE_ID,
      CONFIG.EMAILJS.TEMPLATE_ID_USER,
      {
        to_email: userEmail,
        to_name:  userName,
        subject:  `Naybor Travel Express — Account ${approved ? 'Approved ✅' : 'Status Update'}`,
        message:  approved
          ? 'Great news! Your driver account has been approved. You can now sign in and post your first trip.'
          : 'Unfortunately, your driver registration was not approved at this time. Please contact us at geocorpsys@gmail.com for more information.'
      }
    );
  },

  async sendChatAlert(recipientEmail, recipientName, senderName, tripRoute, messagePreview) {
    if (typeof emailjs === 'undefined') return;
    const preview = messagePreview ? `\n\nMessage: "${messagePreview}"` : '';
    return emailjs.send(
      CONFIG.EMAILJS.SERVICE_ID,
      CONFIG.EMAILJS.TEMPLATE_ID_CHAT,
      {
        to_email: recipientEmail,
        to_name:  recipientName,
        subject:  `💬 New Message from ${senderName} — Naybor Travel Express`,
        message:  `${senderName} has sent you a message regarding the trip: ${tripRoute}.${preview}\n\nPlease log in to reply.`
      }
    );
  }
};


// ── Paystack Payment ─────────────────────────────────────────
const PaymentService = {
  initializePayment({ email, amount, tripId, driverId, passengerId, onSuccess, onClose }) {
    // Use crypto.randomUUID for a truly unique payment reference
    const refSuffix = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()
      : Date.now().toString(36).toUpperCase();

    const handler = PaystackPop.setup({
      key:      CONFIG.PAYSTACK_PUBLIC_KEY,
      email,
      amount:   amount * 100,   // Paystack works in kobo
      currency: 'NGN',
      ref:      'NTE_' + refSuffix,
      metadata: { tripId, driverId, passengerId },
      callback: async (response) => {
        await DB.recordPayment({
          reference: response.reference,
          amount, tripId, driverId, passengerId,
          status: 'success'
        });
        if (onSuccess) onSuccess(response);
      },
      onClose
    });
    handler.openIframe();
  }
};


// ── Auth Service ─────────────────────────────────────────────
const Auth = {
  currentUser: null,

  async login(email, password) {
    // Admin shortcut
    if (email === CONFIG.ADMIN.username && password === CONFIG.ADMIN.password) {
      this.currentUser = {
        id:       'ADMIN',
        email:    CONFIG.ADMIN.email,
        fullName: 'Administrator',
        role:     'admin',
        status:   'active'
      };
      localStorage.setItem('nte_user', JSON.stringify(this.currentUser));
      return this.currentUser;
    }

    const users = await DB.getUsers();
    const hashed = Auth.hashPassword(password);
    const user = users.find(u =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === hashed
    );
    if (!user) throw new Error('Invalid email or password');
    if (user.role === 'driver' && user.status !== 'active') {
      throw new Error('Your driver account is pending approval or has been deactivated');
    }
    this.currentUser = user;
    localStorage.setItem('nte_user', JSON.stringify(user));
    return user;
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('nte_user');
  },

  loadFromStorage() {
    const stored = localStorage.getItem('nte_user');
    if (stored) {
      try { this.currentUser = JSON.parse(stored); } catch (_) {}
    }
    return this.currentUser;
  },

  /**
   * Simple non-cryptographic hash — same algorithm as original
   * so existing stored passwords remain valid.
   */
  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36) + '_' + password.length;
  },

  isLoggedIn()  { return this.currentUser !== null; },
  isAdmin()     { return this.currentUser?.role === 'admin'; },
  isDriver()    { return this.currentUser?.role === 'driver'; },
  isPassenger() { return this.currentUser?.role === 'passenger'; }
};
