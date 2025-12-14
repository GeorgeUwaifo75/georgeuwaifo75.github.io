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
            default:
                return;
        }
        
        contentTitle.textContent = title;
        contentSubtitle.textContent = subtitle;
        dynamicContent.innerHTML = contentHTML;
        
        // Re-attach event listeners for dynamic content
        this.attachContentEventListeners();
    }

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
                                <td>${product.name || 'Unnamed Product'}</td>
                                <td>${product.category || 'Uncategorized'}</td>
                                <td>${product.quantity || 0}</td>
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
                    <div class="form-row">
                        <div class="form-group">
                            <label for="productName">Product Name *</label>
                            <input type="text" id="productName" name="productName" required placeholder="Enter product name">
                        </div>
                        
                        <div class="form-group">
                            <label for="productCategory">Category *</label>
                            <select id="productCategory" name="productCategory" required>
                                <option value="">Select Category</option>
                                <option value="electronics">Electronics</option>
                                <option value="clothing">Clothing</option>
                                <option value="food">Food & Beverages</option>
                                <option value="stationery">Stationery</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="productCode">Product Code</label>
                            <input type="text" id="productCode" name="productCode" placeholder="e.g., PROD-001">
                        </div>
                        
                        <div class="form-group">
                            <label for="brand">Brand</label>
                            <input type="text" id="brand" name="brand" placeholder="Enter brand name">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="purchasePrice">Purchase Price (₦) *</label>
                            <input type="number" id="purchasePrice" name="purchasePrice" required min="0" step="0.01" placeholder="0.00">
                        </div>
                        
                        <div class="form-group">
                            <label for="sellingPrice">Selling Price (₦) *</label>
                            <input type="number" id="sellingPrice" name="sellingPrice" required min="0" step="0.01" placeholder="0.00">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="quantity">Initial Quantity *</label>
                            <input type="number" id="quantity" name="quantity" required min="0" placeholder="0">
                        </div>
                        
                        <div class="form-group">
                            <label for="reorderLevel">Reorder Level *</label>
                            <input type="number" id="reorderLevel" name="reorderLevel" required min="0" placeholder="Minimum stock level" value="5">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="productDescription">Description</label>
                        <textarea id="productDescription" name="productDescription" rows="4" placeholder="Enter product description"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="supplier">Supplier</label>
                        <input type="text" id="supplier" name="supplier" placeholder="Enter supplier name">
                    </div>
                    
                    <div class="form-actions-content">
                        <button type="submit" class="btn-primary" id="saveProductBtn">Save Product</button>
                        <button type="button" class="btn-secondary" id="cancelProductBtn">Cancel</button>
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

    async saveNewProduct() {
        // Get form values
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

        // Create product data object
        const productData = {
            name: productName,
            category: productCategory,
            code: productCode || `PROD-${Date.now().toString().slice(-6)}`,
            brand: brand || 'Generic',
            purchasePrice: purchasePrice,
            sellingPrice: sellingPrice,
            quantity: quantity,
            reorderLevel: reorderLevel,
            description: description,
            supplier: supplier || 'Unknown',
            profitMargin: sellingPrice - purchasePrice,
            totalValue: quantity * sellingPrice,
            status: quantity > 0 ? 'In Stock' : 'Out of Stock',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            // Disable save button to prevent multiple submissions
            const saveBtn = document.getElementById('saveProductBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
            }

            // Save product to user's inventory bin
            const result = await api.addProductToInventory(currentUser.userID, productData);
            
            if (result && result.record) {
                // Show success message
                alert(`Product "${productName}" has been successfully added to your inventory!`);
                
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
                saveBtn.innerHTML = 'Save Product';
            }
            
            alert(`Error saving product: ${error.message}. Please try again.`);
        }
    }

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
