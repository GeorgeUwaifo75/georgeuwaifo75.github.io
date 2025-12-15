// Main Application Module
class WebStarNgApp {
    constructor() {
        this.init();
    }

    async init() {
        this.checkAuth();
        this.loadUserData();
        this.setupEventListeners();
        this.setupMenuNavigation();
    }

    checkAuth() {
        const token = localStorage.getItem('webstarng_token');
        if (!token) {
            window.location.href = 'index.html';
        }
    }

    async loadUserData() {
        try {
            // Get current user from session
            const userStr = localStorage.getItem('webstarng_user');
            if (!userStr) {
                this.logout();
                return;
            }

            const currentUser = JSON.parse(userStr);
            
            // Update UI with user data
            this.updateUserDisplay(currentUser);
            
            // Try to get updated data from server
            const userData = await api.getUser(currentUser.userID);
            if (userData) {
                this.updateUserDisplay(userData);
                // Update session with fresh data
                localStorage.setItem('webstarng_user', JSON.stringify(userData));
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    updateUserDisplay(user) {
        const elements = {
            'currentUser': user.userID,
            'sidebarUser': user.userID,
            'userFullName': user.fullName || 'Demo User',
            'userIdDisplay': user.userID,
            'walletBalance': user.wallet ? user.wallet.toFixed(2) : '0.00',
            'sidebarBalance': user.wallet ? user.wallet.toFixed(2) : '0.00'
        };

        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        }
    }

    setupEventListeners() {
        // Logout button - MINIMAL FIX: Direct logout and redirect
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                // Clear session data
                localStorage.removeItem('webstarng_user');
                localStorage.removeItem('webstarng_token');
                // Redirect to login page
                window.location.href = 'index.html';
            });
        }
    }

    setupMenuNavigation() {
        // Home menu click
        const homeLink = document.querySelector('.home-link');
        if (homeLink) {
            homeLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.goToHomeDashboard();
            });
        }
        
        // Main menu toggle
        const menuLinks = document.querySelectorAll('.menu-link:not(.home-link)');
        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const menuItem = link.closest('.menu-item');
                const isActive = menuItem.classList.contains('active');
                
                // Close all other menus
                document.querySelectorAll('.menu-item.active').forEach(item => {
                    if (item !== menuItem) {
                        item.classList.remove('active');
                    }
                });
                
                // Toggle current menu
                menuItem.classList.toggle('active', !isActive);
                
                // Don't load content if just toggling submenu
                if (!link.hasAttribute('data-action')) {
                    const menuType = link.getAttribute('data-menu');
                    this.loadMenuContent(menuType);
                }
            });
        });
        
        // Submenu item clicks
        const submenuLinks = document.querySelectorAll('.submenu a');
        submenuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const action = link.getAttribute('data-action');
                this.handleMenuAction(action);
            });
        });
    }

    // Home functionality
    goToHomeDashboard() {
        const defaultContent = document.getElementById('defaultContent');
        const dynamicContent = document.getElementById('dynamicContent');
        const contentTitle = document.getElementById('contentTitle');
        const contentSubtitle = document.getElementById('contentSubtitle');
        
        // Show default content, hide dynamic content
        defaultContent.style.display = 'block';
        dynamicContent.style.display = 'none';
        
        // Update title and subtitle
        contentTitle.textContent = 'Dashboard Overview';
        contentSubtitle.textContent = 'Welcome back to your WebStarNg account';
        
        // Close any open submenus
        document.querySelectorAll('.menu-item.active').forEach(item => {
            item.classList.remove('active');
        });
        
        // Highlight home menu
        const allMenuLinks = document.querySelectorAll('.menu-link');
        allMenuLinks.forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector('.home-link').classList.add('active');
    }

    loadMenuContent(menuType) {
        const defaultContent = document.getElementById('defaultContent');
        const dynamicContent = document.getElementById('dynamicContent');
        const contentTitle = document.getElementById('contentTitle');
        const contentSubtitle = document.getElementById('contentSubtitle');
        
        // Hide default content, show dynamic content
        defaultContent.style.display = 'none';
        dynamicContent.style.display = 'block';
        
        let contentHTML = '';
        let title = '';
        let subtitle = '';
        
        switch(menuType) {
            case 'products':
                title = 'Products Management';
                subtitle = 'Manage your products and inventory';
                contentHTML = this.getProductsContent();
                break;
            case 'reports':
                title = 'Reports Dashboard';
                subtitle = 'View business reports and analytics';
                contentHTML = this.getReportsContent();
                break;
            case 'setup':
                title = 'System Setup';
                subtitle = 'Configure system settings and users';
                contentHTML = this.getSetupContent();
                break;
            default:
                title = 'Dashboard Overview';
                subtitle = 'Welcome back to your WebStarNg account';
                defaultContent.style.display = 'block';
                dynamicContent.style.display = 'none';
                return;
        }
        
        contentTitle.textContent = title;
        contentSubtitle.textContent = subtitle;
        dynamicContent.innerHTML = contentHTML;
        
        // Re-attach event listeners for dynamic content
        this.attachContentEventListeners();
        
        // Update menu highlighting
        const allMenuLinks = document.querySelectorAll('.menu-link');
        allMenuLinks.forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-menu="${menuType}"]`).classList.add('active');
    }

    handleMenuAction(action) {
        const contentTitle = document.getElementById('contentTitle');
        const contentSubtitle = document.getElementById('contentSubtitle');
        const dynamicContent = document.getElementById('dynamicContent');
        const defaultContent = document.getElementById('defaultContent');
        
        defaultContent.style.display = 'none';
        dynamicContent.style.display = 'block';
        
        let contentHTML = '';
        let title = '';
        let subtitle = '';
        
        switch(action) {
            case 'new-product':
                title = 'New Product';
                subtitle = 'Add a new product to your inventory';
                contentHTML = this.getNewProductForm();
                break;
            case 'buy-products':
                title = 'Buy Products';
                subtitle = 'Purchase products for your business';
                contentHTML = this.getBuyProductsForm();
                break;
            case 'wallet-topup':
                title = 'Wallet TopUp';
                subtitle = 'Add funds to your wallet';
                contentHTML = this.getWalletTopUpForm();
                break;
            case 'sales-day':
                title = 'Sales Report';
                subtitle = 'Today\'s sales summary';
                contentHTML = this.getSalesReport();
                break;
            case 'purchase-day':
                title = 'Purchase Report';
                subtitle = 'Today\'s purchases summary';
                contentHTML = this.getPurchaseReport();
                break;
            case 'inventory-report':
                title = 'Inventory Report';
                subtitle = 'Current inventory status';
                contentHTML = this.getInventoryReport();
                break;
            case 'new-user':
                title = 'New User';
                subtitle = 'Create a new system user';
                contentHTML = this.getNewUserForm();
                break;
            case 'business-details':
                title = 'Business Details';
                subtitle = 'Update your business information';
                contentHTML = this.getBusinessDetailsForm();
                break;
            case 'sell-now':
                title = 'Sell Products';
                subtitle = 'Scan or enter barcodes to sell products';
                contentHTML = this.getSellProductsInterface();
                break;    
            default:
                return;
        }
        
        contentTitle.textContent = title;
        contentSubtitle.textContent = subtitle;
        dynamicContent.innerHTML = contentHTML;
        
        // Re-attach event listeners for dynamic content
        this.attachContentEventListeners();
    }


// Add the getSellProductsInterface method
getSellProductsInterface() {
    return `
        <div class="sell-products-container">
            <div class="barcode-input-section">
                <h3>📦 Scan or Enter Barcode</h3>
                <div class="barcode-input-group">
                    <input type="text" 
                           id="barcode" 
                           class="barcode-input" 
                           placeholder="Scan barcode or enter manually and press Enter"
                           autocomplete="off"
                           autofocus>
                    <button onclick="app.clearBarcodeInput()" class="btn-small">Clear</button>
                </div>
                <div class="barcode-display" id="barcodeDisplay" style="display: none;">
                    Last scanned: <span id="lastBarcode"></span>
                </div>
                <div class="form-hint">
                    💡 Press Enter after manual entry or scan automatically
                </div>
            </div>
            
            <div class="cart-section">
                <h3>🛒 Cart Items</h3>
                <div class="cart-table-container">
                    <table class="cart-table" id="cartTable">
                        <thead>
                            <tr>
                                <th>S/No.</th>
                                <th>Barcode</th>
                                <th>Description</th>
                                <th>Price (₦)</th>
                                <th>Quantity</th>
                                <th>Subtotal (₦)</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="cartItems">
                            <tr class="empty-cart">
                                <td colspan="7">
                                    <div class="empty-cart-message">
                                        <span class="empty-icon">🛒</span>
                                        <p>No products in cart</p>
                                        <p class="hint">Start scanning or enter barcodes</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="cart-summary">
                <div class="total-amount">
                    <div class="total-label">Total Amount:</div>
                    <div class="total-value">₦<span id="totalAmount">0.00</span></div>
                </div>
                
                <div class="cart-actions">
                    <button class="btn-secondary" onclick="app.clearCart()">Clear Cart</button>
                    <button class="btn-secondary" onclick="app.handleMenuAction('products')">Cancel</button>
                    <button class="btn-primary" onclick="app.processSale()" id="payNowBtn">
                        💳 Pay Now (₦<span id="payNowAmount">0.00</span>)
                    </button>
                </div>
            </div>
        </div>
    `;
}


// Add cart management methods
initializeCart() {
    this.cart = JSON.parse(localStorage.getItem('webstarng_cart')) || [];
    this.currentCartId = `cart_${Date.now()}`;
}

addToCart(product) {
    // Check if product already exists in cart
    const existingIndex = this.cart.findIndex(item => item.barcode === product.barcode);
    
    if (existingIndex > -1) {
        // Increment quantity of existing item
        this.cart[existingIndex].quantity += 1;
        this.cart[existingIndex].subtotal = this.cart[existingIndex].quantity * this.cart[existingIndex].sellingPrice;
    } else {
        // Add new item to cart
        const cartItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sNo: this.cart.length + 1,
            barcode: product.barcode,
            name: product.name,
            description: product.description || product.name,
            sellingPrice: product.sellingPrice,
            quantity: 1,
            subtotal: product.sellingPrice,
            productId: product.id,
            category: product.category,
            timestamp: new Date().toISOString()
        };
        this.cart.push(cartItem);
    }
    
    this.saveCart();
    this.renderCart();
}

removeFromCart(itemId) {
    this.cart = this.cart.filter(item => item.id !== itemId);
    // Recalculate serial numbers
    this.cart.forEach((item, index) => {
        item.sNo = index + 1;
    });
    this.saveCart();
    this.renderCart();
}

updateQuantity(itemId, newQuantity) {
    if (newQuantity < 1) {
        this.removeFromCart(itemId);
        return;
    }
    
    const item = this.cart.find(item => item.id === itemId);
    if (item) {
        item.quantity = newQuantity;
        item.subtotal = item.quantity * item.sellingPrice;
        this.saveCart();
        this.renderCart();
    }
}

saveCart() {
    localStorage.setItem('webstarng_cart', JSON.stringify(this.cart));
}


clearCart() {
    if (this.cart.length === 0) return;
    
    if (confirm('Are you sure you want to clear all items from the cart?')) {
        this.cart = [];
        this.saveCart();
        this.renderCart();
    }
}

renderCart() {
    const cartItemsContainer = document.getElementById('cartItems');
    const totalAmountElement = document.getElementById('totalAmount');
    const payNowAmountElement = document.getElementById('payNowAmount');
    
    if (!cartItemsContainer) return;
    
    // Calculate total
    const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    
    if (this.cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <tr class="empty-cart">
                <td colspan="7">
                    <div class="empty-cart-message">
                        <span class="empty-icon">🛒</span>
                        <p>No products in cart</p>
                        <p class="hint">Start scanning or enter barcodes</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        cartItemsContainer.innerHTML = this.cart.map(item => `
            <tr class="cart-item" data-item-id="${item.id}">
                <td>${item.sNo}</td>
                <td>
                    <div class="barcode-hint">${item.barcode}</div>
                </td>
                <td>
                    <div class="product-description">
                        <strong>${item.name}</strong><br>
                        <small>${item.description}</small>
                    </div>
                </td>
                <td class="price-cell">${item.sellingPrice.toLocaleString()}</td>
                <td>
                    <div class="quantity-controls">
                        <button class="qty-btn minus" onclick="app.updateQuantity('${item.id}', ${item.quantity - 1})">−</button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button class="qty-btn plus" onclick="app.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                    </div>
                </td>
                <td class="subtotal-cell">${item.subtotal.toLocaleString()}</td>
                <td>
                    <button class="delete-btn" onclick="app.removeFromCart('${item.id}')" title="Remove item">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    // Update total amounts
    if (totalAmountElement) {
        totalAmountElement.textContent = total.toFixed(2);
    }
    if (payNowAmountElement) {
        payNowAmountElement.textContent = total.toFixed(2);
    }
    
    // Update pay now button state
    const payNowBtn = document.getElementById('payNowBtn');
    if (payNowBtn) {
        payNowBtn.disabled = this.cart.length === 0;
    }
}


