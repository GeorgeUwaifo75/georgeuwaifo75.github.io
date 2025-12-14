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
        this.salesCart = []; // Initialize sales cart
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
            case 'sell-now':
                title = 'Sell Products';
                subtitle = 'Scan or enter barcode to sell products';
                contentHTML = this.getSellProductsForm();
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
            default:
                return;
        }
        
        contentTitle.textContent = title;
        contentSubtitle.textContent = subtitle;
        dynamicContent.innerHTML = contentHTML;
        
        // Re-attach event listeners for dynamic content
        this.attachContentEventListeners();
    }

    // Sell Products Interface
    getSellProductsForm() {
        return `
            <div class="content-page">
                <h2>💰 Sell Products</h2>
                <p>Scan barcode or enter manually to add products to sale</p>
                
                <div class="sell-products-container">
                    <!-- Barcode Input Section -->
                    <div class="barcode-input-section">
                        <div class="form-group">
                            <label for="barcodeInput">
                                <span class="scan-icon">📷</span> Enter or Scan Barcode
                            </label>
                            <div class="barcode-input-wrapper">
                                <input type="text" 
                                       id="barcodeInput" 
                                       class="barcode-input"
                                       placeholder="Enter barcode or scan product..."
                                       autocomplete="off"
                                       autofocus>
                                <button type="button" id="clearBarcodeBtn" class="btn-small">Clear</button>
                            </div>
                            <div class="form-hint">
                                Press Enter to search manually or use barcode scanner
                            </div>
                        </div>
                    </div>
                    
                    <!-- Cart Items Table -->
                    <div class="cart-section">
                        <h3>Sale Items</h3>
                        <div class="cart-table-container">
                            <table class="data-table cart-table">
                                <thead>
                                    <tr>
                                        <th width="50">S/No</th>
                                        <th>Product Description</th>
                                        <th width="100">Price (₦)</th>
                                        <th width="100">Quantity</th>
                                        <th width="120">Subtotal (₦)</th>
                                        <th width="80">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="cartItems">
                                    <!-- Cart items will be loaded here -->
                                    <tr id="emptyCartMessage">
                                        <td colspan="6" class="empty-cart">
                                            <div class="empty-cart-message">
                                                <span class="empty-icon">🛒</span>
                                                <p>No products added yet</p>
                                                <p class="hint">Scan or enter barcode to add products</p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Total and Actions -->
                    <div class="cart-summary">
                        <div class="total-amount">
                            <span class="total-label">Total Amount:</span>
                            <span class="total-value">₦<span id="totalAmount">0.00</span></span>
                        </div>
                        
                        <div class="cart-actions">
                            <button type="button" id="payNowBtn" class="btn-primary pay-btn">
                                <span class="btn-icon">💳</span> Pay Now
                            </button>
                            <button type="button" id="cancelSaleBtn" class="btn-secondary">
                                <span class="btn-icon">❌</span> Cancel Sale
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

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

        // Sell Products - Barcode Input
        const barcodeInput = document.getElementById('barcodeInput');
        if (barcodeInput) {
            barcodeInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const barcode = barcodeInput.value.trim();
                    if (barcode) {
                        await this.searchProductByBarcode(barcode);
                        barcodeInput.value = '';
                        barcodeInput.focus();
                    }
                }
            });

            // Auto-search on input (for barcode scanners that don't send Enter)
            let barcodeTimer;
            barcodeInput.addEventListener('input', (e) => {
                clearTimeout(barcodeTimer);
                barcodeTimer = setTimeout(async () => {
                    const barcode = barcodeInput.value.trim();
                    if (barcode.length >= 8) { // Assuming barcodes are at least 8 digits
                        await this.searchProductByBarcode(barcode);
                        barcodeInput.value = '';
                        barcodeInput.focus();
                    }
                }, 300); // Wait 300ms after last input
            });
        }

        // Sell Products - Clear Barcode Button
        const clearBarcodeBtn = document.getElementById('clearBarcodeBtn');
        if (clearBarcodeBtn) {
            clearBarcodeBtn.addEventListener('click', () => {
                const barcodeInput = document.getElementById('barcodeInput');
                if (barcodeInput) {
                    barcodeInput.value = '';
                    barcodeInput.focus();
                }
            });
        }

        // Sell Products - Pay Now Button
        const payNowBtn = document.getElementById('payNowBtn');
        if (payNowBtn) {
            payNowBtn.addEventListener('click', async () => {
                await this.processSalePayment();
            });
        }

        // Sell Products - Cancel Sale Button
        const cancelSaleBtn = document.getElementById('cancelSaleBtn');
        if (cancelSaleBtn) {
            cancelSaleBtn.addEventListener('click', () => {
                this.clearSalesCart();
                this.loadMenuContent('products');
            });
        }
        
        // ... [Other existing event listeners] ...
    }

    async searchProductByBarcode(barcode) {
        try {
            const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
            if (!currentUser) {
                alert('Please login first');
                return;
            }

            // Get user's inventory
            const inventory = await api.getUserInventory(currentUser.userID);
            
            // Find product by barcode
            const product = inventory.products.find(p => p.barcode === barcode);
            
            if (!product) {
                alert(`❌ Product with barcode "${barcode}" not found in inventory`);
                return;
            }

            // Check if product is in stock
            if (product.quantity <= 0) {
                alert(`❌ "${product.name}" is out of stock!`);
                return;
            }

            // Add product to cart
            this.addProductToCart(product);
            
        } catch (error) {
            console.error('Error searching product:', error);
            alert('Error searching product: ' + error.message);
        }
    }

    addProductToCart(product) {
        // Check if product already exists in cart
        const existingItemIndex = this.salesCart.findIndex(item => item.id === product.id);
        
        if (existingItemIndex !== -1) {
            // Update quantity if product already in cart
            this.salesCart[existingItemIndex].quantity += 1;
            this.salesCart[existingItemIndex].subtotal = 
                this.salesCart[existingItemIndex].quantity * this.salesCart[existingItemIndex].price;
        } else {
            // Add new product to cart
            const cartItem = {
                id: product.id,
                sNo: this.salesCart.length + 1,
                description: product.name,
                price: product.sellingPrice || 0,
                quantity: 1,
                subtotal: product.sellingPrice || 0,
                barcode: product.barcode,
                originalQuantity: product.quantity // Store original stock for validation
            };
            this.salesCart.push(cartItem);
        }

        // Update cart display
        this.updateCartDisplay();
    }

    updateCartDisplay() {
        const cartItemsContainer = document.getElementById('cartItems');
        const totalAmountElement = document.getElementById('totalAmount');
        const emptyCartMessage = document.getElementById('emptyCartMessage');
        
        if (!cartItemsContainer) return;

        // Clear current cart display
        cartItemsContainer.innerHTML = '';
        
        if (this.salesCart.length === 0) {
            // Show empty cart message
            if (emptyCartMessage) {
                emptyCartMessage.style.display = '';
            }
            totalAmountElement.textContent = '0.00';
            return;
        }

        // Hide empty cart message
        if (emptyCartMessage) {
            emptyCartMessage.style.display = 'none';
        }

        // Calculate total
        let total = 0;

        // Add each cart item to display
        this.salesCart.forEach((item, index) => {
            item.sNo = index + 1; // Update serial number
            total += item.subtotal;

            const row = document.createElement('tr');
            row.className = 'cart-item';
            row.innerHTML = `
                <td>${item.sNo}</td>
                <td>
                    <div class="product-description">
                        <strong>${item.description}</strong>
                        ${item.barcode ? `<div class="barcode-hint">Barcode: ${item.barcode}</div>` : ''}
                    </div>
                </td>
                <td class="price-cell">₦${item.price.toFixed(2)}</td>
                <td>
                    <div class="quantity-controls">
                        <button type="button" class="qty-btn minus" onclick="app.updateCartQuantity(${index}, -1)">-</button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button type="button" class="qty-btn plus" onclick="app.updateCartQuantity(${index}, 1)">+</button>
                    </div>
                </td>
                <td class="subtotal-cell">₦${item.subtotal.toFixed(2)}</td>
                <td>
                    <button type="button" class="delete-btn" onclick="app.removeFromCart(${index})" title="Remove item">
                        🗑️
                    </button>
                </td>
            `;
            cartItemsContainer.appendChild(row);
        });

        // Update total amount
        totalAmountElement.textContent = total.toFixed(2);
    }

    updateCartQuantity(itemIndex, change) {
        const item = this.salesCart[itemIndex];
        if (!item) return;

        const newQuantity = item.quantity + change;
        
        // Validate minimum quantity
        if (newQuantity < 1) {
            this.removeFromCart(itemIndex);
            return;
        }

        // Validate against original stock
        if (newQuantity > item.originalQuantity) {
            alert(`⚠️ Only ${item.originalQuantity} units available in stock!`);
            return;
        }

        // Update quantity and subtotal
        item.quantity = newQuantity;
        item.subtotal = item.quantity * item.price;

        // Update cart display
        this.updateCartDisplay();
    }

    removeFromCart(itemIndex) {
        if (confirm('Are you sure you want to remove this item from the cart?')) {
            this.salesCart.splice(itemIndex, 1);
            this.updateCartDisplay();
        }
    }

    clearSalesCart() {
        if (this.salesCart.length > 0) {
            if (confirm('Are you sure you want to cancel this sale? All items will be removed.')) {
                this.salesCart = [];
                this.updateCartDisplay();
            }
        } else {
            this.salesCart = [];
            this.updateCartDisplay();
        }
    }

    async processSalePayment() {
        if (this.salesCart.length === 0) {
            alert('❌ Cart is empty! Add products before processing payment.');
            return;
        }

        // Validate stock availability
        for (const item of this.salesCart) {
            if (item.quantity > item.originalQuantity) {
                alert(`❌ Insufficient stock for "${item.description}"! Available: ${item.originalQuantity}`);
                return;
            }
        }

        const totalAmount = this.salesCart.reduce((sum, item) => sum + item.subtotal, 0);
        
        if (confirm(`Process payment for ₦${totalAmount.toFixed(2)}?`)) {
            try {
                const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
                
                // Process each item in cart
                for (const item of this.salesCart) {
                    // Update inventory (reduce stock)
                    await this.updateInventoryAfterSale(item);
                    
                    // Record sales transaction
                    await api.addSalesTransaction(currentUser.userID, {
                        productName: item.description,
                        barcode: item.barcode,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        amount: item.subtotal,
                        customer: 'Walk-in Customer',
                        description: `Sale of ${item.quantity} ${item.description}`
                    });
                }

                // Add sale amount to wallet
                const newBalance = await api.addFunds(currentUser.userID, totalAmount);
                
                // Update local session
                currentUser.wallet = newBalance;
                localStorage.setItem('webstarng_user', JSON.stringify(currentUser));
                
                // Update UI
                this.updateUserDisplay(currentUser);
                
                // Show success message
                alert(`✅ Sale completed successfully!\n\n` +
                      `Total: ₦${totalAmount.toFixed(2)}\n` +
                      `Items: ${this.salesCart.length}\n` +
                      `New Balance: ₦${newBalance.toFixed(2)}`);
                
                // Clear cart and return to products
                this.salesCart = [];
                this.loadMenuContent('products');
                
            } catch (error) {
                console.error('Error processing sale:', error);
                alert('❌ Error processing sale: ' + error.message);
            }
        }
    }

    async updateInventoryAfterSale(cartItem) {
        try {
            const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
            const inventory = await api.getUserInventory(currentUser.userID);
            
            // Find and update the product
            const productIndex = inventory.products.findIndex(p => p.id === cartItem.id);
            if (productIndex !== -1) {
                inventory.products[productIndex].quantity -= cartItem.quantity;
                inventory.products[productIndex].updatedAt = new Date().toISOString();
                
                // Update status if low stock
                if (inventory.products[productIndex].quantity <= inventory.products[productIndex].reorderLevel) {
                    inventory.products[productIndex].status = 'Low Stock';
                }
                if (inventory.products[productIndex].quantity <= 0) {
                    inventory.products[productIndex].status = 'Out of Stock';
                }
                
                // Save updated inventory
                const user = await api.getUser(currentUser.userID);
                if (user && user.inventoryBinId) {
                    await fetch(`${api.baseURL}/${user.inventoryBinId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Master-Key': api.apiKey
                        },
                        body: JSON.stringify(inventory)
                    });
                }
            }
        } catch (error) {
            console.error('Error updating inventory:', error);
            throw error;
        }
    }

    // ... [Rest of the methods remain the same] ...
}

// ... [Rest of the global functions remain the same] ...
