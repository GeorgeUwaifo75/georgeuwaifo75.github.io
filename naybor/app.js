// ============================================================
// Naybor Travel Express - Main Application Logic
// ============================================================

// ============================================================
// PhotoUpload — rich upload widget controller
// Manages preview, drag-drop, file-info strip, and progress
// ring for each photo slot on the driver sign-up form.
// ============================================================
const PhotoUpload = {
  // Slot keys and their display labels
  SLOTS: {
    license:  "Driver's Licence",
    front:    'Car – Front View',
    back:     'Car – Back View',
    side:     'Car – Side View',
    interior: 'Car – Interior'
  },

  // Trigger the hidden file input for a slot
  trigger(key) {
    const inp = document.getElementById(key === 'license' ? 'signup-license' : `car-${key}`);
    if (inp) inp.click();
  },

  // Called immediately when the user selects a file
  onFileSelected(key, input) {
    const file = input.files[0];
    if (!file) return;

    // Validate size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      App.showToast(`${file.name} is larger than 5 MB. Please choose a smaller file.`, 'error');
      input.value = '';
      return;
    }

    const zone = document.getElementById(`zone-${key}`);
    if (!zone) return;

    // Show spinning ring while FileReader runs
    zone.classList.remove('has-file', 'upload-error');
    zone.classList.add('uploading');
    const progLabel = zone.querySelector('.progress-label');
    if (progLabel) progLabel.textContent = 'Reading…';

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Set preview image
      const img = document.getElementById(`prev-${key}`);
      if (img) {
        img.src = ev.target.result;
        img.onload = () => {
          zone.classList.remove('uploading');
          zone.classList.add('has-file');
          this._setFileInfo(key, file);
        };
        img.onerror = () => {
          // PDF or non-image — still mark as ready, show generic icon
          zone.classList.remove('uploading');
          zone.classList.add('has-file');
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23e8ecf2"/><text x="40" y="48" text-anchor="middle" font-size="32">📄</text></svg>';
          this._setFileInfo(key, file);
        };
      } else {
        zone.classList.remove('uploading');
        zone.classList.add('has-file');
        this._setFileInfo(key, file);
      }
    };
    reader.onerror = () => {
      zone.classList.remove('uploading');
      zone.classList.add('upload-error');
      App.showToast('Could not read that file. Please try again.', 'error');
    };
    reader.readAsDataURL(file);
  },

  // Populate the file-info strip below the zone
  _setFileInfo(key, file) {
    const nameEl = document.getElementById(`fname-${key}`);
    const sizeEl = document.getElementById(`fsize-${key}`);
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = this._humanSize(file.size);
  },

  // Remove a file from a slot
  remove(key, event) {
    event.stopPropagation(); // don't re-open file picker
    const inputId = key === 'license' ? 'signup-license' : `car-${key}`;
    const input = document.getElementById(inputId);
    if (input) input.value = '';

    const zone = document.getElementById(`zone-${key}`);
    if (zone) zone.classList.remove('has-file', 'uploading', 'upload-error');

    const img = document.getElementById(`prev-${key}`);
    if (img) img.src = '';

    const nameEl = document.getElementById(`fname-${key}`);
    const sizeEl = document.getElementById(`fsize-${key}`);
    if (nameEl) nameEl.textContent = '—';
    if (sizeEl) sizeEl.textContent = '';
  },

  // Show per-step upload progress bar during form submission
  showUploadProgress(steps) {
    const wrap = document.getElementById('upload-progress-wrap');
    const stepsEl = document.getElementById('upload-steps');
    if (!wrap || !stepsEl) return;

    wrap.classList.add('visible');
    stepsEl.innerHTML = steps.map((s, i) =>
      `<div class="upload-step pending" id="ustep-${i}">
        <div class="step-dot"></div>
        <span>${s}</span>
       </div>`
    ).join('');
    this._updateBar(0, steps.length);
  },

  setStepActive(idx, total) {
    document.querySelectorAll('.upload-step').forEach((el, i) => {
      el.className = 'upload-step ' + (i < idx ? 'done' : i === idx ? 'active' : 'pending');
    });
    this._updateBar(idx, total);
  },

  setStepDone(idx, total) {
    const el = document.getElementById(`ustep-${idx}`);
    if (el) el.className = 'upload-step done';
    this._updateBar(idx + 1, total);
  },

  setStepError(idx) {
    const el = document.getElementById(`ustep-${idx}`);
    if (el) el.className = 'upload-step error';
  },

  hideUploadProgress() {
    const wrap = document.getElementById('upload-progress-wrap');
    if (wrap) wrap.classList.remove('visible');
  },

  _updateBar(done, total) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const fill = document.getElementById('upload-fill');
    const pctEl = document.getElementById('upload-pct');
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  },

  _humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  // Wire drag-and-drop on all zones (called once after page load)
  initDragDrop() {
    Object.keys(this.SLOTS).forEach(key => {
      const zone = document.getElementById(`zone-${key}`);
      if (!zone) return;
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const inputId = key === 'license' ? 'signup-license' : `car-${key}`;
        const input = document.getElementById(inputId);
        if (!input || !e.dataTransfer.files.length) return;
        // Transfer the dropped file into the hidden input (via DataTransfer)
        try {
          const dt = new DataTransfer();
          dt.items.add(e.dataTransfer.files[0]);
          input.files = dt.files;
        } catch(_) {}
        this.onFileSelected(key, input);
      });
    });
  }
};