// Add barcode search functionality
async searchBarcode(barcodeValue) {
    if (!barcodeValue || barcodeValue.trim() === '') {
        this.showBarcodeError('Please enter a barcode');
        return null;
    }
    
    // Show loading
    this.showBarcodeLoading(true);
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            this.showBarcodeError('Please login first');
            return null;
        }
        
        // Get user's inventory
        const inventoryData = await api.getUserInventory(currentUser.userID);
        const products = inventoryData.products || [];
        
        // Search for product by barcode
        const product = products.find(p => p.barcode === barcodeValue);
        
        if (product) {
            // Update barcode display
            this.updateBarcodeDisplay(barcodeValue);
            
            // Check if product has enough quantity
            const cartItem = this.cart.find(item => item.barcode === barcodeValue);
            const currentCartQuantity = cartItem ? cartItem.quantity : 0;
            
            if (currentCartQuantity >= product.quantity) {
                this.showBarcodeError(`Only ${product.quantity} items available in stock`);
                return null;
            }
            
            return product;
        } else {
            this.showBarcodeError(`Product with barcode "${barcodeValue}" not found in inventory`);
            return null;
        }
    } catch (error) {
        console.error('Error searching barcode:', error);
        this.showBarcodeError('Error searching inventory. Please try again.');
        return null;
    } finally {
        this.showBarcodeLoading(false);
    }
}

