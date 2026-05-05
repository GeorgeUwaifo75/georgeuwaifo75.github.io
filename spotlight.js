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
            await this.loadSpotlightProducts();
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

            const sortedPaid = [...paidAdverts].sort((a, b) =>
                new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
            );
            const sortedFree = [...freeAdverts].sort((a, b) =>
                new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
            );

            const selectedProducts = [];
            const usedCategories = new Set();

            // PRIORITY 1: Paid adverts (shuffled for variety)
            const shuffledPaid = this.shuffleArray([...sortedPaid]);
            for (const product of shuffledPaid) {
                if (selectedProducts.length >= this.maxProducts) break;
                if (!usedCategories.has(product.category) || selectedProducts.length < 3) {
                    selectedProducts.push(product);
                    usedCategories.add(product.category);
                }
            }

            // PRIORITY 2: Fill remaining slots with free adverts
            if (selectedProducts.length < this.maxProducts && sortedFree.length > 0) {
                const shuffledFree = this.shuffleArray([...sortedFree]);
                for (const product of shuffledFree) {
                    if (selectedProducts.length >= this.maxProducts) break;
                    if (!usedCategories.has(product.category) || selectedProducts.length < 4) {
                        selectedProducts.push(product);
                        usedCategories.add(product.category);
                    }
                }
            }

            // PRIORITY 3: Take any remaining free adverts ignoring category diversity
            if (selectedProducts.length < this.maxProducts && sortedFree.length > 0) {
                const shuffledFree = this.shuffleArray([...sortedFree]);
                for (const product of shuffledFree) {
                    if (selectedProducts.length >= this.maxProducts) break;
                    if (!selectedProducts.includes(product)) {
                        selectedProducts.push(product);
                    }
                }
            }

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

