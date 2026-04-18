// ============================================================
// Naybor Travel Express - Database & API Services
// Fixed:
//   1. saveDB() now correctly uses JSONBIN_M_API_KEY (Master Key)
//      for X-Master-Key — previously it was mistakenly using the
//      Access Key for both headers, causing the "invalid" error.
//   2. Firebase photo uploads: robust init + base64 fallback so
//      driver registration never fails even if Firebase is blocked.
//   3. EmailJS functions now use CONFIG.EMAILJS.ADMIN_EMAIL and
//      all TEMPLATE_ID_* fields that are now defined in config2.js.
// ============================================================

// ── JSONBin DB ──────────────────────────────────────────────
const DB = {

  async getDB() {
    const res = await fetch(
      `${CONFIG.JSONBIN_BASE_URL}/b/${CONFIG.JSONBIN_MAIN_BIN_ID}/latest`,
      {
        headers: {
          'X-Master-Key': CONFIG.JSONBIN_M_API_KEY,   // Master Key for auth
          'X-Access-Key': CONFIG.JSONBIN_API_KEY,      // Access Key for bin
          'X-Bin-Meta':   'false'
        }
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `JSONBin read failed (${res.status})`);
    }
    return await res.json();
  },

  async saveDB(data) {
    const res = await fetch(
      `${CONFIG.JSONBIN_BASE_URL}/b/${CONFIG.JSONBIN_MAIN_BIN_ID}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.JSONBIN_M_API_KEY,   // FIX: was wrongly JSONBIN_API_KEY
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
  },

  // ── Initialise DB structure if bin is empty ──
  async initDB() {
    try {
      return await this.getDB();
    } catch (e) {
      const fresh = {
        users: [],
        trips: [],
        chats: [],
        payments: [],
        settings: {
          driver_chat_fee: CONFIG.APP_SETTINGS.driver_chat_fee,
          free_chat_limit: CONFIG.APP_SETTINGS.free_chat_limit,
          last_updated: new Date().toISOString()
        }
      };
      await this.saveDB(fresh);
      return fresh;
    }
  },

  // ── Users ────────────────────────────────────────────────
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

  async createUser(userData) {
    const db = await this.getDB();
    const newUser = {
      id: 'USR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      createdAt: new Date().toISOString(),
      ...userData
    };
    db.users = db.users || [];
    db.users.push(newUser);
    await this.saveDB(db);
    return newUser;
  },

  async updateUser(id, updates) {
    const db = await this.getDB();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('User not found');
    db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.saveDB(db);
    return db.users[idx];
  },

  async deleteUser(id) {
    const db = await this.getDB();
    db.users = db.users.filter(u => u.id !== id);
    await this.saveDB(db);
  },

  // ── Trips ────────────────────────────────────────────────
  async getTrips() {
    const db = await this.getDB();
    return db.trips || [];
  },

  async createTrip(tripData) {
    const db = await this.getDB();
    const newTrip = {
      id: 'TRIP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      createdAt: new Date().toISOString(),
      chatInteractions: [],
      ...tripData
    };
    db.trips = db.trips || [];
    db.trips.push(newTrip);
    await this.saveDB(db);
    return newTrip;
  },

  async updateTrip(id, updates) {
    const db = await this.getDB();
    const idx = db.trips.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Trip not found');
    db.trips[idx] = { ...db.trips[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.saveDB(db);
    return db.trips[idx];
  },

  async deleteTrip(id) {
    const db = await this.getDB();
    db.trips = db.trips.filter(t => t.id !== id);
    await this.saveDB(db);
  },

  // Only future / active trips
  async getActiveTrips() {
    const trips = await this.getTrips();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return trips.filter(t => {
      const dep = new Date(t.departureDate);
      dep.setHours(0, 0, 0, 0);
      return dep >= today && t.status === 'active';
    });
  },

  // ── Chats ────────────────────────────────────────────────
  async getChatsForTrip(tripId) {
    const db = await this.getDB();
    return (db.chats || []).filter(c => c.tripId === tripId);
  },

  async getOrCreateChatThread(tripId, passengerId, driverId) {
    const db = await this.getDB();
    db.chats = db.chats || [];
    let thread = db.chats.find(c => c.tripId === tripId && c.passengerId === passengerId);
    if (!thread) {
      thread = {
        id: 'CHAT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        tripId, passengerId, driverId,
        messages: [],
        createdAt: new Date().toISOString()
      };
      db.chats.push(thread);
      await this.saveDB(db);
    }
    return thread;
  },

  async addMessage(chatId, message) {
    const db = await this.getDB();
    const idx = db.chats.findIndex(c => c.id === chatId);
    if (idx === -1) throw new Error('Chat thread not found');
    const msg = {
      id: 'MSG_' + Date.now(),
      timestamp: new Date().toISOString(),
      ...message
    };
    db.chats[idx].messages.push(msg);
    await this.saveDB(db);
    return { chat: db.chats[idx], message: msg };
  },

  // ── Settings ─────────────────────────────────────────────
  async getSettings() {
    const db = await this.getDB();
    return db.settings || CONFIG.APP_SETTINGS;
  },

  async updateSettings(updates) {
    const db = await this.getDB();
    db.settings = { ...db.settings, ...updates, last_updated: new Date().toISOString() };
    await this.saveDB(db);
    return db.settings;
  },

  // ── Payments ─────────────────────────────────────────────
  async recordPayment(paymentData) {
    const db = await this.getDB();
    db.payments = db.payments || [];
    const payment = {
      id: 'PAY_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      createdAt: new Date().toISOString(),
      ...paymentData
    };
    db.payments.push(payment);
    await this.saveDB(db);
    return payment;
  },

  // ── Reviews ──────────────────────────────────────────────
  async getReviews() {
    const db = await this.getDB();
    return db.reviews || [];
  },

  async getReviewByPassengerAndTrip(passengerId, tripId) {
    const reviews = await this.getReviews();
    return reviews.find(r => r.passengerId === passengerId && r.tripId === tripId) || null;
  },

  async createReview(reviewData) {
    const db = await this.getDB();
    db.reviews = db.reviews || [];
    // Only one review per passenger per trip
    const existing = db.reviews.findIndex(
      r => r.passengerId === reviewData.passengerId && r.tripId === reviewData.tripId
    );
    const review = {
      id: 'REV_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      createdAt: new Date().toISOString(),
      ...reviewData
    };
    if (existing !== -1) {
      db.reviews[existing] = { ...db.reviews[existing], ...reviewData, updatedAt: new Date().toISOString() };
    } else {
      db.reviews.push(review);
    }
    await this.saveDB(db);
    return review;
  }
};


// ── Firebase Storage Service ─────────────────────────────────
// FIX: Robust init that handles both first-call and already-initialised states.
// FIX: fileToBase64() fallback — if Firebase Storage rules block the upload
//      (unauthenticated users are often denied), we encode the photo as a
//      compact base64 data-URL and store it directly in JSONBin instead.
//      This guarantees driver registration always completes.
const FirebaseService = {
  storage: null,
  _initialised: false,

  init() {
    if (this._initialised) return;
    try {
      // firebase.apps is an array; length === 0 means not yet initialised
      if (typeof firebase === 'undefined') throw new Error('Firebase SDK not loaded');
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(CONFIG.FIREBASE);
      }
      this.storage = firebase.storage();
      this._initialised = true;
      console.log('Firebase Storage ready.');
    } catch (e) {
      console.error('Firebase init error:', e.message);
    }
  },

  // Convert a File object to a compact base64 data-URL (JPEG, max ~800px wide)
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = ev => {
        img.onload = () => {
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // ~70% quality
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Try Firebase first; fall back to base64 in JSONBin
  async uploadFile(file, path) {
    this.init();
    if (this.storage) {
      try {
        const ref = this.storage.ref().child(path);
        const snapshot = await ref.put(file);
        return await snapshot.ref.getDownloadURL();
      } catch (e) {
        console.warn(`Firebase upload failed for ${path}: ${e.message}. Using base64 fallback.`);
      }
    }
    // Fallback: encode to base64 and return data-URL
    return await this.fileToBase64(file);
  },

  async uploadUserFiles(userId, files) {
    const urls = {};
    for (const [key, file] of Object.entries(files)) {
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `users/${userId}/${key}_${Date.now()}.${ext}`;
        urls[key] = await this.uploadFile(file, path);
      }
    }
    return urls;
  }
};


// ── EmailJS Service ──────────────────────────────────────────
// FIX: All three send functions now correctly reference
//      CONFIG.EMAILJS.TEMPLATE_ID_ADMIN / _USER / _CHAT
//      and CONFIG.EMAILJS.ADMIN_EMAIL — all now defined in config2.js.
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
        to_email:    CONFIG.EMAILJS.ADMIN_EMAIL,
        subject:     subject,
        driver_name: driverData.fullName,
        driver_email:driverData.email,
        driver_phone:driverData.phone,
        car_type:    driverData.carType,
        car_year:    driverData.carYear,
        message:     `New driver registration from ${driverData.fullName}. Please log in to review and approve or deny.`
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
    const handler = PaystackPop.setup({
      key:      CONFIG.PAYSTACK_PUBLIC_KEY,
      email,
      amount:   amount * 100,   // Paystack works in kobo
      currency: 'NGN',
      ref:      'NTE_' + Date.now(),
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
        id: 'ADMIN',
        email: CONFIG.ADMIN.email,
        fullName: 'Administrator',
        role: 'admin',
        status: 'active'
      };
      localStorage.setItem('nte_user', JSON.stringify(this.currentUser));
      return this.currentUser;
    }

    const users = await DB.getUsers();
    const user = users.find(u =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === Auth.hashPassword(password)
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
      try { this.currentUser = JSON.parse(stored); } catch(e) {}
    }
    return this.currentUser;
  },

  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36) + '_' + password.length;
  },

  isLoggedIn()   { return this.currentUser !== null; },
  isAdmin()      { return this.currentUser?.role === 'admin'; },
  isDriver()     { return this.currentUser?.role === 'driver'; },
  isPassenger()  { return this.currentUser?.role === 'passenger'; }
};