showBarcodeError(message) {
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
        barcodeInput.classList.add('invalid');
        barcodeInput.setAttribute('title', message);
        
        // Show temporary error
        setTimeout(() => {
            barcodeInput.classList.remove('invalid');
            barcodeInput.removeAttribute('title');
        }, 3000);
    }
    
    // Optional: Show toast notification
    alert(message);
}


showBarcodeLoading(show) {
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
        if (show) {
            barcodeInput.disabled = true;
            barcodeInput.placeholder = 'Searching inventory...';
        } else {
            barcodeInput.disabled = false;
            barcodeInput.placeholder = 'Scan barcode or enter manually and press Enter';
            barcodeInput.focus();
        }
    }
}

updateBarcodeDisplay(barcodeValue) {
    const display = document.getElementById('barcodeDisplay');
    const lastBarcodeSpan = document.getElementById('lastBarcode');
    
    if (display && lastBarcodeSpan) {
        lastBarcodeSpan.textContent = barcodeValue;
        display.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            display.style.display = 'none';
        }, 5000);
    }
}

clearBarcodeInput() {
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
    }
}

// Add barcode event listener setup
setupBarcodeInput() {
    const barcodeInput = document.getElementById('barcode');
    if (!barcodeInput) return;
    
    // Clear previous event listeners by cloning
    const newInput = barcodeInput.cloneNode(true);
    barcodeInput.parentNode.replaceChild(newInput, barcodeInput);
    
    // Add new event listeners
    newInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcodeValue = newInput.value.trim();
            
            if (barcodeValue) {
                const product = await this.searchBarcode(barcodeValue);
                if (product) {
                    this.addToCart(product);
                    newInput.value = '';
                }
            }
        }
    });
    
    // Auto-search on input (for barcode scanners that don't send Enter)
    let scannerTimeout;
    newInput.addEventListener('input', async (e) => {
        const value = e.target.value.trim();
        
        // Clear previous timeout
        if (scannerTimeout) clearTimeout(scannerTimeout);
        
        // Set timeout to detect scanner input (scanners typically input quickly)
        scannerTimeout = setTimeout(async () => {
            if (value.length >= 3) { // Barcodes are typically at least 3 chars
                const product = await this.searchBarcode(value);
                if (product) {
                    this.addToCart(product);
                    newInput.value = '';
                }
            }
        }, 100); // Wait 100ms after last input
    });
    
    // Focus on input when page loads
    newInput.focus();
}

//New addition Dec 15th

// Barcode management methods
setupBarcodeField() {
    const barcodeInput = document.getElementById('productBarcode');
    if (!barcodeInput) return;
    
    // Clone to remove previous listeners
    const newInput = barcodeInput.cloneNode(true);
    barcodeInput.parentNode.replaceChild(newInput, barcodeInput);
    
    // SIMPLE FLAG to prevent duplicates
    let hasScanned = false;
    let lastScanTime = 0;
    
    // ONLY handle keydown (Enter key)
    newInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            const value = newInput.value.trim();
            
            // Basic validation
            if (!value || value.length < 3) return;
            
            // Prevent rapid duplicate scans
            const now = Date.now();
            if (hasScanned && (now - lastScanTime) < 2000) {
                console.log('Too soon after last scan, ignoring');
                newInput.value = '';
                return;
            }
            
            hasScanned = true;
            lastScanTime = now;
            
            // Process the barcode
            await this.validateBarcode(value);
            
            // Clear input immediately
            newInput.value = '';
            
            // Reset flag after 2 seconds
            setTimeout(() => {
                hasScanned = false;
            }, 2000);
        }
    });
    
    // IGNORE input events completely for scanners
    // This prevents the duplicate from input + enter
    newInput.addEventListener('input', (e) => {
        // Do nothing - let the Enter key handler handle everything
        // This prevents the timer-based duplicate
    });
    
    // Focus on barcode field
    newInput.focus();
}
async validateBarcode(barcodeValue) {
    // Prevent empty barcodes
    if (!barcodeValue || barcodeValue.trim() === '') {
        this.showBarcodeStatus('Please enter or scan a barcode', 'error');
        return false;
    }
    
    // Show loading status
    this.showBarcodeStatus('Checking barcode availability...', 'loading');
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            this.showBarcodeStatus('Please login first', 'error');
            return false;
        }
        
        // Get inventory and check for duplicate barcode
        const inventoryData = await api.getUserInventory(currentUser.userID);
        const products = inventoryData.products || [];
        const existingProduct = products.find(p => p.barcode === barcodeValue);
        
        if (existingProduct) {
            this.showBarcodeStatus(
                `⚠️ Barcode already exists for: "${existingProduct.name}"`, 
                'warning'
            );
            return false;
        }
        
        // Barcode is available
        this.showBarcodeStatus(
            `✅ Barcode "${barcodeValue}" is available`, 
            'success'
        );
        
        // Show preview
        this.showBarcodePreview(barcodeValue);
        
        // Auto-focus next field
        setTimeout(() => {
            document.getElementById('productName')?.focus();
        }, 300);
        
        return true;
        
    } catch (error) {
        console.error('Error validating barcode:', error);
        this.showBarcodeStatus('Error checking barcode', 'error');
        return false;
    }
}