// ── App State ──
const App = {
  currentPage: 'home',
  db: null,
  settings: null,

  async init() {
    Auth.loadFromStorage();
    await this.loadSettings();
    this.bindNav();
    this.renderNav();
    this.initToasts();
    this.navigate('home');

    // Initialize services
    if (typeof emailjs !== 'undefined') EmailService.init();
    if (typeof firebase !== 'undefined') FirebaseService.init();

    // Wire drag-drop on photo upload zones (no-op if elements not yet rendered)
    PhotoUpload.initDragDrop();
  },

  async loadSettings() {
    try {
      this.settings = await DB.getSettings();
    } catch(e) {
      this.settings = CONFIG.APP_SETTINGS;
    }
  },

  // ── Navigation ──
  navigate(page, params = {}) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.renderNav();

    // Page-specific init
    switch(page) {
      case 'home': this.renderHome(); break;
      case 'signin': this.renderSignIn(); break;
      case 'about': break;
      case 'dashboard': this.renderDashboard(); break;
    }
  },

  bindNav() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const page = el.dataset.page;
        if (page === 'dashboard' && !Auth.isLoggedIn()) {
          this.navigate('signin');
        } else {
          this.navigate(page);
        }
      });
    });

    // Hamburger
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobile-nav');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileNav.classList.toggle('open');
      });
    }

    // Scroll effect
    window.addEventListener('scroll', () => {
      const navbar = document.getElementById('navbar');
      if (window.scrollY > 10) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    });
  },

  renderNav() {
    const userArea = document.getElementById('nav-user-area');
    if (!userArea) return;

    if (Auth.isLoggedIn()) {
      const u = Auth.currentUser;
      const initials = u.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
      userArea.innerHTML = `
        <div class="nav-avatar" onclick="App.navigate('dashboard')" title="Dashboard">${initials}</div>
        <button class="btn btn-outline btn-sm" onclick="App.logout()">Sign Out</button>
      `;
    } else {
      userArea.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('signin')">Sign In</button>
      `;
    }
  },

  logout() {
    Auth.logout();
    this.navigate('home');
    this.showToast('You have been signed out.', 'success');
  },

  // ── Home Page ──
  async renderHome() {
    this.renderStateFilters();
    await this.loadAndRenderTrips();
  },

  renderStateFilters() {
    const fromSel = document.getElementById('filter-from');
    const toSel = document.getElementById('filter-to');
    if (!fromSel || !toSel) return;

    const opts = CONFIG.NIGERIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
    fromSel.innerHTML = '<option value="">All States</option>' + opts;
    toSel.innerHTML = '<option value="">All Destinations</option>' + opts;

    document.getElementById('search-form').addEventListener('submit', e => {
      e.preventDefault();
      this.loadAndRenderTrips();
    });
  },

  async loadAndRenderTrips() {
    const container = document.getElementById('trips-container');
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div><p style="margin-top:14px">Loading available trips...</p></div>';

    try {
      let trips = await DB.getActiveTrips();

      // Apply filters
      const fromState = document.getElementById('filter-from')?.value;
      const toState = document.getElementById('filter-to')?.value;
      const dateFilter = document.getElementById('filter-date')?.value;

      if (fromState) trips = trips.filter(t => t.originState === fromState);
      if (toState) trips = trips.filter(t => t.destination === toState);
      if (dateFilter) trips = trips.filter(t => t.departureDate === dateFilter);

      if (!trips.length) {
        container.innerHTML = `<div class="empty-state">
          <div class="icon">🚗</div>
          <h3>No trips available</h3>
          <p>No travel plans match your search. Try adjusting your filters or check back soon.</p>
        </div>`;
        return;
      }

      // Group by origin state
      const byState = {};
      trips.forEach(t => {
        if (!byState[t.originState]) byState[t.originState] = [];
        byState[t.originState].push(t);
      });

      // Get all drivers
      const users = await DB.getUsers();

      let html = '';
      for (const [state, stateTrips] of Object.entries(byState)) {
        html += `<div class="state-group">
          <div class="state-label">📍 From ${state}</div>
          <div class="trips-grid">`;
        stateTrips.forEach(trip => {
          const driver = users.find(u => u.id === trip.driverId);
          html += this.renderTripCard(trip, driver);
        });
        html += `</div></div>`;
      }
      container.innerHTML = html;

      // Bind card clicks
      container.querySelectorAll('.trip-card').forEach(card => {
        card.addEventListener('click', () => {
          const tripId = card.dataset.tripId;
          this.openTripDetail(tripId, trips, users);
        });
      });

    } catch(e) {
      container.innerHTML = `<div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Could not load trips</h3>
        <p>${e.message}</p>
      </div>`;
    }
  },

  renderTripCard(trip, driver) {
    const carImg = driver?.carPhotos?.front
      ? `<img src="${driver.carPhotos.front}" alt="Car" loading="lazy">`
      : `<div class="no-img">🚗</div>`;
    const initials = driver ? driver.fullName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '??';
    const depTime = trip.departureTime || '';
    const depDate = new Date(trip.departureDate).toLocaleDateString('en-NG', { weekday:'short', month:'short', day:'numeric' });

    return `<div class="trip-card" data-trip-id="${trip.id}">
      <div class="trip-card-img">
        ${carImg}
        <div class="trip-badge">🪑 ${trip.availableSeats || '—'} seats</div>
      </div>
      <div class="trip-card-body">
        <div class="trip-route">
          <span>${trip.originState}</span>
          <span class="arrow">→</span>
          <span>${trip.destination}</span>
        </div>
        <div class="trip-meta">
          <div class="trip-meta-item">📅 ${depDate}</div>
          ${depTime ? `<div class="trip-meta-item">⏰ ${depTime}</div>` : ''}
          <div class="trip-meta-item">📍 ${trip.departurePoint || 'TBD'}</div>
        </div>
        <div class="trip-driver">
          <div class="driver-avatar-sm">${initials}</div>
          <div class="driver-info">
            <div class="name">${driver?.fullName || 'Driver'}</div>
            <div class="car">${driver?.carType || ''} ${driver?.carYear || ''}</div>
          </div>
        </div>
      </div>
      <div class="trip-card-footer">
        <button class="btn btn-secondary btn-sm">View & Chat →</button>
      </div>
    </div>`;
  },

  async openTripDetail(tripId, trips, users) {
  if (!Auth.isLoggedIn()) {
    this.showToast('Please sign in to view trip details and chat with drivers.', 'warning');
    this.navigate('signin');
    return;
  }
  const trip = trips.find(t => t.id === tripId);
  const driver = users.find(u => u.id === trip?.driverId);
  if (!trip || !driver) return;

  // Compact date: "Mon, 21 Apr 2025"
  const depDate = new Date(trip.departureDate).toLocaleDateString('en-NG', {
    weekday:'short', day:'numeric', month:'short', year:'numeric'
  });
  const initials = driver.fullName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

  // Car photos - larger sizes now!
  const carPhotos = driver.carPhotos || {};
  const photoKeys = ['front', 'back', 'side', 'interior'];
  const photoLabels = {
    front: 'Front View',
    back: 'Back View',
    side: 'Side View',
    interior: 'Interior'
  };
  
  // Build larger thumbnails (120px width, 80px height)
  const thumbs = photoKeys
    .filter(k => carPhotos[k])
    .map(k => `
      <div class="trip-photo-thumb" data-photo-url="${carPhotos[k]}" data-photo-label="${photoLabels[k]}">
        <img src="${carPhotos[k]}" alt="${k}" loading="lazy">
        <span class="photo-label">${photoLabels[k]}</span>
        <div class="photo-expand-icon">🔍</div>
      </div>
    `)
    .join('');
    
  const thumbStrip = thumbs
    ? `<div class="trip-photos-strip">${thumbs}</div>`
    : '';

  // Helper: compact label+value cell
  const cell = (label, value) =>
    `<div style="background:var(--off-white);border-radius:6px;padding:7px 9px;">
       <div style="font-size:0.6rem;font-weight:800;color:var(--gray);text-transform:uppercase;
                   letter-spacing:0.8px;margin-bottom:2px;">${label}</div>
       <div style="font-weight:700;font-size:0.82rem;color:var(--text);">${value}</div>
     </div>`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  // Click backdrop to close
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.innerHTML = `
    <div class="modal trip-detail-modal">

      <!-- Compact header -->
      <div class="modal-header" style="padding:10px 14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:0.95rem;font-weight:900;letter-spacing:0.3px;">🚗 Trip Details</div>
          <span style="font-size:0.7rem;background:rgba(255,255,255,0.18);
                       padding:2px 8px;border-radius:20px;font-weight:700;">
            ${trip.originState} → ${trip.destination}
          </span>
        </div>
        <button onclick="this.closest('.modal-overlay').remove()"
                style="background:rgba(255,255,255,0.18);border:none;color:white;
                       width:26px;height:26px;border-radius:50%;cursor:pointer;
                       font-size:0.85rem;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <!-- Scrollable body -->
      <div class="modal-body trip-detail-body">

        ${thumbStrip}

        <!-- 6-cell info grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
          ${cell('From', trip.originState)}
          ${cell('To', trip.destination)}
          ${cell('Seats', trip.availableSeats || '—')}
          ${cell('Date', depDate)}
          ${cell('Time', trip.departureTime || 'TBD')}
          ${cell('Pickup', trip.departurePoint || 'TBD')}
        </div>

        <!-- Driver strip -->
        <div style="display:flex;align-items:center;gap:9px;
                    background:var(--off-white);border-radius:7px;padding:8px 10px;
                    margin-bottom:${trip.notes ? '8px' : '0'};">
          <div class="driver-avatar-sm" style="width:30px;height:30px;font-size:0.72rem;flex-shrink:0;">
            ${initials}
          </div>
          <div style="min-width:0;">
            <div style="font-weight:800;font-size:0.82rem;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${driver.fullName}
            </div>
            <div style="font-size:0.72rem;color:var(--text-light);">
              ${driver.carType || ''} ${driver.carYear || ''}
            </div>
          </div>
        </div>

        ${trip.notes ? `
        <div style="font-size:0.78rem;color:var(--text-light);line-height:1.5;
                    background:rgba(26,60,143,0.04);border-radius:6px;padding:7px 9px;
                    border-left:3px solid var(--blue-light);">
          ${trip.notes}
        </div>` : ''}

      </div><!-- /body -->

      <!-- Footer -->
      <div class="modal-footer" style="padding:9px 14px;gap:8px;">
        <button class="btn btn-outline btn-sm"
                style="font-size:0.78rem;padding:7px 14px;"
                onclick="this.closest('.modal-overlay').remove()">Close</button>
        <button class="btn btn-primary btn-sm"
                style="font-size:0.78rem;padding:7px 14px;"
                onclick="App.openChatModal('${trip.id}','${driver.id}');
                         this.closest('.modal-overlay').remove()">
          💬 Chat with Driver
        </button>
      </div>

    </div>`;
  document.body.appendChild(overlay);

  // Add click-to-expand functionality for photos
  const photoThumbs = overlay.querySelectorAll('.trip-photo-thumb');
  photoThumbs.forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoUrl = thumb.dataset.photoUrl;
      const photoLabel = thumb.dataset.photoLabel;
      if (photoUrl) {
        this.showFullSizeImage(photoUrl, photoLabel);
      }
    });
  });
},

// New method to show full-size image in a modal
showFullSizeImage(imageUrl, label) {
  const fullImgOverlay = document.createElement('div');
  fullImgOverlay.className = 'full-image-overlay';
  fullImgOverlay.innerHTML = `
    <div class="full-image-container">
      <button class="full-image-close" onclick="this.closest('.full-image-overlay').remove()">✕</button>
      <img src="${imageUrl}" alt="${label}" class="full-image">
      <div class="full-image-caption">${label}</div>
    </div>
  `;
  fullImgOverlay.addEventListener('click', (e) => {
    if (e.target === fullImgOverlay) fullImgOverlay.remove();
  });
  document.body.appendChild(fullImgOverlay);
},

  // ── Chat Modal ──
  async openChatModal(tripId, driverId) {
    if (!Auth.isLoggedIn() || Auth.isDriver()) {
      this.showToast('Passengers only feature.', 'warning');
      return;
    }

    const passengerId = Auth.currentUser.id;
    showLoader();

    try {
      const [thread, settings] = await Promise.all([
        DB.getOrCreateChatThread(tripId, passengerId, driverId),
        DB.getSettings()
      ]);

      // Check if payment required (driver side check in dashboard)
      // Count unique passengers who've chatted this trip
      const allChats = await DB.getChatsForTrip(tripId);
      const uniquePassengers = [...new Set(allChats.map(c => c.passengerId))];
      const isNewPassenger = !uniquePassengers.includes(passengerId);
      const freeLimit = settings.free_chat_limit || 2;

      // Check if driver needs to pay (driver's concern - we just show chat to passenger)
      hideLoader();
      this.renderChatModal(thread, tripId, driverId, passengerId);

      // Notify driver via email
      try {
        const driver = await DB.getUserById(driverId);
        const trip = (await DB.getActiveTrips()).find(t => t.id === tripId);
        if (driver && trip && isNewPassenger) {
          await EmailService.sendChatAlert(
            driver.email,
            driver.fullName,
            Auth.currentUser.fullName,
            `${trip.originState} → ${trip.destination}`
          );
        }
      } catch(e) { console.log('Email alert failed:', e); }

    } catch(e) {
      hideLoader();
      this.showToast('Could not open chat: ' + e.message, 'error');
    }
  },

  renderChatModal(thread, tripId, driverId, passengerId) {
    const overlay = document.createElement('div');
    overlay.className = 'chat-modal-overlay';
    overlay.id = 'chat-overlay';

    const msgsHtml = thread.messages.map(m => {
      const isSent = m.senderId === passengerId;
      const time = new Date(m.timestamp).toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' });
      return `<div class="message ${isSent ? 'sent' : 'received'}">
        ${m.text}
        <div class="time">${time}</div>
      </div>`;
    }).join('');

    overlay.innerHTML = `
      <div class="chat-modal">
        <div class="chat-header">
          <div>
            <div class="title">💬 Trip Chat</div>
            <div style="font-size:0.75rem;opacity:0.7">Messages are private between you and the driver</div>
          </div>
          <button class="close-btn" onclick="document.getElementById('chat-overlay').remove()">✕</button>
        </div>
        <div class="chat-messages" id="chat-messages">${msgsHtml || '<div style="text-align:center;color:var(--gray);font-size:0.85rem;margin-top:20px">No messages yet. Say hello! 👋</div>'}</div>
        <div class="chat-input-area">
          <input type="text" id="chat-input" placeholder="Type your message..." maxlength="500">
          <button class="chat-send-btn" id="chat-send">Send</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const msgs = document.getElementById('chat-messages');
    msgs.scrollTop = msgs.scrollHeight;

    const sendMsg = async () => {
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      try {
        await DB.addMessage(thread.id, {
          senderId: passengerId,
          senderName: Auth.currentUser.fullName,
          text
        });
        const time = new Date().toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' });
        msgs.innerHTML += `<div class="message sent">${text}<div class="time">${time}</div></div>`;
        msgs.scrollTop = msgs.scrollHeight;
      } catch(e) {
        this.showToast('Failed to send message', 'error');
      }
    };

    document.getElementById('chat-send').addEventListener('click', sendMsg);
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMsg();
    });
  },

  // ── Sign In / Sign Up ──
  renderSignIn() {
    // Always reset the sign-in button in case a previous attempt (or the
    // auto-login inside handleSignUp) left it disabled. The HTML element
    // is static and persists across tab switches and navigate() calls.
    const signinBtn = document.getElementById('signin-btn');
    if (signinBtn) {
      signinBtn.disabled = false;
      signinBtn.textContent = 'Sign In';
    }

    // Also clear any leftover values from a previous failed attempt
    // so the user doesn't wonder why the fields are pre-filled.
    const emailFld = document.getElementById('signin-email');
    const pwdFld   = document.getElementById('signin-password');
    // Only clear if we're arriving fresh (not if user is actively typing)
    // We detect "fresh arrival" by checking whether the panel is currently hidden.
    const signinPanel = document.getElementById('signin-panel');
    if (signinPanel && signinPanel.style.display === 'none') {
      if (emailFld) emailFld.value = '';
      if (pwdFld)   pwdFld.value   = '';
    }

    // Clone the account-type dropdown to strip duplicate event listeners
    // (renderSignIn can be called multiple times via navigate()).
    const userTypeEl = document.getElementById('signup-user-type');
    if (userTypeEl) {
      const fresh = userTypeEl.cloneNode(true);
      userTypeEl.parentNode.replaceChild(fresh, userTypeEl);
      fresh.addEventListener('change', () => {
        const isDriver = fresh.value === 'driver';
        document.getElementById('driver-fields').style.display = isDriver ? 'block' : 'none';
        const genderGroup = document.getElementById('passenger-only-fields');
        if (genderGroup) genderGroup.style.display = isDriver ? 'none' : 'block';
      });
    }
  },

  async handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    if (!email || !password) { this.showToast('Please fill in all fields', 'error'); return; }

    const btn = document.getElementById('signin-btn');
    btn.disabled = true; btn.textContent = 'Signing in...';

    try {
      showLoader();
      await Auth.login(email, password);
      hideLoader();
      this.showToast(`Welcome back, ${Auth.currentUser.fullName}!`, 'success');
      this.navigate('dashboard');
    } catch(e) {
      hideLoader();
      btn.disabled = false; btn.textContent = 'Sign In';
      this.showToast(e.message, 'error');
    }
  },

  async handleSignUp(e) {
    e.preventDefault();
    const form = document.getElementById('signup-form');
    const role = document.getElementById('signup-user-type').value;
    const email = document.getElementById('signup-email').value.trim();
    const fullName = document.getElementById('signup-name').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPwd = document.getElementById('signup-confirm-password').value;
    const gender = document.getElementById('signup-gender')?.value;

    if (!email || !fullName || !phone || !password) { this.showToast('Please fill in all required fields', 'error'); return; }
    if (password !== confirmPwd) { this.showToast('Passwords do not match', 'error'); return; }
    if (password.length < 8) { this.showToast('Password must be at least 8 characters', 'error'); return; }

    const btn = document.getElementById('signup-btn');
    btn.disabled = true; btn.textContent = 'Creating account...';

    try {
      showLoader();

      // Check duplicate email
      const existing = await DB.getUserByEmail(email);
      if (existing) throw new Error('This email is already registered');

      let userData = {
        email, fullName, phone,
        password: Auth.hashPassword(password),
        role,
        status: role === 'driver' ? 'pending' : 'active'
      };

      if (role === 'passenger') {
        userData.gender = gender;
      }

      if (role === 'driver') {
        const carType = document.getElementById('signup-car-type').value.trim();
        const carYear = document.getElementById('signup-car-year').value.trim();
        if (!carType || !carYear) throw new Error('Please enter your car type and year');

        userData.carType = carType;
        userData.carYear = carYear;

        // Validate all files are selected
        const licenseFile  = document.getElementById('signup-license').files[0];
        const carFront     = document.getElementById('car-front').files[0];
        const carBack      = document.getElementById('car-back').files[0];
        const carSide      = document.getElementById('car-side').files[0];
        const carInterior  = document.getElementById('car-interior').files[0];

        if (!licenseFile)  throw new Error("Please upload a photo of your driver's licence");
        if (!carFront)     throw new Error('Please upload the Front view photo of your car');
        if (!carBack)      throw new Error('Please upload the Back view photo of your car');
        if (!carSide)      throw new Error('Please upload the Side view photo of your car');
        if (!carInterior)  throw new Error('Please upload the Interior photo of your car');

        // ── Per-file upload with progress steps ──────────────────
        const uploadItems = [
          { key: 'license',  file: licenseFile,  label: "Driver's Licence"  },
          { key: 'front',    file: carFront,      label: 'Car — Front View'  },
          { key: 'back',     file: carBack,       label: 'Car — Back View'   },
          { key: 'side',     file: carSide,       label: 'Car — Side View'   },
          { key: 'interior', file: carInterior,   label: 'Car — Interior'    },
        ];

        hideLoader(); // swap global spinner for the inline progress bar
        btn.textContent = 'Uploading photos…';
        PhotoUpload.showUploadProgress(uploadItems.map(i => i.label));

        const tempId = 'USR_' + Date.now();
        const photoUrls = {};

        for (let i = 0; i < uploadItems.length; i++) {
          const { key, file, label } = uploadItems[i];
          PhotoUpload.setStepActive(i, uploadItems.length);

          // Show spinner on the matching zone
          const zone = document.getElementById(`zone-${key}`);
          if (zone) {
            zone.classList.remove('has-file');
            zone.classList.add('uploading');
            const pl = zone.querySelector('.progress-label');
            if (pl) pl.textContent = 'Uploading…';
          }

          try {
            const ext = file.name.split('.').pop();
            const path = `users/${tempId}/${key}_${Date.now()}.${ext}`;
            photoUrls[key] = await FirebaseService.uploadFile(file, path);

            // Restore zone to has-file state
            if (zone) {
              zone.classList.remove('uploading');
              zone.classList.add('has-file');
            }
            PhotoUpload.setStepDone(i, uploadItems.length);
          } catch (uploadErr) {
            PhotoUpload.setStepError(i);
            if (zone) { zone.classList.remove('uploading'); zone.classList.add('upload-error'); }
            throw new Error(`Upload failed for "${label}": ${uploadErr.message}`);
          }
        }

        PhotoUpload.hideUploadProgress();
        showLoader();

        userData.licensePhoto = photoUrls.license;
        userData.carPhotos = {
          front:    photoUrls.front,
          back:     photoUrls.back,
          side:     photoUrls.side,
          interior: photoUrls.interior
        };
      }

      btn.textContent = 'Saving account…';
      const newUser = await DB.createUser(userData);

      // Notify admin of new driver registration
      if (role === 'driver') {
        try {
          await EmailService.sendAdminNotification('New Driver Registration Request', newUser);
        } catch(ee) {
          console.warn('Admin email notification failed:', ee);
        }
      }

      hideLoader();
      PhotoUpload.hideUploadProgress();
      btn.disabled = false; btn.textContent = 'Create Account';

      if (role === 'driver') {
        this.showToast('Account submitted! The administrator will review your application and notify you by email.', 'success');
        form.reset();
        // Reset all photo zones to idle state
        Object.keys(PhotoUpload.SLOTS).forEach(key => {
          const zone = document.getElementById(`zone-${key}`);
          if (zone) zone.classList.remove('has-file', 'uploading', 'upload-error');
          const img = document.getElementById(`prev-${key}`);
          if (img) img.src = '';
        });
        document.getElementById('driver-fields').style.display = 'none';
        this.switchAuthTab('signin');
      } else {
        // Auto-login passengers immediately
        await Auth.login(email, password);
        this.showToast(`Welcome to Naybor Travel Express, ${fullName}!`, 'success');
        form.reset();
        this.navigate('dashboard');
      }

    } catch(err) {
      hideLoader();
      PhotoUpload.hideUploadProgress();
      btn.disabled = false; btn.textContent = 'Create Account';
      this.showToast(err.message, 'error');
    }
  },

  switchAuthTab(tab) {
    document.getElementById('signin-panel').style.display = tab === 'signin' ? 'block' : 'none';
    document.getElementById('signup-panel').style.display = tab === 'signup' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    // Re-wire drag-drop each time the signup tab becomes visible
    if (tab === 'signup') setTimeout(() => PhotoUpload.initDragDrop(), 50);
  },

  // ── Dashboard Router ──
  renderDashboard() {
    if (!Auth.isLoggedIn()) { this.navigate('signin'); return; }
    const u = Auth.currentUser;

    if (u.role === 'admin') this.renderAdminDashboard();
    else if (u.role === 'driver') this.renderDriverDashboard();
    else this.renderPassengerDashboard();
  },

  // ── Admin Dashboard ──
  async renderAdminDashboard() {
    const main = document.getElementById('dashboard-content');
    if (!main) return;

    main.innerHTML = `
      <div class="dashboard-layout">
        <div class="sidebar">
          <div class="sidebar-user">
            <div class="sidebar-avatar">A</div>
            <div class="name">Administrator</div>
            <div class="role">Super Admin</div>
            <div class="status status-active">● Active</div>
          </div>
          <div class="sidebar-menu">
            <div class="sidebar-section-title">Management</div>
            <div class="sidebar-menu-item active" onclick="App.adminPanel('overview')"><span class="icon">📊</span> Overview</div>
            <div class="sidebar-menu-item" onclick="App.adminPanel('drivers')"><span class="icon">🚗</span> Drivers</div>
            <div class="sidebar-menu-item" onclick="App.adminPanel('passengers')"><span class="icon">👥</span> Passengers</div>
            <div class="sidebar-menu-item" onclick="App.adminPanel('trips')"><span class="icon">🗺️</span> All Trips</div>
            <div class="sidebar-menu-item" onclick="App.adminPanel('payments')"><span class="icon">💳</span> Payments</div>
            <div class="sidebar-section-title">Settings</div>
            <div class="sidebar-menu-item" onclick="App.adminPanel('settings')"><span class="icon">⚙️</span> App Settings</div>
            <div class="sidebar-menu-item" onclick="App.logout()"><span class="icon">🚪</span> Sign Out</div>
          </div>
        </div>
        <div class="dashboard-main" id="admin-main">
          <div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
        </div>
      </div>`;

    this.adminPanel('overview');
  },

  async adminPanel(panel) {
    const main = document.getElementById('admin-main');
    if (!main) return;

    // Update sidebar active
    document.querySelectorAll('.sidebar-menu-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`[onclick="App.adminPanel('${panel}')"]`);
    if (activeItem) activeItem.classList.add('active');

    showLoader();
    try {
      const db = await DB.getDB();
      const users = db.users || [];
      const trips = db.trips || [];
      const payments = db.payments || [];
      const settings = db.settings || {};

      hideLoader();

      switch(panel) {
        case 'overview':
          const drivers = users.filter(u => u.role === 'driver');
          const passengers = users.filter(u => u.role === 'passenger');
          const pendingDrivers = drivers.filter(d => d.status === 'pending');
          const activeTrips = trips.filter(t => t.status === 'active');

          main.innerHTML = `
            <div class="dash-header"><h1>ADMIN OVERVIEW</h1><p>Welcome back, Administrator</p></div>
            <div class="stats-row">
              <div class="stat-card"><div class="val">${drivers.length}</div><div class="lbl">Total Drivers</div></div>
              <div class="stat-card red"><div class="val">${pendingDrivers.length}</div><div class="lbl">Pending Approval</div></div>
              <div class="stat-card"><div class="val">${passengers.length}</div><div class="lbl">Passengers</div></div>
              <div class="stat-card"><div class="val">${activeTrips.length}</div><div class="lbl">Active Trips</div></div>
            </div>
            ${pendingDrivers.length > 0 ? `
            <div class="dash-panel">
              <div class="dash-panel-title">⏳ Pending Driver Approvals</div>
              ${pendingDrivers.map(d => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--light-gray)">
                  <div>
                    <div style="font-weight:700">${d.fullName}</div>
                    <div style="font-size:0.8rem;color:var(--text-light)">${d.email} · ${d.carType} ${d.carYear}</div>
                    ${d.licensePhoto ? `<a href="${d.licensePhoto}" target="_blank" style="font-size:0.75rem;color:var(--blue)">View License</a>` : ''}
                    ${d.carPhotos?.front ? ` · <a href="${d.carPhotos.front}" target="_blank" style="font-size:0.75rem;color:var(--blue)">View Car Photos</a>` : ''}
                  </div>
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-secondary btn-sm" onclick="App.approveDriver('${d.id}')">✅ Approve</button>
                    <button class="btn btn-outline-red btn-sm" onclick="App.denyDriver('${d.id}')">❌ Deny</button>
                  </div>
                </div>`).join('')}
            </div>` : ''}
            <div class="dash-panel">
              <div class="dash-panel-title">💰 Payment Fee Setting</div>
              <p style="font-size:0.9rem;color:var(--text-light);margin-bottom:16px">Current driver chat fee: <strong>₦${settings.driver_chat_fee || 650}</strong> per additional passenger chat (beyond ${settings.free_chat_limit || 2} free)</p>
              <button class="btn btn-outline btn-sm" onclick="App.adminPanel('settings')">Modify Fee →</button>
            </div>`;
          break;

        case 'drivers':
          const allDrivers = users.filter(u => u.role === 'driver');
          main.innerHTML = `
            <div class="dash-header"><h1>DRIVERS</h1><p>Manage all driver accounts</p></div>
            <div class="dash-panel">
              <div class="dash-panel-title">All Drivers (${allDrivers.length})</div>
              ${allDrivers.length ? `
              <div style="overflow-x:auto">
              <table class="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Car</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  ${allDrivers.map(d => `
                  <tr>
                    <td><strong>${d.fullName}</strong></td>
                    <td>${d.email}</td>
                    <td>${d.phone}</td>
                    <td>${d.carType} ${d.carYear}</td>
                    <td><span class="badge ${d.status === 'active' ? 'badge-green' : d.status === 'pending' ? 'badge-yellow' : 'badge-red'}">${d.status}</span></td>
                    <td>
                      ${d.status === 'pending' ? `<button class="btn btn-secondary btn-sm" onclick="App.approveDriver('${d.id}')">Approve</button> ` : ''}
                      ${d.status === 'active' ? `<button class="btn btn-outline-red btn-sm" onclick="App.deactivateUser('${d.id}')">Deactivate</button> ` : ''}
                      <button class="btn btn-outline-red btn-sm" onclick="App.deleteUserConfirm('${d.id}','${d.fullName}')">Delete</button>
                    </td>
                  </tr>`).join('')}
                </tbody>
              </table>
              </div>` : '<div class="empty-state"><div class="icon">🚗</div><h3>No drivers yet</h3></div>'}
            </div>`;
          break;

        case 'passengers':
          const allPassengers = users.filter(u => u.role === 'passenger');
          main.innerHTML = `
            <div class="dash-header"><h1>PASSENGERS</h1><p>Manage passenger accounts</p></div>
            <div class="dash-panel">
              <div class="dash-panel-title">All Passengers (${allPassengers.length})</div>
              ${allPassengers.length ? `
              <div style="overflow-x:auto">
              <table class="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  ${allPassengers.map(p => `
                  <tr>
                    <td><strong>${p.fullName}</strong></td>
                    <td>${p.email}</td>
                    <td>${p.phone}</td>
                    <td>${p.gender || '—'}</td>
                    <td>${new Date(p.createdAt).toLocaleDateString('en-NG')}</td>
                    <td><button class="btn btn-outline-red btn-sm" onclick="App.deleteUserConfirm('${p.id}','${p.fullName}')">Delete</button></td>
                  </tr>`).join('')}
                </tbody>
              </table>
              </div>` : '<div class="empty-state"><div class="icon">👥</div><h3>No passengers yet</h3></div>'}
            </div>`;
          break;

        case 'trips':
          main.innerHTML = `
            <div class="dash-header"><h1>ALL TRIPS</h1><p>View and manage trip listings</p></div>
            <div class="dash-panel">
              <div class="dash-panel-title">Trip Listings (${trips.length})</div>
              ${trips.length ? `
              <div style="overflow-x:auto">
              <table class="data-table">
                <thead><tr><th>Route</th><th>Date</th><th>Time</th><th>Driver</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  ${trips.map(t => {
                    const driver = users.find(u => u.id === t.driverId);
                    return `<tr>
                      <td><strong>${t.originState}</strong> → ${t.destination}</td>
                      <td>${new Date(t.departureDate).toLocaleDateString('en-NG')}</td>
                      <td>${t.departureTime || '—'}</td>
                      <td>${driver?.fullName || 'Unknown'}</td>
                      <td><span class="badge ${t.status === 'active' ? 'badge-green' : 'badge-red'}">${t.status}</span></td>
                      <td><button class="btn btn-outline-red btn-sm" onclick="App.adminDeleteTrip('${t.id}')">Delete</button></td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
              </div>` : '<div class="empty-state"><div class="icon">🗺️</div><h3>No trips yet</h3></div>'}
            </div>`;
          break;

        case 'payments':
          main.innerHTML = `
            <div class="dash-header"><h1>PAYMENTS</h1><p>Payment records</p></div>
            <div class="dash-panel">
              <div class="dash-panel-title">Payment Records (${payments.length})</div>
              ${payments.length ? `
              <div style="overflow-x:auto">
              <table class="data-table">
                <thead><tr><th>Reference</th><th>Amount</th><th>Trip</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  ${payments.map(p => `<tr>
                    <td style="font-size:0.8rem">${p.reference}</td>
                    <td>₦${(p.amount||0).toLocaleString()}</td>
                    <td style="font-size:0.8rem">${p.tripId}</td>
                    <td>${new Date(p.createdAt).toLocaleDateString('en-NG')}</td>
                    <td><span class="badge badge-green">${p.status}</span></td>
                  </tr>`).join('')}
                </tbody>
              </table>
              </div>` : '<div class="empty-state"><div class="icon">💳</div><h3>No payments yet</h3></div>'}
            </div>`;
          break;

        case 'settings':
          const s = settings;
          main.innerHTML = `
            <div class="dash-header"><h1>APP SETTINGS</h1><p>Configure system-wide settings</p></div>
            <div class="dash-panel" style="max-width:480px">
              <div class="dash-panel-title">⚙️ Fee Configuration</div>
              <div class="form-group">
                <label class="form-label">Driver Chat Fee (₦) <span class="req">*</span></label>
                <input type="number" id="settings-fee" class="form-input" value="${s.driver_chat_fee || 650}" min="0">
                <div class="form-hint">Fee charged per additional passenger chat beyond the free limit</div>
              </div>
              <div class="form-group">
                <label class="form-label">Free Chat Limit <span class="req">*</span></label>
                <input type="number" id="settings-free-limit" class="form-input" value="${s.free_chat_limit || 2}" min="0">
                <div class="form-hint">Number of free passenger interactions per trip intention</div>
              </div>
              <button class="btn btn-primary" onclick="App.saveSettings()">Save Settings</button>
            </div>`;
          break;
      }
    } catch(e) {
      hideLoader();
      main.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`;
    }
  },

  async approveDriver(driverId) {
    if (!confirm('Approve this driver account?')) return;
    showLoader();
    try {
      const driver = await DB.getUserById(driverId);
      await DB.updateUser(driverId, { status: 'active' });
      await EmailService.sendUserNotification(driver.email, driver.fullName, 'approved');
      hideLoader();
      this.showToast('Driver approved and notified!', 'success');
      this.adminPanel('overview');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  async denyDriver(driverId) {
    if (!confirm('Deny this driver registration?')) return;
    showLoader();
    try {
      const driver = await DB.getUserById(driverId);
      await DB.updateUser(driverId, { status: 'denied' });
      await EmailService.sendUserNotification(driver.email, driver.fullName, 'denied');
      hideLoader();
      this.showToast('Driver denied and notified.', 'success');
      this.adminPanel('overview');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  async deactivateUser(userId) {
    if (!confirm('Deactivate this user account?')) return;
    showLoader();
    try {
      await DB.updateUser(userId, { status: 'inactive' });
      hideLoader();
      this.showToast('User deactivated.', 'success');
      this.adminPanel('drivers');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  deleteUserConfirm(userId, name) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header" style="background:linear-gradient(135deg,var(--red),var(--red-dark))"><h3>Confirm Delete</h3></div>
        <div class="modal-body"><p>Are you sure you want to permanently delete <strong>${name}</strong>? This action cannot be undone.</p></div>
        <div class="modal-footer">
          <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="App.deleteUser('${userId}'); this.closest('.modal-overlay').remove()">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async deleteUser(userId) {
    showLoader();
    try {
      await DB.deleteUser(userId);
      hideLoader();
      this.showToast('User deleted.', 'success');
      this.adminPanel('drivers');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  async adminDeleteTrip(tripId) {
    if (!confirm('Delete this trip?')) return;
    showLoader();
    try {
      await DB.deleteTrip(tripId);
      hideLoader();
      this.showToast('Trip deleted.', 'success');
      this.adminPanel('trips');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  async saveSettings() {
    const fee = parseInt(document.getElementById('settings-fee').value);
    const freeLimit = parseInt(document.getElementById('settings-free-limit').value);
    if (isNaN(fee) || isNaN(freeLimit)) { this.showToast('Please enter valid numbers', 'error'); return; }
    showLoader();
    try {
      await DB.updateSettings({ driver_chat_fee: fee, free_chat_limit: freeLimit });
      await this.loadSettings();
      hideLoader();
      this.showToast('Settings saved!', 'success');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  // ── Driver Dashboard ──
  async renderDriverDashboard() {
    const u = Auth.currentUser;
    const main = document.getElementById('dashboard-content');
    if (!main) return;

    main.innerHTML = `
      <div class="dashboard-layout">
        <div class="sidebar">
          <div class="sidebar-user">
            <div class="sidebar-avatar">${u.fullName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
            <div class="name">${u.fullName}</div>
            <div class="role">Driver</div>
            <div class="status ${u.status === 'active' ? 'status-active' : 'status-pending'}">● ${u.status}</div>
          </div>
          <div class="sidebar-menu">
            <div class="sidebar-section-title">My Account</div>
            <div class="sidebar-menu-item active" onclick="App.driverPanel('overview')"><span class="icon">📊</span> Dashboard</div>
            <div class="sidebar-menu-item" onclick="App.driverPanel('new-trip')"><span class="icon">➕</span> New Trip</div>
            <div class="sidebar-menu-item" onclick="App.driverPanel('my-trips')"><span class="icon">🗺️</span> My Trips</div>
            <div class="sidebar-menu-item" onclick="App.driverPanel('chats')"><span class="icon">💬</span> Passenger Chats</div>
            <div class="sidebar-menu-item" onclick="App.logout()"><span class="icon">🚪</span> Sign Out</div>
          </div>
        </div>
        <div class="dashboard-main" id="driver-main">
          <div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
        </div>
      </div>`;

    this.driverPanel('overview');
  },

  async driverPanel(panel) {
    const main = document.getElementById('driver-main');
    if (!main) return;
    const u = Auth.currentUser;

    document.querySelectorAll('.sidebar-menu-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`[onclick="App.driverPanel('${panel}')"]`);
    if (activeItem) activeItem.classList.add('active');

    if (u.status !== 'active' && panel !== 'overview') {
      main.innerHTML = `<div class="empty-state"><div class="icon">⏳</div><h3>Account Pending</h3><p>Your driver account is awaiting admin approval. You'll receive an email notification once reviewed.</p></div>`;
      return;
    }

    showLoader();
    try {
      const allTrips = await DB.getTrips();
      const myTrips = allTrips.filter(t => t.driverId === u.id);
      const settings = await DB.getSettings();
      hideLoader();

      switch(panel) {
        case 'overview':
          const activeMyTrips = myTrips.filter(t => t.status === 'active');
          main.innerHTML = `
            <div class="dash-header"><h1>DRIVER DASHBOARD</h1><p>Hello, ${u.fullName}! ${u.status !== 'active' ? '<span class="badge badge-yellow">Pending Approval</span>' : ''}</p></div>
            ${u.status !== 'active' ? `
              <div class="payment-prompt">
                <div class="icon">⏳</div>
                <div class="text"><h4>Account Pending Review</h4><p>The administrator is reviewing your registration. You will receive an email once your account is approved.</p></div>
              </div>` : ''}
            <div class="stats-row">
              <div class="stat-card"><div class="val">${myTrips.length}</div><div class="lbl">Total Trips Posted</div></div>
              <div class="stat-card"><div class="val">${activeMyTrips.length}</div><div class="lbl">Active Trips</div></div>
            </div>
            <div class="dash-panel">
              <div class="dash-panel-title">ℹ️ Fee Information</div>
              <p style="font-size:0.9rem;color:var(--text-light)">You have <strong>${settings.free_chat_limit || 2} free</strong> passenger chat interactions per trip. Additional chats cost <strong>₦${settings.driver_chat_fee || 650}</strong> each.</p>
            </div>`;
          break;

        case 'new-trip':
          const stateOpts = CONFIG.NIGERIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
          main.innerHTML = `
            <div class="dash-header"><h1>NEW TRIP</h1><p>Post a new travel intention</p></div>
            <div class="dash-panel" style="max-width:560px">
              <div class="dash-panel-title">🚗 Trip Details</div>
              <form id="trip-form">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Origin State <span class="req">*</span></label>
                    <select class="form-input" id="trip-origin" required><option value="">Select State</option>${stateOpts}</select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Destination <span class="req">*</span></label>
                    <select class="form-input" id="trip-dest" required><option value="">Select State</option>${stateOpts}</select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Departure Date <span class="req">*</span></label>
                    <input type="date" class="form-input" id="trip-date" min="${new Date().toISOString().split('T')[0]}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Departure Time <span class="req">*</span></label>
                    <input type="time" class="form-input" id="trip-time" required>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Pickup Point <span class="req">*</span></label>
                  <input type="text" class="form-input" id="trip-pickup" placeholder="e.g. Ojota Bus Stop, Lagos" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Available Seats <span class="req">*</span></label>
                  <input type="number" class="form-input" id="trip-seats" min="1" max="10" placeholder="e.g. 3" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Additional Notes</label>
                  <textarea class="form-input" id="trip-notes" rows="3" placeholder="Any extra information for passengers..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Post Trip Intention</button>
              </form>
            </div>`;
          document.getElementById('trip-form').addEventListener('submit', e => this.handleNewTrip(e));
          break;

        case 'my-trips':
          main.innerHTML = `
            <div class="dash-header"><h1>MY TRIPS</h1><p>Your posted trip intentions</p></div>
            <div class="dash-panel">
              ${myTrips.length ? `
              <div style="overflow-x:auto">
              <table class="data-table">
                <thead><tr><th>Route</th><th>Date</th><th>Time</th><th>Seats</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  ${myTrips.map(t => `<tr>
                    <td><strong>${t.originState}</strong> → ${t.destination}</td>
                    <td>${new Date(t.departureDate).toLocaleDateString('en-NG')}</td>
                    <td>${t.departureTime || '—'}</td>
                    <td>${t.availableSeats || '—'}</td>
                    <td><span class="badge ${t.status === 'active' ? 'badge-green' : 'badge-red'}">${t.status}</span></td>
                    <td>
                      <button class="btn btn-outline-red btn-sm" onclick="App.driverDeleteTrip('${t.id}')">Cancel</button>
                      <button class="btn btn-secondary btn-sm" onclick="App.driverViewChats('${t.id}')">Chats</button>
                    </td>
                  </tr>`).join('')}
                </tbody>
              </table>
              </div>` : `
              <div class="empty-state"><div class="icon">🗺️</div><h3>No trips yet</h3><p>Post your first travel intention!</p><button class="btn btn-primary" style="margin-top:16px" onclick="App.driverPanel('new-trip')">Post a Trip</button></div>`}
            </div>`;
          break;

        case 'chats':
          await this.renderDriverChats(main, myTrips, settings);
          break;
      }
    } catch(e) {
      hideLoader();
      main.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`;
    }
  },

  async renderDriverChats(main, myTrips, settings) {
    const db = await DB.getDB();
    const allChats = db.chats || [];
    const users = db.users || [];

    const myTripIds = myTrips.map(t => t.id);
    const myChats = allChats.filter(c => myTripIds.includes(c.tripId));

    // Group by trip
    const byTrip = {};
    myChats.forEach(c => {
      if (!byTrip[c.tripId]) byTrip[c.tripId] = [];
      byTrip[c.tripId].push(c);
    });

    let html = `<div class="dash-header"><h1>PASSENGER CHATS</h1><p>Conversations from your trip listings</p></div>`;

    if (!myChats.length) {
      html += `<div class="empty-state"><div class="icon">💬</div><h3>No chats yet</h3><p>Passengers haven't messaged you yet.</p></div>`;
      main.innerHTML = html;
      return;
    }

    for (const [tripId, chats] of Object.entries(byTrip)) {
      const trip = myTrips.find(t => t.id === tripId);
      if (!trip) continue;
      const uniquePassengers = [...new Set(chats.map(c => c.passengerId))];
      const freeLimit = settings.free_chat_limit || 2;
      const isPaidUp = uniquePassengers.length <= freeLimit;

      html += `<div class="dash-panel">
        <div class="dash-panel-title">🚗 ${trip.originState} → ${trip.destination} <span style="font-size:0.75rem;font-weight:400;color:var(--text-light)">${new Date(trip.departureDate).toLocaleDateString('en-NG')}</span></div>
        <div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-light)">${uniquePassengers.length} passenger(s) chatting · ${isPaidUp ? `<span style="color:green">✓ Within free limit (${freeLimit})</span>` : `<span style="color:var(--red)">⚠️ ${uniquePassengers.length - freeLimit} extra (₦${(uniquePassengers.length - freeLimit) * (settings.driver_chat_fee || 650)} owed)</span>`}</div>`;

      if (!isPaidUp) {
        html += `<div class="payment-prompt" style="margin-bottom:16px">
          <div class="icon">💳</div>
          <div class="text">
            <h4>Payment Required</h4>
            <p>You have exceeded your free chat limit. Pay ₦${(uniquePassengers.length - freeLimit) * (settings.driver_chat_fee || 650)} to continue accessing these chats.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.driverPayForChats('${tripId}', ${(uniquePassengers.length - freeLimit) * (settings.driver_chat_fee || 650)})">Pay Now</button>
        </div>`;
      }

      chats.forEach(chat => {
        const passenger = users.find(u => u.id === chat.passengerId);
        const lastMsg = chat.messages[chat.messages.length - 1];
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--off-white);border-radius:8px;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="driver-avatar-sm">${passenger?.fullName?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '??'}</div>
            <div>
              <div style="font-weight:700;font-size:0.9rem">${passenger?.fullName || 'Passenger'}</div>
              <div style="font-size:0.78rem;color:var(--text-light)">${lastMsg ? lastMsg.text.substring(0,40) + '...' : 'No messages yet'}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.driverOpenChat('${chat.id}')">Reply</button>
        </div>`;
      });
      html += `</div>`;
    }
    main.innerHTML = html;
  },

  async driverOpenChat(chatId) {
    showLoader();
    try {
      const db = await DB.getDB();
      const chat = db.chats.find(c => c.id === chatId);
      if (!chat) throw new Error('Chat not found');

      const passenger = db.users.find(u => u.id === chat.passengerId);
      hideLoader();

      const overlay = document.createElement('div');
      overlay.className = 'chat-modal-overlay';
      overlay.id = 'driver-chat-overlay';

      const msgsHtml = chat.messages.map(m => {
        const isSent = m.senderId === Auth.currentUser.id;
        const time = new Date(m.timestamp).toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' });
        return `<div class="message ${isSent ? 'sent' : 'received'}">${m.text}<div class="time">${time}</div></div>`;
      }).join('');

      overlay.innerHTML = `
        <div class="chat-modal">
          <div class="chat-header">
            <div><div class="title">💬 Chat with ${passenger?.fullName || 'Passenger'}</div></div>
            <button class="close-btn" onclick="document.getElementById('driver-chat-overlay').remove()">✕</button>
          </div>
          <div class="chat-messages" id="driver-chat-messages">${msgsHtml || '<div style="text-align:center;color:var(--gray);font-size:0.85rem;margin-top:20px">No messages yet</div>'}</div>
          <div class="chat-input-area">
            <input type="text" id="driver-chat-input" placeholder="Type your reply...">
            <button class="chat-send-btn" id="driver-chat-send">Send</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const msgs = document.getElementById('driver-chat-messages');
      msgs.scrollTop = msgs.scrollHeight;

      const sendMsg = async () => {
        const input = document.getElementById('driver-chat-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try {
          await DB.addMessage(chatId, { senderId: Auth.currentUser.id, senderName: Auth.currentUser.fullName, text });
          const time = new Date().toLocaleTimeString('en-NG', { hour:'2-digit', minute:'2-digit' });
          msgs.innerHTML += `<div class="message sent">${text}<div class="time">${time}</div></div>`;
          msgs.scrollTop = msgs.scrollHeight;
        } catch(e) { this.showToast('Failed to send', 'error'); }
      };

      document.getElementById('driver-chat-send').addEventListener('click', sendMsg);
      document.getElementById('driver-chat-input').addEventListener('keydown', e => { if(e.key === 'Enter') sendMsg(); });
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  driverPayForChats(tripId, amount) {
    PaymentService.initializePayment({
      email: Auth.currentUser.email,
      amount,
      tripId,
      driverId: Auth.currentUser.id,
      passengerId: null,
      onSuccess: () => {
        this.showToast('Payment successful! Full chat access restored.', 'success');
        this.driverPanel('chats');
      },
      onClose: () => this.showToast('Payment cancelled.', 'warning')
    });
  },

  async handleNewTrip(e) {
    e.preventDefault();
    const origin = document.getElementById('trip-origin').value;
    const dest = document.getElementById('trip-dest').value;
    const date = document.getElementById('trip-date').value;
    const time = document.getElementById('trip-time').value;
    const pickup = document.getElementById('trip-pickup').value;
    const seats = document.getElementById('trip-seats').value;
    const notes = document.getElementById('trip-notes').value;

    if (!origin || !dest || !date || !time || !pickup || !seats) {
      this.showToast('Please fill in all required fields', 'error'); return;
    }
    if (origin === dest) {
      this.showToast('Origin and destination cannot be the same', 'error'); return;
    }

    showLoader();
    try {
      await DB.createTrip({
        driverId: Auth.currentUser.id,
        originState: origin,
        destination: dest,
        departureDate: date,
        departureTime: time,
        departurePoint: pickup,
        availableSeats: parseInt(seats),
        notes,
        status: 'active'
      });
      hideLoader();
      this.showToast('Trip posted successfully!', 'success');
      this.driverPanel('my-trips');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  async driverDeleteTrip(tripId) {
    if (!confirm('Cancel this trip? It will no longer be visible to passengers.')) return;
    showLoader();
    try {
      await DB.updateTrip(tripId, { status: 'cancelled' });
      hideLoader();
      this.showToast('Trip cancelled.', 'success');
      this.driverPanel('my-trips');
    } catch(e) {
      hideLoader();
      this.showToast(e.message, 'error');
    }
  },

  async driverViewChats(tripId) {
    this.driverPanel('chats');
  },

  // ── Passenger Dashboard ──
  async renderPassengerDashboard() {
    const u = Auth.currentUser;
    const main = document.getElementById('dashboard-content');
    if (!main) return;

    main.innerHTML = `
      <div class="dashboard-layout">
        <div class="sidebar">
          <div class="sidebar-user">
            <div class="sidebar-avatar">${u.fullName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
            <div class="name">${u.fullName}</div>
            <div class="role">Passenger</div>
            <div class="status status-active">● Active</div>
          </div>
          <div class="sidebar-menu">
            <div class="sidebar-section-title">My Account</div>
            <div class="sidebar-menu-item active" onclick="App.passengerPanel('search')"><span class="icon">🔍</span> Find Trips</div>
            <div class="sidebar-menu-item" onclick="App.passengerPanel('my-chats')"><span class="icon">💬</span> My Chats</div>
            <div class="sidebar-menu-item" onclick="App.logout()"><span class="icon">🚪</span> Sign Out</div>
          </div>
        </div>
        <div class="dashboard-main" id="passenger-main">
          <div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
        </div>
      </div>`;

    this.passengerPanel('search');
  },

  async passengerPanel(panel) {
    const main = document.getElementById('passenger-main');
    if (!main) return;
    const u = Auth.currentUser;

    document.querySelectorAll('.sidebar-menu-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`[onclick="App.passengerPanel('${panel}')"]`);
    if (activeItem) activeItem.classList.add('active');

    switch(panel) {
      case 'search':
        const stateOpts = CONFIG.NIGERIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
        main.innerHTML = `
          <div class="dash-header"><h1>FIND A TRIP</h1><p>Search for available drivers on your route</p></div>
          <div class="dash-panel" style="margin-bottom:24px">
            <div class="dash-panel-title">🔍 Search Trips</div>
            <form id="passenger-search-form">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">From State</label>
                  <select class="form-input" id="ps-origin"><option value="">Any State</option>${stateOpts}</select>
                </div>
                <div class="form-group">
                  <label class="form-label">To Destination</label>
                  <select class="form-input" id="ps-dest"><option value="">Any Destination</option>${stateOpts}</select>
                </div>
              </div>
              <div class="form-group" style="max-width:260px">
                <label class="form-label">Travel Date</label>
                <input type="date" class="form-input" id="ps-date" min="${new Date().toISOString().split('T')[0]}">
              </div>
              <button type="submit" class="btn btn-primary">Search Trips</button>
            </form>
          </div>
          <div id="passenger-trips-container"></div>`;

        document.getElementById('passenger-search-form').addEventListener('submit', async e => {
          e.preventDefault();
          await this.passengerSearchTrips();
        });
        await this.passengerSearchTrips();
        break;

      case 'my-chats':
        showLoader();
        try {
          const db = await DB.getDB();
          const myChats = (db.chats || []).filter(c => c.passengerId === u.id);
          const users = db.users || [];
          const trips = db.trips || [];
          hideLoader();

          main.innerHTML = `<div class="dash-header"><h1>MY CHATS</h1><p>Your conversations with drivers</p></div>`;
          if (!myChats.length) {
            main.innerHTML += `<div class="empty-state"><div class="icon">💬</div><h3>No chats yet</h3><p>Chat with a driver from a trip listing to get started.</p></div>`;
            return;
          }

          let html = '<div class="dash-panel">';
          myChats.forEach(chat => {
            const driver = users.find(u => u.id === chat.driverId);
            const trip = trips.find(t => t.id === chat.tripId);
            const lastMsg = chat.messages[chat.messages.length - 1];
            html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--off-white);border-radius:8px;margin-bottom:8px">
              <div>
                <div style="font-weight:700">${driver?.fullName || 'Driver'}</div>
                <div style="font-size:0.78rem;color:var(--text-light)">${trip ? trip.originState + ' → ' + trip.destination : ''}</div>
                <div style="font-size:0.78rem;color:var(--gray);margin-top:3px">${lastMsg ? lastMsg.text.substring(0,50) + '...' : 'No messages'}</div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="App.driverOpenChat('${chat.id}')">Open Chat</button>
            </div>`;
          });
          html += '</div>';
          main.innerHTML += html;
        } catch(e) {
          hideLoader();
          main.innerHTML += `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
        }
        break;
    }
  },

  async passengerSearchTrips() {
    const container = document.getElementById('passenger-trips-container');
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>';

    const origin = document.getElementById('ps-origin')?.value;
    const dest = document.getElementById('ps-dest')?.value;
    const date = document.getElementById('ps-date')?.value;

    try {
      let trips = await DB.getActiveTrips();
      const users = await DB.getUsers();

      if (origin) trips = trips.filter(t => t.originState === origin);
      if (dest) trips = trips.filter(t => t.destination === dest);
      if (date) trips = trips.filter(t => t.departureDate === date);

      if (!trips.length) {
        container.innerHTML = `<div class="empty-state"><div class="icon">🚗</div><h3>No trips found</h3><p>Try different search criteria.</p></div>`;
        return;
      }

      container.innerHTML = `<div class="trips-grid">${trips.map(t => {
        const driver = users.find(u => u.id === t.driverId);
        return this.renderTripCard(t, driver);
      }).join('')}</div>`;

      container.querySelectorAll('.trip-card').forEach(card => {
        card.addEventListener('click', () => {
          const tripId = card.dataset.tripId;
          this.openTripDetail(tripId, trips, users);
        });
      });
    } catch(e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
    }
  },

  // ── Toast System ──
  initToasts() {
    if (!document.getElementById('toast-container')) {
      const tc = document.createElement('div');
      tc.id = 'toast-container';
      tc.className = 'toast-container';
      document.body.appendChild(tc);
    }
  },

  showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const tc = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${message}</span>`;
    tc.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
  }
};

// ── Global Helpers ──
function showLoader() {
  let l = document.getElementById('global-loader');
  if (!l) {
    l = document.createElement('div');
    l.id = 'global-loader';
    l.className = 'loader-overlay';
    l.innerHTML = '<div class="spinner"></div><div style="font-size:0.85rem;color:var(--text-light);font-weight:600">Please wait...</div>';
    document.body.appendChild(l);
  }
  l.style.display = 'flex';
}

function hideLoader() {
  const l = document.getElementById('global-loader');
  if (l) l.style.display = 'none';
}

// Start app
document.addEventListener('DOMContentLoaded', () => App.init());
