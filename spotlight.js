// ============================================================
// spotlight.js - Spotlight Products Rotator (Responsive)
// OPTIMISED VERSION
//
// Changes from original:
//
// FIX 1 (createSpotlightCard — BIGGEST IMPACT):
//   Old: loadProductDetail(product.sku)
//        → threw away the fully-loaded product object already in
//          this.currentProducts, forcing loadProductDetail to call
//          api.getAllProducts() all over again just to re-find it.
//   New: loadProductDetail(product)
//        → passes the object directly; zero extra network call.
//
// FIX 2 (DOMContentLoaded init delay):
//   Old: setTimeout(() => new SpotlightProducts(), 2000)
//        → waited 2 full seconds before even starting the first fetch.
//          The api cache is already warm by the time the page renders,
//          so a 300 ms yield is enough to let other init finish first.
//   New: setTimeout(() => new SpotlightProducts(), 300)
//
// FIX 3 (Dual-set rotation when active products > 20):
//   When totalActive > 20, two independent sets of 4/5 products are
//   selected (Set A and Set B), each following the existing paid →
//   free priority rules. The sets alternate on every 60-second tick:
//   tick 1 → Set A, tick 2 → Set B, tick 3 → Set A, …
//   Below the 20-product threshold the behaviour is unchanged.
// ============================================================

class SpotlightProducts {
    constructor() {
        this.container = document.getElementById('spotlightGrid');
        this.timerElement = document.getElementById('spotlightTimer');
        this.updateInterval = 60000;   // 60 seconds
        this.countdownInterval = 1000; // 1 second countdown
        this.remainingSeconds = 60;
        this.currentProducts = [];
        this.categories = [];

        // Dual-set state
        this.setA = [];
        this.setB = [];
        this.currentSet = 'A'; // which set is currently displayed

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
        if (window.innerWidth <= 768) {
            this.maxProducts = 4; // Mobile
        } else {
            this.maxProducts = 5; // Desktop / Tablet
        }
    }

    async init() {
        await this.loadSpotlightProducts();
        this.startTimer();
        this.startCountdown();
    }

