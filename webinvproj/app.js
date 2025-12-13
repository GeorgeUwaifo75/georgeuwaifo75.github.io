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
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    setupMenuNavigation() {
        // Main menu toggle
        const menuLinks = document.querySelectorAll('.menu-link');
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
                subtitle = 'Add a new product to inventory';
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

    // Content Templates
    getProductsContent() {
        return `
            <div class="content-page">
                <h2>Products Management</h2>
                <p>Manage your products, inventory, and purchases from this section.</p>
                
                <div class="report-cards">
                    <div class="report-card">
                        <h3>📦 Total Products</h3>
                        <div class="value">25</div>
                        <div class="label">Active items in inventory</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>💰 Total Value</h3>
                        <div class="value">₦250,000</div>
                        <div class="label">Current inventory value</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>📊 Low Stock</h3>
                        <div class="value">3</div>
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

    getBuyProductsForm() {
        return `
            <div class="content-page">
                <h2>Buy Products</h2>
                
                <div class="content-form">
                    <div class="form-group">
                        <label for="supplier">Supplier</label>
                        <select id="supplier">
                            <option value="">Select Supplier</option>
                            <option value="supplier1">ABC Suppliers</option>
                            <option value="supplier2">XYZ Distributors</option>
                            <option value="supplier3">Global Imports</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="productSelect">Product</label>
                        <select id="productSelect">
                            <option value="">Select Product</option>
                            <option value="prod1">Laptop - ₦150,000</option>
                            <option value="prod2">Mouse - ₦2,500</option>
                            <option value="prod3">Keyboard - ₦4,000</option>
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="buyQuantity">Quantity</label>
                            <input type="number" id="buyQuantity" min="1" value="1">
                        </div>
                        
                        <div class="form-group">
                            <label for="unitPrice">Unit Price (₦)</label>
                            <input type="number" id="unitPrice" min="0" step="0.01" placeholder="0.00">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Total Amount: <strong id="totalAmount">₦0.00</strong></label>
                    </div>
                    
                    <div class="form-group">
                        <label>Wallet Balance: <strong id="currentBalance">₦0.00</strong></label>
                    </div>
                    
                    <div class="form-actions-content">
                        <button class="btn-primary" onclick="app.processPurchase()">Process Purchase</button>
                        <button class="btn-secondary" onclick="app.loadMenuContent('products')">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }

    getWalletTopUpForm() {
        return `
            <div class="content-page">
                <h2>Wallet TopUp</h2>
                <p>Add funds to your business wallet for purchases and expenses.</p>
                
                <div class="content-form">
                    <div class="form-group">
                        <label for="topupAmount">Amount to Add (₦) *</label>
                        <input type="number" id="topupAmount" required min="100" step="100" placeholder="1000">
                    </div>
                    
                    <div class="form-group">
                        <label for="paymentMethod">Payment Method</label>
                        <select id="paymentMethod">
                            <option value="bank">Bank Transfer</option>
                            <option value="card">Credit/Debit Card</option>
                            <option value="cash">Cash Deposit</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Current Balance: <strong id="walletTopupBalance">₦0.00</strong></label>
                    </div>
                    
                    <div class="form-group">
                        <label>New Balance: <strong id="newBalanceAfterTopup">₦0.00</strong></label>
                    </div>
                    
                    <div class="form-actions-content">
                        <button class="btn-primary" onclick="app.processTopUp()">Add Funds</button>
                        <button class="btn-secondary" onclick="app.loadMenuContent('products')">Back</button>
                    </div>
                </div>
            </div>
        `;
    }

    getReportsContent() {
        return `
            <div class="content-page">
                <h2>Reports Dashboard</h2>
                <p>View and analyze your business performance with detailed reports.</p>
                
                <div class="report-cards">
                    <div class="report-card">
                        <h3>📈 Today's Sales</h3>
                        <div class="value">₦45,200</div>
                        <div class="label">From 15 transactions</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>🛍️ Today's Purchases</h3>
                        <div class="value">₦28,500</div>
                        <div class="label">From 8 suppliers</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>📊 Profit Today</h3>
                        <div class="value">₦16,700</div>
                        <div class="label">Gross profit margin</div>
                    </div>
                </div>
                
                <div class="quick-actions">
                    <h3>Detailed Reports</h3>
                    <div class="action-buttons">
                        <button class="btn-primary" onclick="app.handleMenuAction('sales-day')">
                            View Sales Report
                        </button>
                        <button class="btn-secondary" onclick="app.handleMenuAction('purchase-day')">
                            View Purchase Report
                        </button>
                        <button class="btn-secondary" onclick="app.handleMenuAction('inventory-report')">
                            View Inventory Report
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getSalesReport() {
        return `
            <div class="content-page">
                <h2>Sales Report - ${new Date().toLocaleDateString()}</h2>
                
                <div class="summary-stats">
                    <div class="report-cards">
                        <div class="report-card">
                            <h3>💰 Total Sales</h3>
                            <div class="value">₦45,200</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>📦 Items Sold</h3>
                            <div class="value">42</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>👥 Customers</h3>
                            <div class="value">15</div>
                        </div>
                    </div>
                </div>
                
                <h3>Recent Sales</h3>
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
                        <tr>
                            <td>10:30 AM</td>
                            <td>Wireless Mouse</td>
                            <td>2</td>
                            <td>5,000</td>
                            <td>John Doe</td>
                        </tr>
                        <tr>
                            <td>11:15 AM</td>
                            <td>Laptop</td>
                            <td>1</td>
                            <td>25,000</td>
                            <td>Jane Smith</td>
                        </tr>
                        <tr>
                            <td>02:45 PM</td>
                            <td>Keyboard</td>
                            <td>1</td>
                            <td>4,000</td>
                            <td>Bob Johnson</td>
                        </tr>
                        <tr>
                            <td>04:20 PM</td>
                            <td>Mouse Pad</td>
                            <td>5</td>
                            <td>2,500</td>
                            <td>Alice Brown</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="form-actions-content">
                    <button class="btn-primary" onclick="window.print()">Print Report</button>
                    <button class="btn-secondary" onclick="app.loadMenuContent('reports')">Back</button>
                </div>
            </div>
        `;
    }

    getPurchaseReport() {
        return `
            <div class="content-page">
                <h2>Purchase Report - ${new Date().toLocaleDateString()}</h2>
                
                <div class="summary-stats">
                    <div class="report-cards">
                        <div class="report-card">
                            <h3>💰 Total Purchases</h3>
                            <div class="value">₦28,500</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>📦 Items Bought</h3>
                            <div class="value">35</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>🏢 Suppliers</h3>
                            <div class="value">8</div>
                        </div>
                    </div>
                </div>
                
                <h3>Recent Purchases</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Unit Price (₦)</th>
                            <th>Supplier</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>09:00 AM</td>
                            <td>Laptops</td>
                            <td>3</td>
                            <td>150,000</td>
                            <td>ABC Suppliers</td>
                        </tr>
                        <tr>
                            <td>10:30 AM</td>
                            <td>Mice</td>
                            <td>10</td>
                            <td>2,000</td>
                            <td>XYZ Distributors</td>
                        </tr>
                        <tr>
                            <td>01:15 PM</td>
                            <td>Keyboards</td>
                            <td>5</td>
                            <td>3,500</td>
                            <td>Global Imports</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="form-actions-content">
                    <button class="btn-primary" onclick="window.print()">Print Report</button>
                    <button class="btn-secondary" onclick="app.loadMenuContent('reports')">Back</button>
                </div>
            </div>
        `;
    }

    getInventoryReport() {
        return `
            <div class="content-page">
                <h2>Inventory Report</h2>
                
                <div class="summary-stats">
                    <div class="report-cards">
                        <div class="report-card">
                            <h3>📦 Total Items</h3>
                            <div class="value">25</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>💰 Total Value</h3>
                            <div class="value">₦250,000</div>
                        </div>
                        
                        <div class="report-card">
                            <h3>⚠️ Low Stock</h3>
                            <div class="value">3</div>
                        </div>
                    </div>
                </div>
                
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
                        <tr>
                            <td>Laptop</td>
                            <td>Electronics</td>
                            <td>5</td>
                            <td>150,000</td>
                            <td>750,000</td>
                            <td><span class="status-active">In Stock</span></td>
                        </tr>
                        <tr>
                            <td>Wireless Mouse</td>
                            <td>Electronics</td>
                            <td>12</td>
                            <td>2,500</td>
                            <td>30,000</td>
                            <td><span class="status-active">In Stock</span></td>
                        </tr>
                        <tr>
                            <td>Keyboard</td>
                            <td>Electronics</td>
                            <td>8</td>
                            <td>4,000</td>
                            <td>32,000</td>
                            <td><span class="status-active">In Stock</span></td>
                        </tr>
                        <tr>
                            <td>Mouse Pad</td>
                            <td>Accessories</td>
                            <td>2</td>
                            <td>500</td>
                            <td>1,000</td>
                            <td><span style="color: #e74c3c;">Low Stock</span></td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="form-actions-content">
                    <button class="btn-primary" onclick="window.print()">Print Report</button>
                    <button class="btn-secondary" onclick="app.loadMenuContent('reports')">Back</button>
                </div>
            </div>
        `;
    }

    getSetupContent() {
        return `
            <div class="content-page">
                <h2>System Setup</h2>
                <p>Configure system settings, manage users, and update business information.</p>
                
                <div class="report-cards">
                    <div class="report-card">
                        <h3>👤 Total Users</h3>
                        <div class="value">3</div>
                        <div class="label">Active system users</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>🏢 Business Info</h3>
                        <div class="value">1</div>
                        <div class="label">Business profile</div>
                    </div>
                    
                    <div class="report-card">
                        <h3>🔧 System Status</h3>
                        <div class="value">✅</div>
                        <div class="label">All systems operational</div>
                    </div>
                </div>
                
                <div class="quick-actions">
                    <h3>Setup Actions</h3>
                    <div class="action-buttons">
                        <button class="btn-primary" onclick="app.handleMenuAction('new-user')">
                            Add New User
                        </button>
                        <button class="btn-secondary" onclick="app.handleMenuAction('business-details')">
                            Update Business Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getNewUserForm() {
        return `
            <div class="content-page">
                <h2>New User Registration</h2>
                
                <form id="newSystemUserForm" class="content-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="systemUserID">User ID *</label>
                            <input type="text" id="systemUserID" required placeholder="Enter user ID">
                        </div>
                        
                        <div class="form-group">
                            <label for="systemUserFullName">Full Name *</label>
                            <input type="text" id="systemUserFullName" required placeholder="Enter full name">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="systemUserPassword">Password *</label>
                            <input type="password" id="systemUserPassword" required placeholder="Enter password">
                        </div>
                        
                        <div class="form-group">
                            <label for="systemUserConfirmPassword">Confirm Password *</label>
                            <input type="password" id="systemUserConfirmPassword" required placeholder="Confirm password">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="userRole">User Role *</label>
                            <select id="userRole" required>
                                <option value="">Select Role</option>
                                <option value="admin">Administrator</option>
                                <option value="manager">Manager</option>
                                <option value="staff">Staff</option>
                                <option value="cashier">Cashier</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="userEmail">Email Address</label>
                            <input type="email" id="userEmail" placeholder="user@example.com">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="userPermissions">Permissions</label>
                        <div class="permissions-checkbox">
                            <label><input type="checkbox" name="permissions" value="sales"> Sales Management</label>
                            <label><input type="checkbox" name="permissions" value="purchases"> Purchase Management</label>
                            <label><input type="checkbox" name="permissions" value="inventory"> Inventory Management</label>
                            <label><input type="checkbox" name="permissions" value="reports"> View Reports</label>
                        </div>
                    </div>
                    
                    <div class="form-actions-content">
                        <button type="submit" class="btn-primary">Create User</button>
                        <button type="button" class="btn-secondary" onclick="app.loadMenuContent('setup')">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    getBusinessDetailsForm() {
        return `
            <div class="content-page">
                <h2>Business Details</h2>
                
                <form id="businessDetailsForm" class="content-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="businessName">Business Name *</label>
                            <input type="text" id="businessName" required placeholder="Enter business name" value="WebStarNg Store">
                        </div>
                        
                        <div class="form-group">
                            <label for="businessType">Business Type</label>
                            <select id="businessType">
                                <option value="retail">Retail</option>
                                <option value="wholesale">Wholesale</option>
                                <option value="service">Service</option>
                                <option value="manufacturing">Manufacturing</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="businessAddress">Address</label>
                            <textarea id="businessAddress" rows="3" placeholder="Enter business address"></textarea>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="businessPhone">Phone Number</label>
                            <input type="tel" id="businessPhone" placeholder="+234 800 000 0000">
                        </div>
                        
                        <div class="form-group">
                            <label for="businessEmail">Email Address</label>
                            <input type="email" id="businessEmail" placeholder="business@example.com">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="taxId">Tax ID</label>
                            <input type="text" id="taxId" placeholder="Enter tax identification number">
                        </div>
                        
                        <div class="form-group">
                            <label for="currency">Currency</label>
                            <select id="currency">
                                <option value="NGN">Nigerian Naira (₦)</option>
                                <option value="USD">US Dollar ($)</option>
                                <option value="EUR">Euro (€)</option>
                                <option value="GBP">British Pound (£)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-actions-content">
                        <button type="submit" class="btn-primary">Save Details</button>
                        <button type="button" class="btn-secondary" onclick="app.loadMenuContent('setup')">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    attachContentEventListeners() {
        // New Product Form
        const newProductForm = document.getElementById('newProductForm');
        if (newProductForm) {
            newProductForm.addEventListener('submit', (e) => {
                e.preventDefault();
                alert('Product saved successfully!');
                this.loadMenuContent('products');
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
            
            const newBalance = await api.withdrawFunds(currentUser.userID, total);
            
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
        auth.logout();
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
