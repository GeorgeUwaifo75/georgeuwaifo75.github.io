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
                            <input type="text" id="productName" required placeholder="Enter product name">
                        </div>
                        
                        <div class="form-group">
                            <label for="productCategory">Category</label>
                            <select id="productCategory">
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
                            <label for="purchasePrice">Purchase Price (₦) *</label>
                            <input type="number" id="purchasePrice" required min="0" step="0.01" placeholder="0.00">
                        </div>
                        
                        <div class="form-group">
                            <label for="sellingPrice">Selling Price (₦) *</label>
                            <input type="number" id="sellingPrice" required min="0" step="0.01" placeholder="0.00">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="quantity">Initial Quantity *</label>
                            <input type="number" id="quantity" required min="0" placeholder="0">
                        </div>
                        
                        <div class="form-group">
                            <label for="reorderLevel">Reorder Level</label>
                            <input type="number" id="reorderLevel" min="0" placeholder="Minimum stock level">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="productDescription">Description</label>
                        <textarea id="productDescription" rows="4" placeholder="Enter product description"></textarea>
                    </div>
                    
                    <div class="form-actions-content">
                        <button type="submit" class="btn-primary">Save Product</button>
                        <button type="button" class="btn-secondary" onclick="app.loadMenuContent('products')">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    async getSalesReport() {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        let salesData = { transactions: [], totalSales: 0 };
        
        try {
            if (currentUser) {
                salesData = await api.getUserSales(currentUser.userID);
            }
        } catch (error) {
            console.error('Error loading sales:', error);
        }
        
        const today = new Date().toLocaleDateString();
        const todaySales = salesData.transactions ? 
            salesData.transactions.filter(t => {
                const transDate = new Date(t.timestamp).toLocaleDateString();
                return transDate === today;
            }) : [];
        
        const todayTotal = todaySales.reduce((sum, sale) => sum + (sale.amount || 0), 0);

        return `
            <div class="content-page">
                <h2>Sales Report - ${today}</h2>
                
                <div class="summary-stats">
                    <div class="report-cards">
                        <div class="report-card">
                            <h3>💰 Today's Sales</h3>
                            <div class="value">₦${todayTotal.toLocaleString()}</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>📦 Items Sold Today</h3>
                            <div class="value">${todaySales.length}</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>💰 Total Sales</h3>
                            <div class="value">₦${salesData.totalSales.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                
                ${todaySales.length > 0 ? `
                <h3>Today's Sales</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Amount (₦)</th>
                            <th>Customer</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${todaySales.map(sale => `
                            <tr>
                                <td>${new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                <td>${sale.productName || 'Unknown Product'}</td>
                                <td>${sale.quantity || 1}</td>
                                <td>${(sale.amount || 0).toLocaleString()}</td>
                                <td>${sale.customer || 'Walk-in Customer'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p>No sales recorded today.</p>'}
                
                <div class="form-actions-content">
                    <button class="btn-primary" onclick="window.print()">Print Report</button>
                    <button class="btn-secondary" onclick="app.loadMenuContent('reports')">Back</button>
                </div>
            </div>
        `;
    }

    async getInventoryReport() {
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
                <h2>Inventory Report</h2>
                
                <div class="summary-stats">
                    <div class="report-cards">
                        <div class="report-card">
                            <h3>📦 Total Items</h3>
                            <div class="value">${productCount}</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>💰 Total Value</h3>
                            <div class="value">₦${totalValue.toLocaleString()}</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>⚠️ Low Stock</h3>
                            <div class="value">${lowStockCount}</div>
                        </div>
                    </div>
                </div>
                
                ${productCount > 0 ? `
                <h3>Current Inventory</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Quantity</th>
                            <th>Unit Price (₦)</th>
                            <th>Total Value (₦)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventoryData.products.map(product => {
                            const unitPrice = product.sellingPrice || 0;
                            const totalValue = unitPrice * (product.quantity || 0);
                            const isLowStock = (product.quantity || 0) <= (product.reorderLevel || 5);
                            
                            return `
                                <tr>
                                    <td>${product.name || 'Unnamed Product'}</td>
                                    <td>${product.category || 'Uncategorized'}</td>
                                    <td>${product.quantity || 0}</td>
                                    <td>${unitPrice.toLocaleString()}</td>
                                    <td>${totalValue.toLocaleString()}</td>
                                    <td>${isLowStock ? 
                                        '<span style="color: #e74c3c;">Low Stock</span>' : 
                                        '<span class="status-active">In Stock</span>'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ` : '<p>No products in inventory.</p>'}
                
                <div class="form-actions-content">
                    <button class="btn-primary" onclick="window.print()">Print Report</button>
                    <button class="btn-secondary" onclick="app.loadMenuContent('reports')">Back</button>
                </div>
            </div>
        `;
    }

    // ... [Keep other existing methods but update them to use real data] ...

    attachContentEventListeners() {
        // New Product Form
        const newProductForm = document.getElementById('newProductForm');
        if (newProductForm) {
            newProductForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
                if (!currentUser) {
                    alert('Please login first');
                    return;
                }

                const productData = {
                    name: document.getElementById('productName').value,
                    category: document.getElementById('productCategory').value,
                    purchasePrice: parseFloat(document.getElementById('purchasePrice').value),
                    sellingPrice: parseFloat(document.getElementById('sellingPrice').value),
                    quantity: parseInt(document.getElementById('quantity').value),
                    reorderLevel: parseInt(document.getElementById('reorderLevel').value) || 5,
                    description: document.getElementById('productDescription').value
                };

                try {
                    await api.addProductToInventory(currentUser.userID, productData);
                    alert('Product saved successfully to your inventory!');
                    this.loadMenuContent('products');
                } catch (error) {
                    alert('Error saving product: ' + error.message);
                }
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
