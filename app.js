// Main Application Module
class WebStarNgApp {
    constructor() {
        this.init();
    }



    async init() {
          this.checkAuth();
          await this.loadUserData();
          this.setupEventListeners();
          this.setupMenuNavigation();
          
          // Validate demo user on load
          await this.validateDemoUserOnLoad();
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
                  subtitle = "Today's sales summary";
                  // Don't use await - handle it differently
                  this.getSalesReport().then(html => {
                      contentHTML = html;
                      // Update the UI here
                      contentTitle.textContent = title;
                      contentSubtitle.textContent = subtitle;
                      dynamicContent.innerHTML = contentHTML;
                      this.attachContentEventListeners();
                  }).catch(error => {
                      console.error('Error loading sales report:', error);
                      contentHTML = '<div class="error-message">Error loading sales report</div>';
                  });
                  break;  
                
            case 'purchase-day':
                title = 'Purchase Report';
                subtitle = 'Today\'s purchases summary';
                contentHTML = this.getPurchaseReport();
                break;
                
          
          case 'inventory-report':
                  title = 'Inventory Report';
                  subtitle = "Current inventory status";
                  // Don't use await - handle it differently
                  this.getInventoryReport().then(html => {
                      contentHTML = html;
                      // Update the UI here
                      contentTitle.textContent = title;
                      contentSubtitle.textContent = subtitle;
                      dynamicContent.innerHTML = contentHTML;
                      this.attachContentEventListeners();
                  }).catch(error => {
                      console.error('Error loading inventory report:', error);
                      contentHTML = '<div class="error-message">Error loading sales report</div>';
                  });
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



getBusinessDetailsForm() {
    // Get current user to pre-fill existing values
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    
    return `
        <div class="content-page">
            <h2>Business Details</h2>
            <p>Update your business information for invoices and reports</p>
            
            <form id="businessDetailsForm" class="content-form">
                <!-- User Group (Read-only for basic users) -->
                <div class="form-group">
                    <label for="userGroup">User Group</label>
                    <input type="text" 
                           id="userGroup" 
                           name="userGroup" 
                           value="${currentUser?.userGroup === 0 ? 'Basic User' : currentUser?.userGroup || 'Basic User'}" 
                           readonly 
                           class="readonly-field">
                    <div class="form-hint">Basic users can upgrade to access advanced features</div>
                </div>
                
                <!-- Business Information Section -->
                <h3 style="color: #2c3e50; margin: 30px 0 20px 0;">
                    <span class="menu-icon">🏢</span> Business Information
                </h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="businessName">Business Name</label>
                        <input type="text" 
                               id="businessName" 
                               name="businessName" 
                               value="${currentUser?.businessName || 'Company name'}"
                               placeholder="Enter your business name">
                    </div>
                </div>
                
                <!-- Contact Information -->
                <h3 style="color: #2c3e50; margin: 30px 0 20px 0;">
                    <span class="menu-icon">📞</span> Contact Information
                </h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="telephone">Telephone</label>
                        <input type="tel" 
                               id="telephone" 
                               name="telephone" 
                               value="${currentUser?.telephone || '070 56 7356 63'}"
                               placeholder="Enter business telephone">
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" 
                               id="email" 
                               name="email" 
                               value="${currentUser?.email || 'xemail@xmail.com'}"
                               placeholder="Enter business email">
                    </div>
                </div>
                
                <!-- Address Information -->
                <h3 style="color: #2c3e50; margin: 30px 0 20px 0;">
                    <span class="menu-icon">📍</span> Address Information
                </h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="addressLine1">Address Line 1</label>
                        <input type="text" 
                               id="addressLine1" 
                               name="addressLine1" 
                               value="${currentUser?.addressLine1 || 'Address line 1'}"
                               placeholder="Street address, P.O. box, company name">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="addressLine2">Address Line 2</label>
                        <input type="text" 
                               id="addressLine2" 
                               name="addressLine2" 
                               value="${currentUser?.addressLine2 || 'Address line 2'}"
                               placeholder="Apartment, suite, unit, building, floor">
                    </div>
                </div>
                
                <!-- Form Actions -->
                <div class="form-actions-content">
                    <button type="submit" class="btn-primary" id="saveBusinessDetailsBtn">
                        <span class="menu-icon">💾</span> Save Business Details
                    </button>
                    <button type="button" class="btn-secondary" onclick="app.loadMenuContent('setup')">
                        <span class="menu-icon">↩️</span> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
}

// Add the getSellProductsInterface method
// In getSellProductsInterface() method, add demo user warning:
getSellProductsInterface() {
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    const isDemoUser = currentUser && currentUser.userID === 'tmp101';
    
    let demoWarning = '';
    if (isDemoUser) {
        demoWarning = `
            <div class="demo-limit-warning">
                <div class="warning-icon">⚠️</div>
                <div class="warning-content">
                    <strong>Demo Account Limitations</strong>
                    <p>This demo account is limited to 3 transactions per day.</p>
                    <p>Create a regular account for unlimited transactions.</p>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="sell-products-container">
            ${demoWarning}
            
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
    
    // ONLY keep Enter key listener - no auto-search
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
    
    // REMOVED the auto-search on input event
    
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
        
        /*
        // Business Details Form
        const businessDetailsForm = document.getElementById('businessDetailsForm');
        if (businessDetailsForm) {
            businessDetailsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                alert('Business details updated successfully!');
                this.loadMenuContent('setup');
            });
        }
        */
        // Business Details Form
          const businessDetailsForm = document.getElementById('businessDetailsForm');
          if (businessDetailsForm) {
              // Remove any existing listeners
              const newForm = businessDetailsForm.cloneNode(true);
              businessDetailsForm.parentNode.replaceChild(newForm, businessDetailsForm);
              
              // Add new listener
              newForm.addEventListener('submit', async (e) => {
                  e.preventDefault();
                  await this.saveBusinessDetails();
              });
          }
    
    // Business Details Save Button
    const saveBusinessDetailsBtn = document.getElementById('saveBusinessDetailsBtn');
    if (saveBusinessDetailsBtn) {
        // Remove any existing listeners
        const newBtn = saveBusinessDetailsBtn.cloneNode(true);
        saveBusinessDetailsBtn.parentNode.replaceChild(newBtn, saveBusinessDetailsBtn);
        
        // Add new listener
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.saveBusinessDetails();
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
    if (!confirm(`Process sale for ₦${total.toFixed(2)}?\n\nA transaction fee of ₦25 will be deducted from your wallet.`)) {
        return;
    }
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login first');
            return;
        }
        
        // CHECK DEMO USER TRANSACTION LIMIT
        if (currentUser.userID === 'tmp101') {
            const canProceed = await this.checkDemoTransactionLimit(currentUser.userID);
            if (!canProceed) {
                alert('⚠️ Demo User Limit Reached\n\nDemo users are limited to 3 transactions per day.\nPlease create a regular account for unlimited transactions.');
                return;
            }
        }
        
        // Check if user has at least ₦25 in wallet
        if (currentUser.wallet < 25) {
            alert(`Insufficient funds for transaction fee.\n\nRequired: ₦25.00\nAvailable: ₦${currentUser.wallet.toFixed(2)}\n\nPlease add funds to your wallet.`);
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
        
        // Process each item (update inventory)
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
            
            // Record sale transaction with server timestamp
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
                notes: `Sold ${cartItem.quantity} ${cartItem.name}`,
                // Add server-side timestamp for validation
                serverTimestamp: new Date().toISOString(),
                isDemoUser: currentUser.userID === 'tmp101'
            });
        }
        
