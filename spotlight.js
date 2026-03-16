// spotlight.js - Spotlight Products Rotator (Responsive)

class SpotlightProducts {
    constructor() {
        this.container = document.getElementById('spotlightGrid');
        this.timerElement = document.getElementById('spotlightTimer');
        this.updateInterval = 60000; // 60 seconds
        this.countdownInterval = 1000; // 1 second countdown
        this.remainingSeconds = 60;
        this.currentProducts = [];
        this.categories = [];
        
        // Set max products based on screen size
        this.updateMaxProducts();
        
        // Listen for window resize to update max products
        window.addEventListener('resize', () => {
            this.updateMaxProducts();
            if (this.currentProducts.length > 0) {
                this.renderSpotlight(); // Re-render with new max
            }
        });
        
        this.init();
    }
    
    updateMaxProducts() {
        // Determine max products based on screen width
        if (window.innerWidth <= 768) {
            this.maxProducts = 4; // Mobile: 4 products
        } else {
            this.maxProducts = 5; // Desktop/Tablet: 5 products
        }
    }
    
    async init() {
        await this.loadSpotlightProducts();
        this.startTimer();
        this.startCountdown();
    }
    
    startTimer() {
        // Update spotlight every minute
        setInterval(async () => {
            await this.loadSpotlightProducts();
            this.resetCountdown();
        }, this.updateInterval);
    }
    
