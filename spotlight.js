// ============================================================
// spotlight.js - Spotlight Products Rotator (Responsive)
// OPTIMISED VERSION
//
// FIX 1 (createSpotlightCard):
//   Passes full product object to loadProductDetail() — zero extra
//   network call vs. the old product.sku approach.
//
// FIX 2 (DOMContentLoaded init delay):
//   Reduced from 2000 ms → 300 ms; api cache is warm by then.
//
// FIX 3 (Continuous fresh-batch rotation when active products > 20):
//   Every 60-second tick generates a brand-new randomly selected
//   batch of 4 (mobile) or 5 (desktop) products drawn from the full
//   active-product pool, while guaranteeing it differs from the
//   batch just displayed. The existing paid → free priority rules
//   are applied on every tick. When ≤ 20 active products exist the
//   original single-set behaviour is preserved unchanged.
// ============================================================

class SpotlightProducts {
    constructor() {
        this.container      = document.getElementById('spotlightGrid');
        this.timerElement   = document.getElementById('spotlightTimer');
        this.updateInterval = 60000;   // 60 seconds
        this.countdownInterval = 1000; // 1 second tick
        this.remainingSeconds  = 60;
        this.currentProducts   = [];   // SKUs currently on screen

        // Cached product pools — refreshed from API every other tick
        // so the page doesn't hammer the network every 60 s.
        this.cachedActiveProducts = [];
        this.cacheTickCount       = 0;  // how many ticks since last API fetch
        this.CACHE_REFRESH_TICKS  = 2;  // re-fetch pools every 2 ticks (2 min)

        this.updateMaxProducts();

        window.addEventListener('resize', () => {
            this.updateMaxProducts();
            if (this.currentProducts.length > 0) {
                this.renderSpotlight();
            }
        });

        this.init();
    }

    updateMaxProducts() {
        this.maxProducts = window.innerWidth <= 768 ? 4 : 5;
    }

    async init() {
        await this.loadSpotlightProducts(true); // true = force API fetch
        this.startTimer();
        this.startCountdown();
    }

    startTimer() {
        setInterval(async () => {
            // Decide whether to re-fetch from API or use cached pools
            this.cacheTickCount++;
            const forceRefresh = (this.cacheTickCount >= this.CACHE_REFRESH_TICKS);
            if (forceRefresh) this.cacheTickCount = 0;

            await this.loadSpotlightProducts(forceRefresh);
            this.resetCountdown();
        }, this.updateInterval);
    }

    startCountdown() {
        setInterval(() => {
            if (this.remainingSeconds > 0) {
                this.remainingSeconds--;
                if (this.timerElement) {
                    this.timerElement.textContent = this.remainingSeconds;
                }
            }
        }, this.countdownInterval);
    }