showBarcodeStatus(message, type = 'info') {
    const statusElement = document.getElementById('barcodeStatus');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // Set color based on type
    switch(type) {
        case 'success':
            statusElement.style.backgroundColor = '#d4edda';
            statusElement.style.color = '#155724';
            statusElement.style.border = '1px solid #c3e6cb';
            break;
        case 'error':
            statusElement.style.backgroundColor = '#f8d7da';
            statusElement.style.color = '#721c24';
            statusElement.style.border = '1px solid #f5c6cb';
            break;
        case 'warning':
            statusElement.style.backgroundColor = '#fff3cd';
            statusElement.style.color = '#856404';
            statusElement.style.border = '1px solid #ffeaa7';
            break;
        case 'loading':
            statusElement.style.backgroundColor = '#d1ecf1';
            statusElement.style.color = '#0c5460';
            statusElement.style.border = '1px solid #bee5eb';
            statusElement.innerHTML = `<span class="spinner"></span> ${message}`;
            break;
        default:
            statusElement.style.backgroundColor = '#e2e3e5';
            statusElement.style.color = '#383d41';
            statusElement.style.border = '1px solid #d6d8db';
    }
}

showBarcodePreview(barcodeValue) {
    const preview = document.getElementById('barcodePreview');
    const display = document.getElementById('barcodeValueDisplay');
    
    if (preview && display) {
        display.textContent = barcodeValue;
        preview.style.display = 'block';
    }
}

generateBarcode() {
    // Generate a unique barcode
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    const barcode = `BC${timestamp.slice(-8)}${random}`;
    
    const barcodeInput = document.getElementById('productBarcode');
    if (barcodeInput) {
        barcodeInput.value = barcode;
        this.validateBarcode(barcode);
    }
}


// Calculation methods
calculateProfit() {
    const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
    
    const profitMargin = sellingPrice - purchasePrice;
    const profitPercentage = purchasePrice > 0 ? ((profitMargin / purchasePrice) * 100) : 0;
    
    const profitMarginField = document.getElementById('profitMargin');
    const profitPercentageField = document.getElementById('profitPercentage');
    
    if (profitMarginField) {
        profitMarginField.value = profitMargin.toFixed(2);
    }
    
    if (profitPercentageField) {
        profitPercentageField.value = profitPercentage.toFixed(2);
    }
    
    // Validate pricing
    if (sellingPrice < purchasePrice) {
        this.showPricingWarning('Selling price should be higher than cost price');
    } else {
        this.clearPricingWarning();
    }
}