    startCountdown() {
        // Update the countdown timer every second
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
   
   /* 
    async loadSpotlightProducts() {
        try {
            // Update max products in case screen was resized
            this.updateMaxProducts();
            
            // Get all active products
            const allProducts = await api.getAllProducts();
            const activeProducts = allProducts.filter(p => 
                p.activityStatus === 'Active' && 
                p.images && p.images.length > 0
            );
            
            if (activeProducts.length < this.maxProducts) {
                this.hideSpotlight();
                return;
            }
            
            // Separate paid and free adverts
            const paidAdverts = activeProducts.filter(p => 
                p.paymentStatus === 'paid' && 
                p.paymentType && 
                p.endDate && new Date(p.endDate) > new Date()
            );
            
            const freeAdverts = activeProducts.filter(p => 
                p.paymentStatus === 'free' && 
                (!p.endDate || new Date(p.endDate) > new Date())
            );
            
            // Sort by date (newest first)
            const recentPaid = [...paidAdverts].sort((a, b) => 
                new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
            );
            
            const selectedProducts = [];
            const usedCategories = new Set();
            
            // Priority 1: Randomly select from recent paid adverts
            if (recentPaid.length > 0) {
                const shuffledPaid = this.shuffleArray([...recentPaid]);
                
                for (const product of shuffledPaid) {
                    if (selectedProducts.length >= this.maxProducts) break;
                    
                    // Try to get products from different categories
                    if (!usedCategories.has(product.category) || selectedProducts.length < 3) {
                        selectedProducts.push(product);
                        usedCategories.add(product.category);
                    }
                }
            }
            
            // Priority 2: Fill remaining slots with unpaid adverts
            if (selectedProducts.length < this.maxProducts && freeAdverts.length > 0) {
                const shuffledFree = this.shuffleArray([...freeAdverts]);
                
                for (const product of shuffledFree) {
                    if (selectedProducts.length >= this.maxProducts) break;
                    
                    // Try to get products from different categories
                    if (!usedCategories.has(product.category) || selectedProducts.length < 4) {
                        selectedProducts.push(product);
                        usedCategories.add(product.category);
                    }
                }
            }
            
            // If we still have less than max products, hide the section
            if (selectedProducts.length < this.maxProducts) {
                this.hideSpotlight();
                return;
            }
            
            // Shuffle the final selection for randomness
            this.currentProducts = this.shuffleArray(selectedProducts);
            this.renderSpotlight();
            this.showSpotlight();
            
        } catch (error) {
            console.error('Error loading spotlight products:', error);
            this.hideSpotlight();
        }
    }
    */
    async loadSpotlightProducts() {
    try {
        // Update max products in case screen was resized
        this.updateMaxProducts();
        
        // Get all active products
        const allProducts = await api.getAllProducts();
        const activeProducts = allProducts.filter(p => 
            p.activityStatus === 'Active' && 
            p.images && p.images.length > 0
        );
        
        if (activeProducts.length < this.maxProducts) {
            this.hideSpotlight();
            return;
        }
        
        // Separate paid and free adverts with better filtering
        const now = new Date();
        
        // Paid adverts: must have paid status, payment type, and valid end date
        const paidAdverts = activeProducts.filter(p => 
            p.paymentStatus === 'paid' && 
            p.paymentType && 
            p.endDate && 
            new Date(p.endDate) > now
        );
        
        // Free adverts: must have free status and valid end date (if exists)
        const freeAdverts = activeProducts.filter(p => 
            p.paymentStatus === 'free' && 
            (!p.endDate || new Date(p.endDate) > now)
        );
        
        console.log(`Found ${paidAdverts.length} paid adverts and ${freeAdverts.length} free adverts`);
        
        // Sort paid adverts by date (newest first) - these get highest priority
        const sortedPaid = [...paidAdverts].sort((a, b) => 
            new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
        );
        
        // Sort free adverts by date (newest first) - these are fallback
        const sortedFree = [...freeAdverts].sort((a, b) => 
            new Date(b.dateAdvertised) - new Date(a.dateAdvertised)
        );
        
        const selectedProducts = [];
        const usedCategories = new Set();
        
        // PRIORITY 1: Select from paid adverts first (highest priority)
        // Shuffle to add randomness while maintaining paid priority
        const shuffledPaid = this.shuffleArray(sortedPaid);
        
        for (const product of shuffledPaid) {
            if (selectedProducts.length >= this.maxProducts) break;
            
            // Try to maintain category diversity, but prioritize paid adverts
            if (!usedCategories.has(product.category) || selectedProducts.length < 3) {
                selectedProducts.push(product);
                usedCategories.add(product.category);
                console.log(`Selected paid product: ${product.name} (${product.category})`);
            }
        }
        
        // PRIORITY 2: If we still need more products, fill with free adverts
        if (selectedProducts.length < this.maxProducts && sortedFree.length > 0) {
            console.log(`Need ${this.maxProducts - selectedProducts.length} more products, filling with free adverts`);
            
            // Shuffle free adverts for randomness
            const shuffledFree = this.shuffleArray(sortedFree);
            
            for (const product of shuffledFree) {
                if (selectedProducts.length >= this.maxProducts) break;
                
                // For remaining slots, be less strict about category diversity
                if (!usedCategories.has(product.category) || selectedProducts.length < 4) {
                    selectedProducts.push(product);
                    usedCategories.add(product.category);
                    console.log(`Selected free product: ${product.name} (${product.category})`);
                }
            }
        }
        
        // PRIORITY 3: If still need more products, take any remaining free adverts (ignore category diversity)
        if (selectedProducts.length < this.maxProducts && sortedFree.length > 0) {
            console.log(`Still need ${this.maxProducts - selectedProducts.length} more products, taking any available`);
            
            const shuffledFree = this.shuffleArray(sortedFree);
            
            for (const product of shuffledFree) {
                if (selectedProducts.length >= this.maxProducts) break;
                
                // Check if already selected
                if (!selectedProducts.includes(product)) {
                    selectedProducts.push(product);
                    console.log(`Selected additional free product: ${product.name}`);
                }
            }
        }
        
        // If we still have less than max products, hide the section
        if (selectedProducts.length < this.maxProducts) {
            console.log(`Only found ${selectedProducts.length} products, hiding spotlight`);
            this.hideSpotlight();
            return;
        }
        
        // Shuffle the final selection for randomness (but paid adverts will still dominate)
        this.currentProducts = this.shuffleArray(selectedProducts);
        
        // Log final selection for debugging
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
        
        // Show only up to maxProducts
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
        
        const isPaid = product.paymentStatus === 'paid';
        const badgeText = isPaid ? '🔥 AD' : '✨';
        const badgeClass = isPaid ? 'paid' : 'free';
        
        // Format price
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
        
        card.addEventListener('click', () => {
            if (typeof loadProductDetail === 'function') {
                loadProductDetail(product.sku);
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
        if (section) {
            section.style.display = 'none';
        }
    }
    
    showSpotlight() {
        const section = document.getElementById('spotlightSection');
        if (section) {
            section.style.display = 'block';
        }
    }
}

// Initialize spotlight when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other services to initialize
    setTimeout(() => {
        new SpotlightProducts();
    }, 2000);
});