    resetCountdown() {
        this.remainingSeconds = 60;
        if (this.timerElement) {
            this.timerElement.textContent = this.remainingSeconds;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // selectBatch
    //   Picks up to `slots` products following the three-priority
    //   rules (paid first → free category-diverse → free any),
    //   hard-excluding every SKU in `exclude` (the previous batch).
    //   Returns a shuffled array of the chosen products.
    // ─────────────────────────────────────────────────────────────
    selectBatch(sortedPaid, sortedFree, slots, exclude = []) {
        const excludeSkus  = new Set(exclude.map(p => p.sku));
        const selected     = [];
        const usedCategories = new Set();

        // Re-shuffle paid pool on every call for variety
        const shuffledPaid = this.shuffleArray([...sortedPaid]);

        // PRIORITY 1: Paid adverts
        for (const product of shuffledPaid) {
            if (selected.length >= slots) break;
            if (excludeSkus.has(product.sku)) continue;
            if (!usedCategories.has(product.category) || selected.length < 3) {
                selected.push(product);
                usedCategories.add(product.category);
            }
        }

        // PRIORITY 2: Free adverts — category-diverse
        if (selected.length < slots && sortedFree.length > 0) {
            const shuffledFree = this.shuffleArray([...sortedFree]);
            for (const product of shuffledFree) {
                if (selected.length >= slots) break;
                if (excludeSkus.has(product.sku)) continue;
                if (!usedCategories.has(product.category) || selected.length < 4) {
                    selected.push(product);
                    usedCategories.add(product.category);
                }
            }
        }

        // PRIORITY 3: Free adverts — fill remaining slots regardless of category
        if (selected.length < slots && sortedFree.length > 0) {
            const shuffledFree = this.shuffleArray([...sortedFree]);
            for (const product of shuffledFree) {
                if (selected.length >= slots) break;
                if (excludeSkus.has(product.sku)) continue;
                if (!selected.find(p => p.sku === product.sku)) {
                    selected.push(product);
                }
            }
        }

        // ── Fallback: if excluding the previous batch left us short,
        //    relax the exclusion and fill from the full pool instead.
        if (selected.length < slots && exclude.length > 0) {
            console.log('Spotlight: relaxing exclusion to fill batch');
            return this.selectBatch(sortedPaid, sortedFree, slots, []);
        }

        return this.shuffleArray(selected);
    }

    async loadSpotlightProducts(forceApiRefresh = false) {
        try {
            this.updateMaxProducts();

            // ── Refresh cached pools from API when needed ──
            if (forceApiRefresh || this.cachedActiveProducts.length === 0) {
                const allProducts = await api.getAllProducts();
                const now = new Date();

                this.cachedActiveProducts = allProducts.filter(p =>
                    p.activityStatus === 'Active' &&
                    p.images && p.images.length > 0 &&
                    (!p.endDate || new Date(p.endDate) > now)
                );

                console.log(`Spotlight: API refresh — ${this.cachedActiveProducts.length} active products`);
            }

            const activeProducts = this.cachedActiveProducts;

            if (activeProducts.length < this.maxProducts) {
                this.hideSpotlight();
                return;
            }

            const now = new Date();

            const paidAdverts = activeProducts.filter(p =>
                p.paymentStatus === 'paid' &&
                p.paymentType   &&
                p.endDate       &&
                new Date(p.endDate) > now
            );
            const freeAdverts = activeProducts.filter(p =>
                p.paymentStatus === 'free'
            );

            const sortedPaid = [...paidAdverts].sort((a, b) =>
                new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
            );
            const sortedFree = [...freeAdverts].sort((a, b) =>
                new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
            );

            console.log(
                `Spotlight: ${paidAdverts.length} paid / ${freeAdverts.length} free — ` +
                `${activeProducts.length > 20 ? 'continuous-batch' : 'single-set'} mode`
            );

            if (activeProducts.length > 20) {
                // ── CONTINUOUS-BATCH MODE ────────────────────────────────
                // Every tick: pick a fresh batch that excludes everything
                // currently on screen, guaranteeing new products each time.
                const nextBatch = this.selectBatch(
                    sortedPaid,
                    sortedFree,
                    this.maxProducts,
                    this.currentProducts   // exclude what's showing now
                );

                if (nextBatch.length < this.maxProducts) {
                    // Shouldn't happen after the fallback in selectBatch,
                    // but hide rather than show a partial grid.
                    this.hideSpotlight();
                    return;
                }

                this.currentProducts = nextBatch;

                console.log('Spotlight batch:', this.currentProducts.map(p => ({
                    name: p.name, status: p.paymentStatus, category: p.category
                })));

            } else {
                // ── SINGLE-SET MODE (original behaviour, ≤ 20 products) ──
                const selected = this.selectBatch(sortedPaid, sortedFree, this.maxProducts, []);

                if (selected.length < this.maxProducts) {
                    console.log(`Spotlight: only ${selected.length} products — hiding`);
                    this.hideSpotlight();
                    return;
                }

                this.currentProducts = selected;

                console.log('Spotlight (single-set):', this.currentProducts.map(p => ({
                    name: p.name, status: p.paymentStatus, category: p.category
                })));
            }

            this.renderSpotlight();
            this.showSpotlight();

        } catch (error) {
            console.error('Error loading spotlight products:', error);
            this.hideSpotlight();
        }
    }

    renderSpotlight() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.currentProducts.slice(0, this.maxProducts).forEach(product => {
            this.container.appendChild(this.createSpotlightCard(product));
        });
    }

    createSpotlightCard(product) {
        const card = document.createElement('div');
        card.className = 'spotlight-card';

        const imageUrl = product.images && product.images[0]
            ? product.images[0]
            : 'https://via.placeholder.com/200x140?text=No+Image';

        const isPaid     = product.paymentStatus === 'paid';
        const badgeText  = isPaid ? '🔥 AD' : '✨';
        const badgeClass = isPaid ? 'paid' : 'free';
        const price      = typeof product.price === 'number'
            ? product.price.toLocaleString()
            : parseFloat(product.price).toLocaleString();

        card.innerHTML = `
            <div class="spotlight-badge ${badgeClass}">
                <i class="fas ${isPaid ? 'fa-crown' : 'fa-gift'}"></i>
                ${badgeText}
            </div>
            <img src="${imageUrl}" alt="${product.name}" class="spotlight-image" loading="lazy">
            <div class="spotlight-info">
                <div class="spotlight-name">${product.name}</div>
                <div class="spotlight-price">₦${price}</div>
                <div class="spotlight-category">
                    <i class="fas fa-tag"></i> ${product.category || 'General'}
                </div>
            </div>
        `;

        // FIX 1: Pass full product object — no extra network call
        card.addEventListener('click', () => {
            if (typeof loadProductDetail === 'function') {
                // Back button on productDetailSection returns to landing view
                window.previousSection = 'categoriesSection';
                loadProductDetail(product);
            }
        });

        return card;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    hideSpotlight() {
        const section = document.getElementById('spotlightSection');
        if (section) section.style.display = 'none';
    }

    showSpotlight() {
        const section = document.getElementById('spotlightSection');
        if (section) section.style.display = 'block';
    }
}

// FIX 2: 300 ms init delay — api cache is already warm by then
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => new SpotlightProducts(), 300);
});