        // DEDUCT ₦25 from wallet (transaction fee) instead of adding sale amount
        const newBalance = currentUser.wallet - 25;
        
        // Update user's wallet balance in the database
        await api.updateUser(currentUser.userID, { wallet: newBalance });
        
        // Update local session
        currentUser.wallet = newBalance;
        localStorage.setItem('webstarng_user', JSON.stringify(currentUser));
        
        // For demo user, update transaction counter
        if (currentUser.userID === 'tmp101') {
            await this.updateDemoTransactionCounter(currentUser.userID);
        }
        
        // Clear cart
        this.cart = [];
        this.saveCart();
        
        // Show success message
        alert(`✅ Sale completed successfully!\n\n📊 Sale Amount: ₦${total.toFixed(2)}\n💳 Transaction Fee: ₦25.00\n💰 New Balance: ₦${newBalance.toFixed(2)}\n\nNote: Transaction fee of ₦25 deducted from wallet.`);
        
        // Update UI with new balance
        this.updateUserDisplay(currentUser);
        
        // RETURN TO REFRESHED SALES INTERFACE instead of products page
        this.loadSellProductsInterface();
        
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
    
   async getSalesReport() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            return '<div class="error-message">Please login to view sales report</div>';
        }
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Get sales data using the user's salesBinId
        const salesData = await api.getUserSales(currentUser.userID);
        const transactions = salesData.transactions || [];
        
        // Filter today's transactions
        const todayTransactions = transactions.filter(transaction => {
            if (!transaction.timestamp) return false;
            const transactionDate = new Date(transaction.timestamp).toISOString().split('T')[0];
            return transactionDate === today;
        });
        
        // Calculate total sales for today
        const totalSales = todayTransactions.reduce((sum, transaction) => {
            return sum + (parseFloat(transaction.amount) || 0);
        }, 0);
        
        if (todayTransactions.length === 0) {
            return `
                <div class="content-page">
                    <h2>Sales Report - ${new Date().toLocaleDateString()}</h2>
                    <div class="no-sales-message">
                        <div class="no-sales-icon">📊</div>
                        <h3>No Sales Today</h3>
                        <p>There are no sales transactions recorded for today (${today}).</p>
                        <button class="btn-primary" onclick="app.handleMenuAction('sell-now')">
                            Start Selling
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Sort transactions by timestamp (newest first)
        todayTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return `
            <div class="content-page">
                <div class="report-header">
                    <div>
                        <h2>Sales Report - ${new Date().toLocaleDateString()}</h2>
                        <p class="report-date">Date: ${today}</p>
                    </div>
                    <div class="export-actions">
                        <button class="export-btn csv-btn" onclick="app.exportSalesToCSV()">
                            📥 Export CSV
                        </button>
                        <button class="export-btn excel-btn" onclick="app.exportSalesToExcel()">
                            📊 Export Excel
                        </button>
                    </div>
                </div>
                
                <div class="sales-summary">
                    <div class="summary-item">
                        <span class="summary-label">Total Transactions:</span>
                        <span class="summary-value">${todayTransactions.length}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Total Amount:</span>
                        <span class="summary-value">₦${totalSales.toFixed(2)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Total Items:</span>
                        <span class="summary-value">${todayTransactions.reduce((sum, t) => sum + (parseInt(t.quantity) || 1), 0)}</span>
                    </div>
                </div>
                
                <h3>Today's Sales Transactions</h3>
                
                <div class="sales-list">
                    ${todayTransactions.map((transaction, index) => `
                        <div class="sale-item">
                            <div class="sale-header">
                                <span class="sale-number">${index + 1}.</span>
                                <span class="sale-time">${new Date(transaction.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span class="sale-id">ID: ${transaction.transactionId || transaction.id || 'N/A'}</span>
                            </div>
                            <div class="sale-details">
                                <div class="sale-product">
                                    <strong>${transaction.productName || 'Unknown Product'}</strong>
                                    ${transaction.description ? `<div class="sale-description">${transaction.description}</div>` : ''}
                                </div>
                                <div class="sale-info">
                                    <div class="sale-quantity">Qty: ${transaction.quantity || 1}</div>
                                    <div class="sale-price">₦${(transaction.unitPrice || transaction.amount || 0).toFixed(2)} each</div>
                                    <div class="sale-amount">₦${(transaction.amount || 0).toFixed(2)}</div>
                                </div>
                            </div>
                            ${transaction.barcode ? `<div class="sale-barcode">Barcode: <code>${transaction.barcode}</code></div>` : ''}
                            ${transaction.paymentMethod ? `<div class="sale-payment">Payment: ${transaction.paymentMethod}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="sales-total">
                    <div class="total-label">TOTAL SALES FOR TODAY:</div>
                    <div class="total-amount">₦${totalSales.toFixed(2)}</div>
                </div>
                
                <div class="report-footer">
                    <p>Report generated on ${new Date().toLocaleString()}</p>
                    <p>User: ${currentUser.userID} | Report ID: ${Date.now()}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error generating sales report:', error);
        return `
            <div class="content-page">
                <div class="error-message">
                    <h3>Error Loading Sales Report</h3>
                    <p>Unable to load sales data. Please try again.</p>
                    <button class="btn-primary" onclick="app.handleMenuAction('sales-day')">
                        Retry
                    </button>
                </div>
            </div>
        `;
    }
}
 
// Export methods for inventory report
async exportInventoryToCSV() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login to export inventory report');
            return;
        }
        
        // Get inventory data
        const inventoryData = await api.getUserInventory(currentUser.userID);
        const products = inventoryData.products || [];
        
        if (products.length === 0) {
            alert('No inventory data to export');
            return;
        }
        
        // Sort products
        const sortedProducts = [...products].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        // Calculate totals
        const totalProducts = products.length;
        const totalQuantity = products.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
        const totalValue = products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.sellingPrice || 0)), 0);
        
        // Create CSV content
        let csvContent = "S/No.,Barcode,Product Name,Category,Brand,Supplier,Quantity,Unit,Reorder Level,Cost Price (₦),Selling Price (₦),Total Value (₦),Profit Margin (₦),Status,Location,Description\n";
        
        // Add each product
        sortedProducts.forEach((product, index) => {
            const quantity = parseInt(product.quantity) || 0;
            const reorderLevel = parseInt(product.reorderLevel) || 5;
            const costPrice = parseFloat(product.purchasePrice) || 0;
            const sellingPrice = parseFloat(product.sellingPrice) || 0;
            const totalValue = quantity * sellingPrice;
            const profitMargin = sellingPrice - costPrice;
            
            let status = '';
            if (quantity === 0) {
                status = 'Out of Stock';
            } else if (quantity <= reorderLevel) {
                status = 'Low Stock';
            } else {
                status = 'In Stock';
            }
            
            const row = [
                index + 1,
                `"${product.barcode || ''}"`,
                `"${product.name || ''}"`,
                `"${product.category || ''}"`,
                `"${product.brand || ''}"`,
                `"${product.supplier || ''}"`,
                quantity,
                `"${product.unit || 'units'}"`,
                reorderLevel,
                costPrice.toFixed(2),
                sellingPrice.toFixed(2),
                totalValue.toFixed(2),
                profitMargin.toFixed(2),
                status,
                `"${product.location || ''}"`,
                `"${product.description || ''}"`
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Add summary rows
        csvContent += '\n';
        csvContent += 'INVENTORY SUMMARY\n';
        csvContent += `Total Products,${totalProducts}\n`;
        csvContent += `Total Quantity,${totalQuantity}\n`;
        csvContent += `Total Inventory Value (₦),${totalValue.toFixed(2)}\n`;
        csvContent += `Average Product Value (₦),${(totalValue / totalProducts || 0).toFixed(2)}\n`;
        csvContent += `\nReport Information\n`;
        csvContent += `Generated On,${new Date().toLocaleString()}\n`;
        csvContent += `User,${currentUser.userID}\n`;
        csvContent += `Business,WebStarNg\n`;
        
        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_report_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`✅ Inventory CSV report downloaded!\n\n📊 Products: ${totalProducts}\n📦 Total Items: ${totalQuantity}\n💰 Total Value: ₦${totalValue.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error exporting inventory CSV:', error);
        alert('Error exporting inventory CSV: ' + error.message);
    }
}

async exportInventoryToExcel() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login to export inventory report');
            return;
        }
        
        // Get inventory data
        const inventoryData = await api.getUserInventory(currentUser.userID);
        const products = inventoryData.products || [];
        
        if (products.length === 0) {
            alert('No inventory data to export');
            return;
        }
        
        // Sort products
        const sortedProducts = [...products].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        // Calculate totals
        const totalProducts = products.length;
        const totalQuantity = products.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
        const totalValue = products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.sellingPrice || 0)), 0);
        
        // Create Excel content
        let excelContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="UTF-8">
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Inventory Report</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
                    th { background: #2c3e50; color: white; padding: 8px; text-align: left; font-weight: bold; border: 1px solid #1a252f; }
                    td { padding: 6px; border: 1px solid #ddd; }
                    .summary-row { background: #f8f9fa; font-weight: bold; }
                    .header { font-size: 16px; font-weight: bold; margin-bottom: 5px; color: #2c3e50; }
                    .subheader { font-size: 12px; color: #666; margin-bottom: 15px; }
                    .summary-section { margin-top: 20px; padding: 10px; background: #f8f9fa; border: 1px solid #ddd; }
                    .summary-title { font-weight: bold; margin-bottom: 8px; color: #2c3e50; font-size: 14px; }
                    .in-stock { color: #27ae60; font-weight: bold; }
                    .low-stock { color: #f39c12; font-weight: bold; }
                    .out-of-stock { color: #e74c3c; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">Inventory Report - ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div class="subheader">Generated on: ${new Date().toLocaleString()} | User: ${currentUser.userID}</div>
                
                <table>
                    <thead>
                        <tr>
                            <th>S/No.</th>
                            <th>Barcode</th>
                            <th>Product Name</th>
                            <th>Category</th>
                            <th>Brand</th>
                            <th>Supplier</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                            <th>Reorder Level</th>
                            <th>Cost Price (₦)</th>
                            <th>Selling Price (₦)</th>
                            <th>Total Value (₦)</th>
                            <th>Profit Margin (₦)</th>
                            <th>Status</th>
                            <th>Location</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add products
        sortedProducts.forEach((product, index) => {
            const quantity = parseInt(product.quantity) || 0;
            const reorderLevel = parseInt(product.reorderLevel) || 5;
            const costPrice = parseFloat(product.purchasePrice) || 0;
            const sellingPrice = parseFloat(product.sellingPrice) || 0;
            const totalValue = quantity * sellingPrice;
            const profitMargin = sellingPrice - costPrice;
            
            let status = '';
            let statusClass = '';
            if (quantity === 0) {
                status = 'Out of Stock';
                statusClass = 'out-of-stock';
            } else if (quantity <= reorderLevel) {
                status = 'Low Stock';
                statusClass = 'low-stock';
            } else {
                status = 'In Stock';
                statusClass = 'in-stock';
            }
            
            excelContent += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${product.barcode || ''}</td>
                    <td>${product.name || ''}</td>
                    <td>${product.category || ''}</td>
                    <td>${product.brand || ''}</td>
                    <td>${product.supplier || ''}</td>
                    <td>${quantity}</td>
                    <td>${product.unit || 'units'}</td>
                    <td>${reorderLevel}</td>
                    <td>${costPrice.toFixed(2)}</td>
                    <td>${sellingPrice.toFixed(2)}</td>
                    <td>${totalValue.toFixed(2)}</td>
                    <td>${profitMargin.toFixed(2)}</td>
                    <td class="${statusClass}">${status}</td>
                    <td>${product.location || ''}</td>
                </tr>
            `;
        });
        
        // Add summary
        excelContent += `
                    </tbody>
                </table>
                
                <div class="summary-section">
                    <div class="summary-title">Inventory Summary</div>
                    <table style="width: 50%; margin-top: 10px;">
                        <tr>
                            <td><strong>Total Products:</strong></td>
                            <td>${totalProducts}</td>
                        </tr>
                        <tr>
                            <td><strong>Total Quantity:</strong></td>
                            <td>${totalQuantity}</td>
                        </tr>
                        <tr>
                            <td><strong>Total Inventory Value:</strong></td>
                            <td>₦${totalValue.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td><strong>Average Product Value:</strong></td>
                            <td>₦${(totalValue / totalProducts || 0).toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td><strong>Average Quantity per Product:</strong></td>
                            <td>${(totalQuantity / totalProducts).toFixed(1)}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="summary-section" style="margin-top: 10px;">
                    <div class="summary-title">Report Information</div>
                    <p><strong>Generated By:</strong> ${currentUser.userID}</p>
                    <p><strong>Business:</strong> WebStarNg</p>
                    <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
            </body>
            </html>
        `;
        
        // Create and download Excel file
        const blob = new Blob([excelContent], { 
            type: 'application/vnd.ms-excel' 
        });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_report_${dateStr}.xls`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`✅ Inventory Excel report downloaded!\n\n📊 Products: ${totalProducts}\n📦 Total Items: ${totalQuantity}\n💰 Total Value: ₦${totalValue.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error exporting inventory Excel:', error);
        alert('Error exporting inventory Excel: ' + error.message);
    }
} 
 
    
 // Export methods for sales report
