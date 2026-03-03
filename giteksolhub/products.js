// products.js - Product management functions

// Initialize products module
async function initializeProducts() {
    console.log('Initializing products module...');
    try {
        // Check for expired products on load
        await api.checkAndUpdateExpiredProducts();
        console.log('✅ Products module initialized');
    } catch (error) {
        console.error('Error initializing products:', error);
    }
}

// Get all active products
async function getActiveProducts() {
    try {
        return await api.getActiveProducts();
    } catch (error) {
        console.error('Error getting active products:', error);
        return [];
    }
}

// Get products by category
async function getProductsByCategory(category) {
    try {
        return await api.getProductsByCategory(category);
    } catch (error) {
        console.error('Error getting products by category:', error);
        return [];
    }
}

// Get products by seller
async function getProductsBySeller(sellerId) {
    try {
        return await api.getProductsBySeller(sellerId);
    } catch (error) {
        console.error('Error getting products by seller:', error);
        return [];
    }
}

// Get single product by SKU
async function getProductBySku(sku) {
    try {
        return await api.getProductBySku(sku);
    } catch (error) {
        console.error('Error getting product:', error);
        return null;
    }
}

// Format price with commas
function formatPrice(price) {
    return '₦' + parseFloat(price).toLocaleString();
}

// Calculate days remaining for product
function getDaysRemaining(endDate) {
    if (!endDate) return null;
    
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
}

// Check if product is expiring soon (within 3 days)
function isExpiringSoon(endDate) {
    const daysRemaining = getDaysRemaining(endDate);
    return daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;
}

// Sort products by date (newest first)
function sortProductsByDate(products) {
    return products.sort((a, b) => new Date(b.dateAdvertised) - new Date(a.dateAdvertised));
}

// Filter active products only
function filterActiveProducts(products) {
    return products.filter(p => p.activityStatus === 'Active');
}

// Filter products by payment status
function filterProductsByPayment(products, status) {
    return products.filter(p => p.paymentStatus === status);
}

// Get unread chat count for a product
function getUnreadChatCount(product, userId) {
    if (!product.chats) return 0;
    
    if (userId === product.sellerId) {
        // For seller, count messages from buyers that are unread
        return product.chats.filter(chat => 
            chat.sender !== userId && !chat.read
        ).length;
    } else {
        // For buyer, count messages from seller that are unread
        return product.chats.filter(chat => 
            chat.sender === product.sellerId && !chat.read
        ).length;
    }
}

// Validate product images (minimum 4)
function validateProductImages(images) {
    return images && images.length >= 4;
}

// Create product thumbnail HTML
function createProductThumbnail(product, size = 'small') {
    const imageUrl = product.images && product.images[0] 
        ? product.images[0] 
        : 'https://via.placeholder.com/100x100?text=No+Image';
    
    return `<img src="${imageUrl}" alt="${product.name}" class="thumbnail thumbnail-${size}">`;
}

// Export functions for use in other files
window.productsAPI = {
    initializeProducts,
    getActiveProducts,
    getProductsByCategory,
    getProductsBySeller,
    getProductBySku,
    formatPrice,
    getDaysRemaining,
    isExpiringSoon,
    sortProductsByDate,
    filterActiveProducts,
    filterProductsByPayment,
    getUnreadChatCount,
    validateProductImages,
    createProductThumbnail
};