calculateTotalValue() {
    const quantity = parseInt(document.getElementById('quantity').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
    
    const totalValue = quantity * sellingPrice;
    const totalValueField = document.getElementById('totalValue');
    
    if (totalValueField) {
        totalValueField.value = totalValue.toFixed(2);
    }
}

showPricingWarning(message) {
    const sellingPriceField = document.getElementById('sellingPrice');
    if (sellingPriceField) {
        sellingPriceField.style.borderColor = '#e74c3c';
        sellingPriceField.style.backgroundColor = '#fff9f9';
        sellingPriceField.setAttribute('title', message);
    }
}

clearPricingWarning() {
    const sellingPriceField = document.getElementById('sellingPrice');
    if (sellingPriceField) {
        sellingPriceField.style.borderColor = '';
        sellingPriceField.style.backgroundColor = '';
        sellingPriceField.removeAttribute('title');
    }
}





//End addition Dec 15th

    // Updated Content Templates with real data
    async getProductsContent() {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        let inventoryData = { products: [] };
        
        try {
            if (currentUser) {
                inventoryData = await api.getUserInventory(currentUser.userID);
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
        }
        
        const productCount = inventoryData.products ? inventoryData.products.length : 0;
        const totalValue = inventoryData.products ? 
            inventoryData.products.reduce((sum, product) => sum + (product.quantity * product.sellingPrice || 0), 0) : 0;
        const lowStockCount = inventoryData.products ? 
            inventoryData.products.filter(product => product.quantity <= (product.reorderLevel || 5)).length : 0;

        return `
            <div class="content-page">
                <h2>Products Management</h2>
                <p>Manage your products, inventory, and purchases from this section.</p>
                
                <div class="report-cards">
                    <div class="report-card">
                        <h3>📦 Total Products</h3>
                        <div class="value">${productCount}</div>
                        <div class="label">Active items in inventory</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>💰 Total Value</h3>
                        <div class="value">₦${totalValue.toLocaleString()}</div>
                        <div class="label">Current inventory value</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>📊 Low Stock</h3>
                        <div class="value">${lowStockCount}</div>
                        <div class="label">Items need restocking</div>
                    </div>
                </div>
                
                <div class="quick-actions">
                    <h3>Quick Actions</h3>
                    <div class="action-buttons">
                        <button class="btn-primary" onclick="app.handleMenuAction('new-product')">
                            ➕ Add New Product
                        </button>
                        <button class="btn-secondary" onclick="app.handleMenuAction('buy-products')">
                            🛒 Buy Products
                        </button>
                        <button class="btn-secondary" onclick="app.handleMenuAction('wallet-topup')">
                            💰 Wallet TopUp
                        </button>
                    </div>
                </div>
                
                ${productCount > 0 ? `
                <h3>Recent Products</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Product Name</th>
                          <th>Category</th>
                          <th>Quantity</th>
                          <th>Price (₦)</th>
                          <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventoryData.products.slice(0, 5).map(product => `
                            <tr>
                               <td><code>${product.barcode || 'N/A'}</code></td>
                                <td>${product.name || 'Unnamed Product'}</td>
                                <td>${product.category || 'Uncategorized'}</td>
                                <td>${product.quantity || 0} ${product.unit || ''}</td>
                                <td>${(product.sellingPrice || 0).toLocaleString()}</td>
                                <td>${(product.quantity || 0) <= (product.reorderLevel || 5) ? 
                                    '<span style="color: #e74c3c;">Low Stock</span>' : 
                                    '<span class="status-active">In Stock</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}
            </div>
        `;
    }

   getNewProductForm() {
    return `
        <div class="content-page">
            <h2>New Product</h2>
            
            <form id="newProductForm" class="content-form">
                <!-- Barcode Section (Most Important) -->
                <div class="barcode-input-section" style="margin-bottom: 30px;">
                    <h3 style="color: #2c3e50; margin-bottom: 15px;">
                        <span class="menu-icon">📊</span> Product Barcode
                    </h3>
                    <p class="form-hint" style="margin-bottom: 15px;">
                        Scan barcode with scanner or enter manually. This unique identifier is required for sales.
                    </p>
                    
                    <div class="form-group">
                        <label for="productBarcode" class="required-field">Barcode *</label>
                        <div class="barcode-input-group">
                            <input type="text" 
                                   id="productBarcode" 
                                   name="productBarcode" 
                                   required 
                                   placeholder="Scan barcode or enter manually"
                                   class="barcode-input"
                                   autocomplete="off"
                                   autofocus>
                            <button type="button" class="btn-small" onclick="app.generateBarcode()">
                                Generate
                            </button>
                        </div>
                        <div class="form-hint">
                            💡 Press Enter after manual entry or scan automatically. This barcode will be used for sales.
                        </div>
                        <div id="barcodeStatus" style="display: none; margin-top: 10px; padding: 8px; border-radius: 4px;">
                        </div>
                    </div>
                </div>
                
                <!-- Basic Product Information -->
                <h3 style="color: #2c3e50; margin: 30px 0 20px 0;">
                    <span class="menu-icon">📋</span> Product Information
                </h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="productName" class="required-field">Product Name *</label>
                        <input type="text" id="productName" name="productName" required 
                               placeholder="Enter product name">
                    </div>
                    
                    <div class="form-group">
                        <label for="productCategory" class="required-field">Category *</label>
                        <select id="productCategory" name="productCategory" required>
                            <option value="">Select Category</option>
                            <option value="electronics">Electronics</option>
                            <option value="clothing">Clothing & Apparel</option>
                            <option value="food">Food & Beverages</option>
                            <option value="pharmacy">Pharmacy & Health</option>
                            <option value="stationery">Stationery & Office</option>
                            <option value="home">Home & Kitchen</option>
                            <option value="beauty">Beauty & Cosmetics</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="productCode">Product Code/SKU</label>
                        <input type="text" id="productCode" name="productCode" 
                               placeholder="e.g., SKU-001, PROD-2024">
                    </div>
                    
                    <div class="form-group">
                        <label for="brand">Brand/Manufacturer</label>
                        <input type="text" id="brand" name="brand" 
                               placeholder="Enter brand or manufacturer name">
                    </div>
                </div>
                
                <!-- Pricing Information -->
                <h3 style="color: #2c3e50; margin: 30px 0 20px 0;">
                    <span class="menu-icon">💰</span> Pricing Information
                </h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="purchasePrice" class="required-field">Cost Price (₦) *</label>
                        <input type="number" id="purchasePrice" name="purchasePrice" 
                               required min="0" step="0.01" placeholder="0.00"
                               oninput="app.calculateProfit()">
                    </div>
                    
                    <div class="form-group">
                        <label for="sellingPrice" class="required-field">Selling Price (₦) *</label>
                        <input type="number" id="sellingPrice" name="sellingPrice" 
                               required min="0" step="0.01" placeholder="0.00"
                               oninput="app.calculateProfit()">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="profitMargin" readonly>Profit Margin (₦)</label>
                        <input type="number" id="profitMargin" name="profitMargin" 
                               readonly class="readonly-field" placeholder="Auto-calculated">
                    </div>
                    
                    <div class="form-group">
                        <label for="profitPercentage" readonly>Profit Percentage (%)</label>
                        <input type="number" id="profitPercentage" name="profitPercentage" 
                               readonly class="readonly-field" placeholder="Auto-calculated">
                    </div>
                </div>
                
                <!-- Stock Information -->
                <h3 style="color: #2c3e50; margin: 30px 0 20px 0;">
                    <span class="menu-icon">📦</span> Stock Information
                </h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="quantity" class="required-field">Initial Stock Quantity *</label>
                        <input type="number" id="quantity" name="quantity" 
                               required min="0" placeholder="0"
                               oninput="app.calculateTotalValue()">
                    </div>
                    
                    <div class="form-group">
                        <label for="reorderLevel" class="required-field">Reorder Level *</label>
                        <input type="number" id="reorderLevel" name="reorderLevel" 
                               required min="0" placeholder="Minimum stock level" 
                               value="5">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="totalValue" readonly>Total Stock Value (₦)</label>
                        <input type="number" id="totalValue" name="totalValue" 
                               readonly class="readonly-field" placeholder="Auto-calculated">
                    </div>
                    
                    <div class="form-group">
                        <label for="unit">Unit of Measure</label>
                        <select id="unit" name="unit">
                            <option value="piece">Piece</option>
                            <option value="pack">Pack</option>
                            <option value="box">Box</option>
                            <option value="kg">Kilogram (kg)</option>
                            <option value="liter">Liter</option>
                            <option value="meter">Meter</option>
                            <option value="dozen">Dozen</option>
                        </select>
                    </div>
                </div>
                
                <!-- Additional Information -->
                <h3 style="color: #2c3e50; margin: 30px 0 20px 0;">
                    <span class="menu-icon">📝</span> Additional Information
                </h3>
                
                <div class="form-group">
                    <label for="productDescription">Product Description</label>
                    <textarea id="productDescription" name="productDescription" 
                              rows="4" placeholder="Enter detailed product description..."></textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="supplier">Supplier</label>
                        <input type="text" id="supplier" name="supplier" 
                               placeholder="Enter supplier name">
                    </div>
                    
                    <div class="form-group">
                        <label for="supplierCode">Supplier Code</label>
                        <input type="text" id="supplierCode" name="supplierCode" 
                               placeholder="Supplier reference code">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="location">Storage Location</label>
                        <input type="text" id="location" name="location" 
                               placeholder="e.g., Shelf A5, Warehouse Zone 2">
                    </div>
                    
                    <div class="form-group">
                        <label for="expiryDate">Expiry Date (if applicable)</label>
                        <input type="date" id="expiryDate" name="expiryDate">
                    </div>
                </div>
                
                <!-- Form Actions -->
                <div class="form-actions-content">
                    <button type="submit" class="btn-primary" id="saveProductBtn">
                        <span class="menu-icon">💾</span> Save Product
                    </button>
                    <button type="button" class="btn-secondary" id="cancelProductBtn">
                        <span class="menu-icon">↩️</span> Cancel
                    </button>
                    <button type="button" class="btn-small" onclick="app.clearProductForm()">
                        <span class="menu-icon">🗑️</span> Clear Form
                    </button>
                </div>
                
                <!-- Barcode Preview -->
                <div id="barcodePreview" style="display: none; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
                    <h4 style="color: #2c3e50; margin-bottom: 10px;">Barcode Preview</h4>
                    <div id="barcodeValueDisplay" style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; padding: 10px; background: white; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;"></div>
                    <small style="color: #7f8c8d;">This barcode will be used for scanning during sales</small>
                </div>
            </form>
        </div>
    `;
}

    // ... [Other content template methods remain the same] ...

    attachContentEventListeners() {
        // New Product Form - Save Product Button
        const saveProductBtn = document.getElementById('saveProductBtn');
        if (saveProductBtn) {
            // Remove any existing listeners
            const newBtn = saveProductBtn.cloneNode(true);
            saveProductBtn.parentNode.replaceChild(newBtn, saveProductBtn);
            
            // Add new listener
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.saveNewProduct();
            });
        }


        // New Product Form - Cancel Button
        const cancelProductBtn = document.getElementById('cancelProductBtn');
        if (cancelProductBtn) {
            // Remove any existing listeners
            const newCancelBtn = cancelProductBtn.cloneNode(true);
            cancelProductBtn.parentNode.replaceChild(newCancelBtn, cancelProductBtn);
            
            // Add new listener
            newCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearProductForm();
                this.loadMenuContent('products');
            });
        }

        // New Product Form - Form Submit
        const newProductForm = document.getElementById('newProductForm');
        if (newProductForm) {
            // Remove any existing listeners
            const newForm = newProductForm.cloneNode(true);
            newProductForm.parentNode.replaceChild(newForm, newProductForm);
            
            // Add new listener
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveNewProduct();
            });
        }
        
        // New System User Form
        const newSystemUserForm = document.getElementById('newSystemUserForm');
        if (newSystemUserForm) {
            newSystemUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                alert('New user created successfully!');
                this.loadMenuContent('setup');
            });
        }
        
        // Business Details Form
        const businessDetailsForm = document.getElementById('businessDetailsForm');
        if (businessDetailsForm) {
            businessDetailsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                alert('Business details updated successfully!');
                this.loadMenuContent('setup');
            });
        }
        
        
        // Sell Products specific listeners
          if (document.getElementById('barcode')) {
              this.initializeCart();
              this.setupBarcodeInput();
              this.renderCart();
          }
         
         //New addition Dec 15th     
          if (document.getElementById('productBarcode')) {
              this.setupBarcodeField();
              
              // Add calculation listeners
              const purchasePrice = document.getElementById('purchasePrice');
              const sellingPrice = document.getElementById('sellingPrice');
              const quantity = document.getElementById('quantity');
              
              if (purchasePrice) {
                  purchasePrice.addEventListener('input', () => this.calculateProfit());
              }
              if (sellingPrice) {
                  sellingPrice.addEventListener('input', () => this.calculateProfit());
              }
              if (quantity) {
                  quantity.addEventListener('input', () => this.calculateTotalValue());
              }
          }
        
        //End new addition Dec 15th
        
        // Update wallet balance in forms
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (currentUser) {
            const walletTopupBalance = document.getElementById('walletTopupBalance');
            const currentBalance = document.getElementById('currentBalance');
            
            if (walletTopupBalance) {
                walletTopupBalance.textContent = `₦${currentUser.wallet.toFixed(2)}`;
            }
            
            if (currentBalance) {
                currentBalance.textContent = `₦${currentUser.wallet.toFixed(2)}`;
            }
        }
    }