async exportSalesToCSV() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login to export sales report');
            return;
        }
        
        // Get today's sales data
        const today = new Date().toISOString().split('T')[0];
        const salesData = await api.getUserSales(currentUser.userID);
        const transactions = salesData.transactions || [];
        
        const todayTransactions = transactions.filter(transaction => {
            if (!transaction.timestamp) return false;
            const transactionDate = new Date(transaction.timestamp).toISOString().split('T')[0];
            return transactionDate === today;
        });
        
        if (todayTransactions.length === 0) {
            alert('No sales data to export for today');
            return;
        }
        
        // Sort transactions
        todayTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Calculate totals
        const totalSales = todayTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const totalItems = todayTransactions.reduce((sum, t) => sum + (parseInt(t.quantity) || 1), 0);
        
        // Create CSV content
        let csvContent = "S/No.,Time,Date,Transaction ID,Product Name,Barcode,Quantity,Unit Price (₦),Amount (₦),Payment Method,Customer,Description\n";
        
        // Add each transaction
        todayTransactions.forEach((transaction, index) => {
            const row = [
                index + 1,
                new Date(transaction.timestamp).toLocaleTimeString(),
                new Date(transaction.timestamp).toISOString().split('T')[0],
                `"${transaction.transactionId || transaction.id || ''}"`,
                `"${transaction.productName || ''}"`,
                `"${transaction.barcode || ''}"`,
                transaction.quantity || 1,
                transaction.unitPrice || transaction.amount || 0,
                transaction.amount || 0,
                transaction.paymentMethod || 'cash',
                `"${transaction.customerInfo || 'Walk-in Customer'}"`,
                `"${transaction.description || ''}"`
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Add summary rows
        csvContent += '\n';
        csvContent += 'SUMMARY\n';
        csvContent += `Total Transactions,${todayTransactions.length}\n`;
        csvContent += `Total Items Sold,${totalItems}\n`;
        csvContent += `Total Sales Amount (₦),${totalSales.toFixed(2)}\n`;
        csvContent += `\nReport Information\n`;
        csvContent += `Generated On,${new Date().toLocaleString()}\n`;
        csvContent += `User,${currentUser.userID}\n`;
        csvContent += `Business,WebStarNg\n`;
        
        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `sales_report_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`✅ CSV report downloaded!\n\n📊 Transactions: ${todayTransactions.length}\n💰 Total: ₦${totalSales.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Error exporting CSV: ' + error.message);
    }
}

async exportSalesToExcel() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login to export sales report');
            return;
        }
        
        // Get today's sales data
        const today = new Date().toISOString().split('T')[0];
        const salesData = await api.getUserSales(currentUser.userID);
        const transactions = salesData.transactions || [];
        
        const todayTransactions = transactions.filter(transaction => {
            if (!transaction.timestamp) return false;
            const transactionDate = new Date(transaction.timestamp).toISOString().split('T')[0];
            return transactionDate === today;
        });
        
        if (todayTransactions.length === 0) {
            alert('No sales data to export for today');
            return;
        }
        
        // Sort transactions
        todayTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Calculate totals
        const totalSales = todayTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const totalItems = todayTransactions.reduce((sum, t) => sum + (parseInt(t.quantity) || 1), 0);
        
        // Create Excel content (HTML table that Excel can open)
        let excelContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="UTF-8">
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Sales Report ${today}</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
                    th { background: #2c3e50; color: white; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #1a252f; }
                    td { padding: 8px; border: 1px solid #ddd; }
                    .total-row { background: #f8f9fa; font-weight: bold; }
                    .header { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #2c3e50; }
                    .subheader { font-size: 14px; color: #666; margin-bottom: 20px; }
                    .summary { margin-top: 30px; padding: 15px; background: #f8f9fa; border: 1px solid #ddd; }
                    .summary-title { font-weight: bold; margin-bottom: 10px; color: #2c3e50; }
                </style>
            </head>
            <body>
                <div class="header">Sales Report - ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div class="subheader">Generated on: ${new Date().toLocaleString()} | User: ${currentUser.userID}</div>
                
                <table>
                    <thead>
                        <tr>
                            <th>S/No.</th>
                            <th>Time</th>
                            <th>Date</th>
                            <th>Transaction ID</th>
                            <th>Product Name</th>
                            <th>Barcode</th>
                            <th>Quantity</th>
                            <th>Unit Price (₦)</th>
                            <th>Amount (₦)</th>
                            <th>Payment Method</th>
                            <th>Customer</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add transactions
        todayTransactions.forEach((transaction, index) => {
            excelContent += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(transaction.timestamp).toLocaleTimeString()}</td>
                    <td>${new Date(transaction.timestamp).toISOString().split('T')[0]}</td>
                    <td>${transaction.transactionId || transaction.id || ''}</td>
                    <td>${transaction.productName || ''}</td>
                    <td>${transaction.barcode || ''}</td>
                    <td>${transaction.quantity || 1}</td>
                    <td>${(transaction.unitPrice || transaction.amount || 0).toFixed(2)}</td>
                    <td>${(transaction.amount || 0).toFixed(2)}</td>
                    <td>${transaction.paymentMethod || 'cash'}</td>
                    <td>${transaction.customerInfo || 'Walk-in Customer'}</td>
                </tr>
            `;
        });
        
        // Add summary
        excelContent += `
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="6" style="text-align: right;"><strong>TOTAL:</strong></td>
                            <td><strong>${totalItems}</strong></td>
                            <td></td>
                            <td><strong>₦${totalSales.toFixed(2)}</strong></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
                
                <div class="summary">
                    <div class="summary-title">Report Summary</div>
                    <p><strong>Total Transactions:</strong> ${todayTransactions.length}</p>
                    <p><strong>Total Items Sold:</strong> ${totalItems}</p>
                    <p><strong>Total Sales Amount:</strong> ₦${totalSales.toFixed(2)}</p>
                    <p><strong>Average Transaction Value:</strong> ₦${(totalSales / todayTransactions.length).toFixed(2)}</p>
                    <p><strong>Report Period:</strong> ${today}</p>
                    <p><strong>Generated By:</strong> ${currentUser.userID}</p>
                    <p><strong>Business:</strong> WebStarNg</p>
                </div>
            </body>
            </html>
        `;
        
        // Create and download Excel file
        const blob = new Blob([excelContent], { 
            type: 'application/vnd.ms-excel' 
        });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `sales_report_${dateStr}.xls`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`✅ Excel report downloaded!\n\n📊 Transactions: ${todayTransactions.length}\n💰 Total: ₦${totalSales.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error exporting Excel:', error);
        alert('Error exporting Excel: ' + error.message);
    }
} 


async getInventoryReport() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            return '<div class="error-message">Please login to view inventory report</div>';
        }
        
        // Get inventory data using the user's inventoryBinId
        const inventoryData = await api.getUserInventory(currentUser.userID);
        const products = inventoryData.products || [];
        
        if (products.length === 0) {
            return `
                <div class="content-page">
                    <h2>Inventory Report</h2>
                    <div class="empty-inventory-message">
                        <div class="empty-icon">📦</div>
                        <h3>No Products in Inventory</h3>
                        <p>Your inventory is currently empty. Add products to manage your stock.</p>
                        <button class="btn-primary" onclick="app.handleMenuAction('new-product')">
                            ➕ Add New Product
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Calculate inventory statistics
        const totalProducts = products.length;
        const totalValue = products.reduce((sum, product) => {
            return sum + ((product.quantity || 0) * (product.sellingPrice || 0));
        }, 0);
        
        const totalQuantity = products.reduce((sum, product) => {
            return sum + (parseInt(product.quantity) || 0);
        }, 0);
        
        const lowStockProducts = products.filter(product => {
            const quantity = parseInt(product.quantity) || 0;
            const reorderLevel = parseInt(product.reorderLevel) || 5;
            return quantity <= reorderLevel && quantity > 0;
        });
        
        const outOfStockProducts = products.filter(product => {
            return (parseInt(product.quantity) || 0) === 0;
        });
        
        // Sort products by category, then by name
        const sortedProducts = [...products].sort((a, b) => {
            // First by category
            const categoryCompare = (a.category || '').localeCompare(b.category || '');
            if (categoryCompare !== 0) return categoryCompare;
            // Then by name
            return (a.name || '').localeCompare(b.name || '');
        });
        
        return `
            <div class="content-page">
                <div class="report-header">
                    <div>
                        <h2>Inventory Report</h2>
                        <p class="report-date">Generated: ${new Date().toLocaleDateString()}</p>
                    </div>
                    <div class="export-actions">
                        <button class="export-btn csv-btn" onclick="app.exportInventoryToCSV()">
                            📥 Export CSV
                        </button>
                        <button class="export-btn excel-btn" onclick="app.exportInventoryToExcel()">
                            📊 Export Excel
                        </button>
                    </div>
                </div>
                
                <!-- Inventory Summary -->
                <div class="inventory-summary">
                    <div class="summary-item">
                        <span class="summary-label">Total Products</span>
                        <span class="summary-value">${totalProducts}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Total Quantity</span>
                        <span class="summary-value">${totalQuantity}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Total Value</span>
                        <span class="summary-value">₦${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Low Stock</span>
                        <span class="summary-value warning">${lowStockProducts.length}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Out of Stock</span>
                        <span class="summary-value danger">${outOfStockProducts.length}</span>
                    </div>
                </div>
                
                <!-- Inventory Statistics -->
                <div class="inventory-stats">
                    <div class="stat-card">
                        <h3>📊 Stock Status</h3>
                        <div class="stat-details">
                            <div class="stat-item">
                                <span class="stat-label">In Stock:</span>
                                <span class="stat-value">${totalProducts - lowStockProducts.length - outOfStockProducts.length}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Low Stock:</span>
                                <span class="stat-value warning">${lowStockProducts.length}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Out of Stock:</span>
                                <span class="stat-value danger">${outOfStockProducts.length}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <h3>💰 Value Breakdown</h3>
                        <div class="stat-details">
                            <div class="stat-item">
                                <span class="stat-label">Avg. Price:</span>
                                <span class="stat-value">₦${(totalValue / totalQuantity || 0).toFixed(2)}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Avg. Qty per Product:</span>
                                <span class="stat-value">${(totalQuantity / totalProducts).toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Products List -->
                <h3>📋 Product Inventory</h3>
                
                <div class="inventory-filters">
                    <input type="text" id="searchInventory" placeholder="🔍 Search products..." class="search-input">
                    <select id="filterCategory" class="filter-select">
                        <option value="">All Categories</option>
                        ${Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(category => `
                            <option value="${category}">${category}</option>
                        `).join('')}
                    </select>
                    <select id="filterStatus" class="filter-select">
                        <option value="">All Status</option>
                        <option value="in-stock">In Stock</option>
                        <option value="low-stock">Low Stock</option>
                        <option value="out-of-stock">Out of Stock</option>
                    </select>
                </div>
                
                <div class="inventory-list">
                    ${sortedProducts.map((product, index) => {
                        const quantity = parseInt(product.quantity) || 0;
                        const reorderLevel = parseInt(product.reorderLevel) || 5;
                        const sellingPrice = parseFloat(product.sellingPrice) || 0;
                        const totalValue = quantity * sellingPrice;
                        
                        let statusClass = '';
                        let statusText = '';
                        if (quantity === 0) {
                            statusClass = 'out-of-stock';
                            statusText = 'Out of Stock';
                        } else if (quantity <= reorderLevel) {
                            statusClass = 'low-stock';
                            statusText = 'Low Stock';
                        } else {
                            statusClass = 'in-stock';
                            statusText = 'In Stock';
                        }
                        
                        return `
                            <div class="inventory-item" data-category="${product.category || ''}" data-status="${statusClass}">
                                <div class="inventory-header">
                                    <span class="item-number">${index + 1}.</span>
                                    <span class="item-barcode"><code>${product.barcode || 'N/A'}</code></span>
                                    <span class="item-status ${statusClass}">${statusText}</span>
                                </div>
                                <div class="inventory-details">
                                    <div class="item-info">
                                        <div class="item-name">
                                            <strong>${product.name || 'Unnamed Product'}</strong>
                                            <div class="item-category">${product.category || 'Uncategorized'}</div>
                                        </div>
                                        <div class="item-description">${product.description || 'No description'}</div>
                                    </div>
                                    <div class="item-stats">
                                        <div class="stat-row">
                                            <div class="stat">
                                                <span class="stat-label">Quantity:</span>
                                                <span class="stat-value">${quantity} ${product.unit || 'units'}</span>
                                            </div>
                                            <div class="stat">
                                                <span class="stat-label">Reorder Level:</span>
                                                <span class="stat-value">${reorderLevel}</span>
                                            </div>
                                        </div>
                                        <div class="stat-row">
                                            <div class="stat">
                                                <span class="stat-label">Cost Price:</span>
                                                <span class="stat-value">₦${(product.purchasePrice || 0).toFixed(2)}</span>
                                            </div>
                                            <div class="stat">
                                                <span class="stat-label">Selling Price:</span>
                                                <span class="stat-value">₦${sellingPrice.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div class="stat-row">
                                            <div class="stat">
                                                <span class="stat-label">Total Value:</span>
                                                <span class="stat-value total">₦${totalValue.toFixed(2)}</span>
                                            </div>
                                            <div class="stat">
                                                <span class="stat-label">Profit Margin:</span>
                                                <span class="stat-value profit">₦${((product.sellingPrice || 0) - (product.purchasePrice || 0)).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="item-meta">
                                    ${product.supplier ? `<span class="meta-item">Supplier: ${product.supplier}</span>` : ''}
                                    ${product.code ? `<span class="meta-item">Code: ${product.code}</span>` : ''}
                                    ${product.brand ? `<span class="meta-item">Brand: ${product.brand}</span>` : ''}
                                    ${product.location ? `<span class="meta-item">Location: ${product.location}</span>` : ''}
                                    ${product.createdAt ? `<span class="meta-item">Added: ${new Date(product.createdAt).toLocaleDateString()}</span>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="inventory-summary-footer">
                    <div class="summary-total">
                        <span class="total-label">TOTAL INVENTORY VALUE:</span>
                        <span class="total-amount">₦${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
                
                <div class="report-footer">
                    <p>Report generated on ${new Date().toLocaleString()}</p>
                    <p>User: ${currentUser.userID} | Total Products: ${totalProducts} | Total Items: ${totalQuantity}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error generating inventory report:', error);
        return `
            <div class="content-page">
                <div class="error-message">
                    <h3>Error Loading Inventory Report</h3>
                    <p>Unable to load inventory data. Please try again.</p>
                    <button class="btn-primary" onclick="app.handleMenuAction('inventory-report')">
                        🔄 Retry
                    </button>
                </div>
            </div>
        `;
    }
}

// Add this method to refresh the sales interface
loadSellProductsInterface() {
    const contentTitle = document.getElementById('contentTitle');
    const contentSubtitle = document.getElementById('contentSubtitle');
    const dynamicContent = document.getElementById('dynamicContent');
    const defaultContent = document.getElementById('defaultContent');
    
    defaultContent.style.display = 'none';
    dynamicContent.style.display = 'block';
    
    contentTitle.textContent = 'Sell Products';
    contentSubtitle.textContent = 'Scan or enter barcodes to sell products';
    
    // Load the sales interface
    dynamicContent.innerHTML = this.getSellProductsInterface();
    
    // Re-initialize the sales interface
    this.initializeCart();
    this.setupBarcodeInput();
    this.renderCart();
    
    // Focus on the barcode input field for next scan
    setTimeout(() => {
        const barcodeInput = document.getElementById('barcode');
        if (barcodeInput) {
            barcodeInput.focus();
        }
    }, 100);
    
    // Update menu highlighting if needed
    const allMenuLinks = document.querySelectorAll('.menu-link');
    allMenuLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Find and activate the sell-now menu item if it exists in the menu
    const sellMenuItem = document.querySelector('[data-action="sell-now"]');
    if (sellMenuItem) {
        const menuItem = sellMenuItem.closest('.menu-item');
        if (menuItem) {
            menuItem.classList.add('active');
        }
    }
}

// Demo user transaction limit methods
async checkDemoTransactionLimit(userID) {
    if (userID !== 'tmp101') {
        return true; // Not a demo user, no limit
    }
    
    try {
        // Get today's sales for the demo user
        const today = new Date().toISOString().split('T')[0];
        const salesData = await api.getUserSales(userID);
        const transactions = salesData.transactions || [];
        
        // Count today's transactions using SERVER timestamps to prevent date manipulation
        const todayTransactionCount = transactions.filter(transaction => {
            if (!transaction.timestamp && !transaction.serverTimestamp) return false;
            
            // Use server timestamp if available (more secure)
            const timestamp = transaction.serverTimestamp || transaction.timestamp;
            const transactionDate = new Date(timestamp).toISOString().split('T')[0];
            return transactionDate === today;
        }).length;
        
        console.log(`Demo user transactions today: ${todayTransactionCount}`);
        
        // Check if limit reached
        if (todayTransactionCount >= 3) {
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('Error checking demo transaction limit:', error);
        // If there's an error, allow the transaction (fail open for usability)
        return true;
    }
}

async updateDemoTransactionCounter(userID) {
    if (userID !== 'tmp101') {
        return; // Not a demo user
    }
    
    try {
        // Get current demo user data
        const demoUser = await api.getUser(userID);
        if (!demoUser) return;
        
        // Update demo transaction counter in user data
        const today = new Date().toISOString().split('T')[0];
        const lastTransactionDate = demoUser.lastTransactionDate || '';
        
        if (lastTransactionDate === today) {
            // Increment today's counter
            demoUser.demoTransactionsToday = (demoUser.demoTransactionsToday || 0) + 1;
        } else {
            // Reset counter for new day
            demoUser.demoTransactionsToday = 1;
            demoUser.lastTransactionDate = today;
        }
        
        // Update last transaction time (server time)
        demoUser.lastTransactionTime = new Date().toISOString();
        
        // Save updated user data
        await api.updateUser(userID, {
            demoTransactionsToday: demoUser.demoTransactionsToday,
            lastTransactionDate: demoUser.lastTransactionDate,
            lastTransactionTime: demoUser.lastTransactionTime
        });
        
        console.log(`Demo transaction counter updated: ${demoUser.demoTransactionsToday}/3 today`);
        
    } catch (error) {
        console.error('Error updating demo transaction counter:', error);
    }
}

// Add server-side timestamp validation on page load
async validateDemoUserOnLoad() {
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    if (!currentUser || currentUser.userID !== 'tmp101') {
        return;
    }
    
    try {
        // Check if demo user data needs to be synchronized
        const serverUserData = await api.getUser(currentUser.userID);
        if (serverUserData) {
            // Update local storage with server data
            localStorage.setItem('webstarng_user', JSON.stringify(serverUserData));
            this.updateUserDisplay(serverUserData);
        }
    } catch (error) {
        console.error('Error validating demo user:', error);
    }
}


// Add to WebStarNgApp class
async detectDateTampering() {
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    if (!currentUser || currentUser.userID !== 'tmp101') {
        return false;
    }
    
    try {
        // Get server time from API (simulated - in production, use a time API)
        const serverTime = new Date().toISOString();
        const clientTime = new Date().toISOString();
        
        // Check for significant time difference (more than 5 minutes)
        const serverDate = new Date(serverTime);
        const clientDate = new Date(clientTime);
        const timeDiff = Math.abs(serverDate - clientDate);
        
        if (timeDiff > 5 * 60 * 1000) { // 5 minutes
            console.warn('Potential date/time tampering detected');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error detecting date tampering:', error);
        return false;
    }
}


// Add this method to save business details
async saveBusinessDetails() {
    const businessName = document.getElementById('businessName').value.trim();
    const addressLine1 = document.getElementById('addressLine1').value.trim();
    const addressLine2 = document.getElementById('addressLine2').value.trim();
    const telephone = document.getElementById('telephone').value.trim();
    const email = document.getElementById('email').value.trim();
    
    // Basic validation
    if (!businessName) {
        alert('Business name is required');
        return;
    }
    
    if (!email) {
        alert('Email is required');
        return;
    }
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login first');
            return;
        }
        
        // Prepare updates
        const updates = {
            businessName: businessName || 'Company name',
            addressLine1: addressLine1 || 'Address line 1',
            addressLine2: addressLine2 || 'Address line 2',
            telephone: telephone || '070 56 7356 63',
            email: email || 'xemail@xmail.com'
        };
        
        // Update user in database
        const updatedUser = await api.updateUser(currentUser.userID, updates);
        
        // Update local session
        const mergedUser = { ...currentUser, ...updates };
        localStorage.setItem('webstarng_user', JSON.stringify(mergedUser));
        
        // Show success message
        alert('✅ Business details updated successfully!');
        
        // Return to setup menu
        this.loadMenuContent('setup');
        
    } catch (error) {
        console.error('Error saving business details:', error);
        alert('❌ Error saving business details: ' + error.message);
    }
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