    startTimer() {
        setInterval(async () => {
            // If we already have two valid sets built, just alternate between
            // them without hitting the network again — reload only when a full
            // refresh of both sets is due (every other tick).
            if (this.setA.length > 0 && this.setB.length > 0) {
                this.currentSet = this.currentSet === 'A' ? 'B' : 'A';
                this.currentProducts = this.currentSet === 'A' ? this.setA : this.setB;
                this.renderSpotlight();
                this.resetCountdown();
            } else {
                // Fewer than 20 products, or sets need rebuilding — do a full reload
                await this.loadSpotlightProducts();
                this.resetCountdown();
            }
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

    // ── Core selection logic: pick up to `slots` products from the
    //    paid/free pools, excluding any already chosen in `exclude`.
    //    Follows the same three-priority rules as the original code.
    selectSet(shuffledPaid, sortedFree, slots, exclude = []) {
        const selected = [];
        const usedCategories = new Set();
        const excludeSkus = new Set(exclude.map(p => p.sku));

        // PRIORITY 1: Paid adverts
        for (const product of shuffledPaid) {
            if (selected.length >= slots) break;
            if (excludeSkus.has(product.sku)) continue;
            if (!usedCategories.has(product.category) || selected.length < 3) {
                selected.push(product);
                usedCategories.add(product.category);
            }
        }

        // PRIORITY 2: Free adverts (category-diverse)
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

        // PRIORITY 3: Any remaining free adverts (no category restriction)
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

        return selected;
    }

    async loadSpotlightProducts() {
        try {
            this.updateMaxProducts();

            const allProducts = await api.getAllProducts();
            const now = new Date();

            const activeProducts = allProducts.filter(p =>
                p.activityStatus === 'Active' &&
                p.images && p.images.length > 0 &&
                (!p.endDate || new Date(p.endDate) > now)
            );

            if (activeProducts.length < this.maxProducts) {
                this.setA = [];
                this.setB = [];
                this.hideSpotlight();
                return;
            }

            // Paid adverts: must have paid status, payment type, and a valid end date
            const paidAdverts = activeProducts.filter(p =>
                p.paymentStatus === 'paid' &&
                p.paymentType &&
                p.endDate &&
                new Date(p.endDate) > now
            );

            // Free adverts: fallback pool
            const freeAdverts = activeProducts.filter(p =>
                p.paymentStatus === 'free'
            );

            console.log(`Found ${paidAdverts.length} paid and ${freeAdverts.length} free adverts for spotlight`);
            console.log(`Total active products: ${activeProducts.length} — dual-set mode: ${activeProducts.length > 20}`);

            const sortedPaid = [...paidAdverts].sort((a, b) =>
                new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
            );
            const sortedFree = [...freeAdverts].sort((a, b) =>
                new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
            );

            if (activeProducts.length > 20) {
                // ── DUAL-SET MODE ───────────────────────────────────────────
                // Build Set A first, then build Set B from the remaining pool.
                const shuffledPaidA = this.shuffleArray([...sortedPaid]);
                this.setA = this.shuffleArray(
                    this.selectSet(shuffledPaidA, sortedFree, this.maxProducts, [])
                );

                // For Set B, prefer products not already in Set A
                const shuffledPaidB = this.shuffleArray([...sortedPaid]);
                this.setB = this.shuffleArray(
                    this.selectSet(shuffledPaidB, sortedFree, this.maxProducts, this.setA)
                );

                // If we couldn't fill Set B with distinct products, relax the
                // exclusion and allow overlaps rather than showing nothing.
                if (this.setB.length < this.maxProducts) {
                    const shuffledPaidFallback = this.shuffleArray([...sortedPaid]);
                    this.setB = this.shuffleArray(
                        this.selectSet(shuffledPaidFallback, sortedFree, this.maxProducts, [])
                    );
                }

                // Display the current set (alternates each tick via startTimer)
                this.currentProducts = this.currentSet === 'A' ? this.setA : this.setB;

                console.log('Dual-set A:', this.setA.map(p => ({ name: p.name, status: p.paymentStatus })));
                console.log('Dual-set B:', this.setB.map(p => ({ name: p.name, status: p.paymentStatus })));

            } else {
                // ── SINGLE-SET MODE (original behaviour) ───────────────────
                this.setA = [];
                this.setB = [];

                const shuffledPaid = this.shuffleArray([...sortedPaid]);
                const selectedProducts = this.selectSet(shuffledPaid, sortedFree, this.maxProducts, []);

                if (selectedProducts.length < this.maxProducts) {
                    console.log(`Only found ${selectedProducts.length} products, hiding spotlight`);
                    this.hideSpotlight();
                    return;
                }

                this.currentProducts = this.shuffleArray(selectedProducts);

                console.log('Final spotlight selection:', this.currentProducts.map(p => ({
                    name: p.name,
                    status: p.paymentStatus,
                    category: p.category
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

        const productsToShow = this.currentProducts.slice(0, this.maxProducts);
        productsToShow.forEach(product => {
            const card = this.createSpotlightCard(product);
            this.container.appendChild(card);
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

        const price = typeof product.price === 'number'
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

        // ── FIX 1: Pass the full product object — eliminates the
        //    getAllProducts() re-fetch that the old product.sku call triggered ──
        card.addEventListener('click', () => {
            if (typeof loadProductDetail === 'function') {
                // Record that we came from the home/landing view so the
                // Back button on productDetailSection returns here correctly.
                window.previousSection = 'categoriesSection';
                loadProductDetail(product);   // was: loadProductDetail(product.sku)
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

// ── FIX 2: Reduced init delay from 2000 ms → 300 ms.
//    The api cache is already warm from the page-load fetch,
//    so the spotlight no longer needs to wait 2 full seconds. ──
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new SpotlightProducts();
    }, 300); // was: 2000
});