// Add processSale method
async processSale() {
    if (this.cart.length === 0) {
        alert('Cart is empty. Add products before processing sale.');
        return;
    }
    
    const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Confirm sale
    if (!confirm(`Process sale for ₦${total.toFixed(2)}?`)) {
        return;
    }
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login first');
            return;
        }
        
        // Get current inventory to check stock
        const inventoryData = await api.getUserInventory(currentUser.userID);
        const products = inventoryData.products || [];
        
        // Check stock availability
        for (const cartItem of this.cart) {
            const product = products.find(p => p.id === cartItem.productId);
            if (!product) {
                throw new Error(`Product "${cartItem.name}" no longer exists in inventory`);
            }
            
            if (product.quantity < cartItem.quantity) {
                throw new Error(`Insufficient stock for "${cartItem.name}". Available: ${product.quantity}, Requested: ${cartItem.quantity}`);
            }
        }
        
        // Process each item
        for (const cartItem of this.cart) {
            // Update inventory quantity
            const product = products.find(p => p.id === cartItem.productId);
            const newQuantity = product.quantity - cartItem.quantity;
            
            // Update product in inventory
            const updatedProduct = {
                ...product,
                quantity: newQuantity,
                updatedAt: new Date().toISOString()
            };
            
            // Find product index and update
            const productIndex = products.findIndex(p => p.id === cartItem.productId);
            products[productIndex] = updatedProduct;
            
            // Save updated inventory
            inventoryData.products = products;
            inventoryData.lastUpdated = new Date().toISOString();
            
            await api.updateUserInventory(currentUser.userID, inventoryData);
            
            // Record sale transaction
            await api.addSalesTransaction(currentUser.userID, {
                productId: cartItem.productId,
                productName: cartItem.name,
                barcode: cartItem.barcode,
                quantity: cartItem.quantity,
                unitPrice: cartItem.sellingPrice,
                amount: cartItem.subtotal,
                transactionId: this.currentCartId,
                paymentMethod: 'cash',
                customerInfo: 'Walk-in Customer',
                notes: `Sold ${cartItem.quantity} ${cartItem.name}`
            });
        }
        
        // Add funds to wallet (sales revenue)
        const newBalance = await api.addFunds(currentUser.userID, total);
        
        // Update user session
        currentUser.wallet = newBalance;
        localStorage.setItem('webstarng_user', JSON.stringify(currentUser));
        
        // Clear cart
        this.cart = [];
        this.saveCart();
        
        // Show success message
        alert(`✅ Sale completed successfully!\n\nTotal: ₦${total.toFixed(2)}\nNew Balance: ₦${newBalance.toFixed(2)}`);
        
        // Update UI and return to products page
        this.updateUserDisplay(currentUser);
        this.loadMenuContent('products');
        
    } catch (error) {
        console.error('Error processing sale:', error);
        alert(`❌ Sale failed: ${error.message}`);
    }
}




    async saveNewProduct() {
        // Get form values
        
        const barcode = document.getElementById('productBarcode').value.trim();
        
        const productName = document.getElementById('productName').value.trim();
        const productCategory = document.getElementById('productCategory').value;
        const productCode = document.getElementById('productCode').value.trim();
        const brand = document.getElementById('brand').value.trim();
        const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
        const sellingPrice = parseFloat(document.getElementById('sellingPrice').value);
        const quantity = parseInt(document.getElementById('quantity').value);
        const reorderLevel = parseInt(document.getElementById('reorderLevel').value);
        const description = document.getElementById('productDescription').value.trim();
        const supplier = document.getElementById('supplier').value.trim();

        // Validate required fields
        if (!productName) {
            alert('Product Name is required');
            document.getElementById('productName').focus();
            return;
        }

        if (!productCategory) {
            alert('Category is required');
            document.getElementById('productCategory').focus();
            return;
        }

        if (isNaN(purchasePrice) || purchasePrice < 0) {
            alert('Please enter a valid Purchase Price');
            document.getElementById('purchasePrice').focus();
            return;
        }

        if (isNaN(sellingPrice) || sellingPrice < 0) {
            alert('Please enter a valid Selling Price');
            document.getElementById('sellingPrice').focus();
            return;
        }

        if (isNaN(quantity) || quantity < 0) {
            alert('Please enter a valid Quantity');
            document.getElementById('quantity').focus();
            return;
        }

        if (isNaN(reorderLevel) || reorderLevel < 0) {
            alert('Please enter a valid Reorder Level');
            document.getElementById('reorderLevel').focus();
            return;
        }

        // Get current user
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login first');
            window.location.href = 'index.html';
            return;
        }

