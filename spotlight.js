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