//New addition Dec 15th

        // Validate barcode first
            if (!barcode) {
                alert('Barcode is required. Please scan or enter a barcode.');
                document.getElementById('productBarcode').focus();
                return;
            }
            
            // Validate barcode length
            if (barcode.length < 3) {
                alert('Barcode must be at least 3 characters long.');
                document.getElementById('productBarcode').focus();
                return;
            }
            
            // Check if barcode already exists
            try {
                const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
                if (!currentUser) {
                    alert('Please login first');
                    window.location.href = 'index.html';
                    return;
                }
                
                const inventoryData = await api.getUserInventory(currentUser.userID);
                const existingProduct = inventoryData.products?.find(p => p.barcode === barcode);
                
                if (existingProduct) {
                    alert(`Barcode "${barcode}" already exists for product: "${existingProduct.name}". Please use a different barcode.`);
                    document.getElementById('productBarcode').focus();
                    return;
                }
            } catch (error) {
                console.error('Error checking barcode:', error);
                // Continue anyway, API will validate
            }


          
              
              
              
//End Addition Dec 15th
//New addition Dec 15th
        // Create product data object
           const productData = {
                  barcode: barcode, // This is now the primary identifier
                  name: productName,
                  category: productCategory,
                  code: productCode || `SKU-${Date.now().toString().slice(-6)}`,
                  brand: brand || 'Generic',
                  purchasePrice: purchasePrice,
                  sellingPrice: sellingPrice,
                  quantity: quantity,
                  reorderLevel: reorderLevel,
                  description: description,
                  supplier: supplier || 'Unknown',
                  supplierCode: supplierCode,
                  location: location,
                  expiryDate: expiryDate || null,
                  unit: unit,
                  profitMargin: sellingPrice - purchasePrice,
                  profitPercentage: purchasePrice > 0 ? ((sellingPrice - purchasePrice) / purchasePrice * 100) : 0,
                  totalValue: quantity * sellingPrice,
                  status: quantity > 0 ? (quantity <= reorderLevel ? 'Low Stock' : 'In Stock') : 'Out of Stock',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
              };
          
              try {
                  // Disable save button to prevent multiple submissions
                  const saveBtn = document.getElementById('saveProductBtn');
                  if (saveBtn) {
                      saveBtn.disabled = true;
                      saveBtn.innerHTML = '<span class="spinner"></span> Saving Product...';
                  }
          
                  // Save product to user's inventory bin
                  const result = await api.addProductToInventory(currentUser.userID, productData);
                  
                  if (result && result.record) {
                      // Show success message with barcode
                      alert(`✅ Product "${productName}" has been successfully saved!\n\n📊 Barcode: ${barcode}\n💰 Price: ₦${sellingPrice.toFixed(2)}\n📦 Quantity: ${quantity} ${unit}`);
                      
                      // Clear the form
                      this.clearProductForm();
                      
                      // Return to products page
                      this.loadMenuContent('products');
                  } else {
                      throw new Error('Failed to save product');
                  }
              } catch (error) {
                  console.error('Error saving product:', error);
                  
                  // Re-enable save button
                  const saveBtn = document.getElementById('saveProductBtn');
                  if (saveBtn) {
                      saveBtn.disabled = false;
                      saveBtn.innerHTML = '<span class="menu-icon">💾</span> Save Product';
                  }
                  
                  if (error.message.includes('barcode')) {
                      alert(`❌ Error: ${error.message}\n\nPlease use a different barcode.`);
                      document.getElementById('productBarcode').focus();
                  } else {
                      alert(`❌ Error saving product: ${error.message}\n\nPlease try again.`);
                  }
              }
          }

//End new addition Dec 15t

    clearProductForm() {
        // Clear all form fields
        const form = document.getElementById('newProductForm');
        if (form) {
            form.reset();
        }
        
        // Reset specific fields to defaults
        const reorderLevel = document.getElementById('reorderLevel');
        if (reorderLevel) {
            reorderLevel.value = '5';
        }
        
         const unit = document.getElementById('unit');
    if (unit) {
        unit.value = 'piece';
    }
    
    
    // Clear calculated fields
    const profitMargin = document.getElementById('profitMargin');
    const profitPercentage = document.getElementById('profitPercentage');
    const totalValue = document.getElementById('totalValue');
    
    if (profitMargin) profitMargin.value = '';
    if (profitPercentage) profitPercentage.value = '';
    if (totalValue) totalValue.value = '';
    
    // Hide barcode preview and status
    const preview = document.getElementById('barcodePreview');
    const status = document.getElementById('barcodeStatus');
    
    if (preview) preview.style.display = 'none';
    if (status) status.style.display = 'none';
    
    // Focus on barcode field
    document.getElementById('productBarcode')?.focus();
        
        
        
    }

    async processTopUp() {
        const amountInput = document.getElementById('topupAmount');
        const amount = parseFloat(amountInput.value);
        
        if (!amount || amount < 100) {
            alert('Please enter a valid amount (minimum ₦100)');
            return;
        }
        
        try {
            const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
            if (!currentUser) return;
            
            const newBalance = await api.addFunds(currentUser.userID, amount);
            
            // Update local session
            currentUser.wallet = newBalance;
            localStorage.setItem('webstarng_user', JSON.stringify(currentUser));
            
            // Update UI
            this.updateUserDisplay(currentUser);
            alert(`Successfully added ₦${amount.toFixed(2)} to your wallet!`);
            this.loadMenuContent('products');
        } catch (error) {
            alert('Error adding funds: ' + error.message);
        }
    }

    async processPurchase() {
        const quantity = parseInt(document.getElementById('buyQuantity').value) || 1;
        const unitPrice = parseFloat(document.getElementById('unitPrice').value) || 0;
        const total = quantity * unitPrice;
        const productName = document.getElementById('productSelect').options[document.getElementById('productSelect').selectedIndex].text;
        
        if (total <= 0) {
            alert('Please enter valid quantity and price');
            return;
        }
        
        try {
            const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
            if (!currentUser) return;
            
            if (total > currentUser.wallet) {
                alert(`Insufficient funds! Total: ₦${total.toFixed(2)}, Available: ₦${currentUser.wallet.toFixed(2)}`);
                return;
            }
            
            // Deduct from wallet
            const newBalance = await api.withdrawFunds(currentUser.userID, total);
            
            // Record purchase transaction
            await api.addPurchaseTransaction(currentUser.userID, {
                productName: productName.split(' - ')[0],
                quantity: quantity,
                unitPrice: unitPrice,
                amount: total,
                supplier: document.getElementById('supplier').options[document.getElementById('supplier').selectedIndex].text,
                description: `Purchase of ${quantity} ${productName.split(' - ')[0]}`
            });
            
            // Update local session
            currentUser.wallet = newBalance;
            localStorage.setItem('webstarng_user', JSON.stringify(currentUser));
            
            // Update UI
            this.updateUserDisplay(currentUser);
            alert(`Purchase successful! ₦${total.toFixed(2)} deducted from your wallet.`);
            this.loadMenuContent('products');
        } catch (error) {
            alert('Error processing purchase: ' + error.message);
        }
    }

    logout() {
        // This method is kept for compatibility
        // Clear session data
        localStorage.removeItem('webstarng_user');
        localStorage.removeItem('webstarng_token');
        // Redirect to login page
        window.location.href = 'index.html';
    }
}

// Global functions for modals (existing functionality)
function showAddFunds() {
    const modal = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    title.textContent = 'Add Funds';
    content.innerHTML = `
        <p>Add funds to your wallet:</p>
        <input type="number" id="fundAmount" placeholder="Enter amount" min="1" style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px;">
        <button onclick="addFunds()" style="padding: 10px 20px; background: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer;">Add Funds</button>
    `;
    
    modal.style.display = 'flex';
}

function showWithdraw() {
    const modal = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    title.textContent = 'Withdraw Funds';
    content.innerHTML = `
        <p>Withdraw funds from your wallet:</p>
        <input type="number" id="withdrawAmount" placeholder="Enter amount" min="1" style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px;">
        <button onclick="withdrawFunds()" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">Withdraw</button>
    `;
    
    modal.style.display = 'flex';
}

async function addFunds() {
    const amount = parseFloat(document.getElementById('fundAmount').value);
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    try {
        const userStr = localStorage.getItem('webstarng_user');
        if (!userStr) return;

        const user = JSON.parse(userStr);
        const newBalance = await api.addFunds(user.userID, amount);
        
        // Update local session
        user.wallet = newBalance;
        localStorage.setItem('webstarng_user', JSON.stringify(user));
        
        // Update UI
        app.updateUserDisplay(user);
        alert(`Successfully added ₦${amount.toFixed(2)} to your wallet!`);
        closeModal();
    } catch (error) {
        alert('Error adding funds: ' + error.message);
    }
}

async function withdrawFunds() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    try {
        const userStr = localStorage.getItem('webstarng_user');
        if (!userStr) return;

        const user = JSON.parse(userStr);
        
        if (amount > user.wallet) {
            alert('Insufficient funds');
            return;
        }

        const newBalance = await api.withdrawFunds(user.userID, amount);
        
        // Update local session
        user.wallet = newBalance;
        localStorage.setItem('webstarng_user', JSON.stringify(user));
        
        // Update UI
        app.updateUserDisplay(user);
        alert(`Successfully withdrew ₦${amount.toFixed(2)} from your wallet!`);
        closeModal();
    } catch (error) {
        alert('Error withdrawing funds: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        app = new WebStarNgApp();
        window.app = app; // Make app available globally
    }
});

//New addition Dec 15th
// Test if events are firing twice
document.getElementById('productBarcode').addEventListener('input', (e) => {
    console.log('INPUT EVENT:', e.target.value);
});

document.getElementById('productBarcode').addEventListener('keydown', (e) => {
    console.log('KEYDOWN EVENT:', e.key, 'value:', e.target.value);
});

document.getElementById('productBarcode').addEventListener('keyup', (e) => {
    console.log('KEYUP EVENT:', e.key, 'value:', e.target.value);
});
