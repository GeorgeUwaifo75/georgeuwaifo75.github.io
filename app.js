// Main Application Module

// Paystack Configuration - ADD THIS AT THE VERY TOP
const PAYSTACK_CONFIG = {
	publicKey: window.APP_CONFIG.PAYSTACK_PUBLIC_KEY,
	currency: 'NGN',
	channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money'],
	callbackUrl: window.location.origin + '/dashboard.html', // Return URL after payment
	metadata: {
    	custom_fields: []
	}
};

// Add Pagination class at the top of app.js (after WebStarNgApp class)
class ReportPagination {
	constructor(items, itemsPerPage = 10) {
    	this.items = items;
    	this.itemsPerPage = itemsPerPage;
    	this.currentPage = 1;
    	this.totalPages = Math.ceil(items.length / itemsPerPage);
	}

	getCurrentPageItems() {
    	const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    	const endIndex = startIndex + this.itemsPerPage;
    	return this.items.slice(startIndex, endIndex);
	}

	setPage(page) {
    	if (page >= 1 && page <= this.totalPages) {
        	this.currentPage = page;
    	}
    	return this.getCurrentPageItems();
	}

	nextPage() {
    	return this.setPage(this.currentPage + 1);
	}

	previousPage() {
    	return this.setPage(this.currentPage - 1);
	}

	getPageInfo() {
    	const startItem = ((this.currentPage - 1) * this.itemsPerPage) + 1;
    	const endItem = Math.min(startItem + this.itemsPerPage - 1, this.items.length);
   	 
    	return {
        	currentPage: this.currentPage,
        	totalPages: this.totalPages,
        	totalItems: this.items.length,
        	startItem: startItem,
        	endItem: endItem,
        	itemsPerPage: this.itemsPerPage
    	};
	}

	getPaginationHTML(onPageChange) {
    	const pageInfo = this.getPageInfo();
   	 
    	let pageButtons = '';
    	const maxVisiblePages = 5;
   	 
    	// Calculate range of pages to show
    	let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    	let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
   	 
    	// Adjust if we're near the start
    	if (endPage - startPage + 1 < maxVisiblePages) {
        	startPage = Math.max(1, endPage - maxVisiblePages + 1);
    	}
   	 
    	// Generate page number buttons
    	for (let i = startPage; i <= endPage; i++) {
        	pageButtons += `
            	<button class="pagination-button page-number ${i === this.currentPage ? 'active' : ''}"
                    	onclick="${onPageChange}(${i})">
                	${i}
            	</button>
        	`;
    	}
   	 
    	return `
        	<div class="report-pagination">
            	<div class="pagination-nav">
                	<button class="pagination-button"
                        	onclick="${onPageChange}(${this.currentPage - 1})"
                        	${this.currentPage === 1 ? 'disabled' : ''}>
                    	← Previous
                	</button>
               	 
                	<div class="page-numbers">
                    	${pageButtons}
                	</div>
               	 
                	<button class="pagination-button"
                        	onclick="${onPageChange}(${this.currentPage + 1})"
                        	${this.currentPage === this.totalPages ? 'disabled' : ''}>
                    	Next →
                	</button>
            	</div>
           	 
            	<div class="pagination-info">
                	Showing ${pageInfo.startItem} to ${pageInfo.endItem} of ${pageInfo.totalItems} items
                	(Page ${pageInfo.currentPage} of ${pageInfo.totalPages})
            	</div>
           	 
            	<div class="page-size-selector">
                	<span>Show:</span>
                	<select onchange="app.changePageSize(${onPageChange.replace('app.paginateSalesReport', '')}, this.value)">
                    	<option value="10" ${this.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                    	<option value="25" ${this.itemsPerPage === 25 ? 'selected' : ''}>25</option>
                    	<option value="50" ${this.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                    	<option value="100" ${this.itemsPerPage === 100 ? 'selected' : ''}>100</option>
                	</select>
            	</div>
        	</div>
    	`;
	}
}

class WebStarNgApp {
    
    constructor() {
  	 this.currentProduct = null; // Add this line
	this.performanceLog = [];
 	 
	this.init();
    }

// Add pagination methods
	changePageSize(reportType, pageSize) {
    	pageSize = parseInt(pageSize);
   	 
    	switch(reportType) {
        	case 'sales':
            	if (this.salesReportPagination) {
                	this.salesReportPagination.itemsPerPage = pageSize;
                	this.salesReportPagination.totalPages = Math.ceil(this.salesReportPagination.items.length / pageSize);
                	this.salesReportPagination.currentPage = 1;
                	this.renderSalesReport();
            	}
            	break;
        	case 'purchase':
            	if (this.purchaseReportPagination) {
                	this.purchaseReportPagination.itemsPerPage = pageSize;
                	this.purchaseReportPagination.totalPages = Math.ceil(this.purchaseReportPagination.items.length / pageSize);
                	this.purchaseReportPagination.currentPage = 1;
                	this.renderPurchaseReport();
            	}
            	break;
        	case 'inventory':
            	if (this.inventoryReportPagination) {
                	this.inventoryReportPagination.itemsPerPage = pageSize;
                	this.inventoryReportPagination.totalPages = Math.ceil(this.inventoryReportPagination.items.length / pageSize);
                	this.inventoryReportPagination.currentPage = 1;
                	this.renderInventoryReport();
            	}
            	break;
    	}
	}
    
	paginateSalesReport(page) {
    	if (this.salesReportPagination) {
        	this.salesReportPagination.setPage(page);
        	this.renderSalesReport();
    	}
	}
    
	paginatePurchaseReport(page) {
    	if (this.purchaseReportPagination) {
        	this.purchaseReportPagination.setPage(page);
        	this.renderPurchaseReport();
    	}
	}
    
	paginateInventoryReport(page) {
    	if (this.inventoryReportPagination) {
        	this.inventoryReportPagination.setPage(page);
        	this.renderInventoryReport();
    	}
	}
    

 logPerformance(operation, duration) {
    	this.performanceLog.push({ operation, duration, timestamp: Date.now() });
   	 
    	// Keep only last 100 logs
    	if (this.performanceLog.length > 100) {
        	this.performanceLog.shift();
    	}
   	 
    	// Log slow operations
    	if (duration > 1000) {
        	console.warn(`Slow operation: ${operation} took ${duration}ms`);
    	}
	}


    async init() {
    	console.time('AppInit');
 	 
 		 this.checkAuth();
 		 await this.loadUserData();
 		 this.setupEventListeners();
 		 this.setupMenuNavigation();
		 
 		 // Validate demo user on load
 		 await this.validateDemoUserOnLoad();
		 
 		 // Initialize receipt counter if not exists
 		 if (!localStorage.getItem('receipt_counter')) {
     		 localStorage.setItem('receipt_counter', '1000');
 		 }
 		  console.timeEnd('AppInit');
    }

    checkAuth() {
   	 const token = localStorage.getItem('webstarng_token');
   	 if (!token) {
   		 window.location.href = 'index.html';
   	 }
    }


// Add preloading method
async preloadCriticalData() {
	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
	if (!currentUser) return;
    
	// Preload inventory data in background when user logs in
	setTimeout(async () => {
    	try {
        	await this.getCachedInventory(currentUser.userID);
        	console.log('Inventory preloaded');
    	} catch (error) {
        	console.warn('Inventory preload failed:', error);
    	}
	}, 2000); // Wait 2 seconds after login
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
     	// Preload critical data
        	this.preloadCriticalData();
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

   // Update setupMenuNavigation method:
setupMenuNavigation() {
    // Home menu click
    const homeLink = document.querySelector('.home-link');
    if (homeLink) {
   	 homeLink.addEventListener('click', (e) => {
   		 e.preventDefault();
   		 this.goToHomeDashboard();
   	 });
    }

    // Main menu toggle - NO PERMISSION CHECKS HERE
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

    // Submenu item clicks - ONLY check specific restricted features
    const submenuLinks = document.querySelectorAll('.submenu a');
    // In setupMenuNavigation() method, update the submenu links section:
  submenuLinks.forEach(link => {
	link.addEventListener('click', (e) => {
    	e.preventDefault();
    	const action = link.getAttribute('data-action');
   	 
    	// ONLY check for "sales-day" restriction for basic users
    	if (action === 'sales-day') {
        	const perms = this.checkUserPermissions();
        	if (!perms.canAccessSalesReport) {
            	this.showAccessDenied('"Sales of the Day" Report');
            	return;
        	}
    	}
   	 
   	// Check for "purchase-day" restriction for basic users
        	if (action === 'purchase-day') {
            	const perms = this.checkUserPermissions();
            	if (!perms.canAccessSalesReport) { // Use same permission as sales report
                	this.showAccessDenied('"Purchase of the Day" Report');
                	return;
            	}
        	}  
   	 
    	// ONLY check for "new-user" restriction for non-admins
    	if (action === 'new-user') {
        	const perms = this.checkUserPermissions();
        	if (!perms.canCreateUsers) {
            	this.showAccessDenied('Create New Users');
            	return;
        	}
    	}
   	 
   	 // In the submenuLinks.forEach section, add:

// Check for "system-cleanup" restriction (group 3 only)
if (action === 'system-cleanup') {
    const perms = this.checkUserPermissions();
    if (!perms.isAdmin) { // Assuming isAdmin indicates group 3
        this.showAccessDenied('System CleanUp');
        return;
    }
}

// Check for "wallet-admin" restriction (group 3 only)
if (action === 'wallet-admin') {
    const perms = this.checkUserPermissions();
    if (!perms.isAdmin) {
        this.showAccessDenied('Wallet Administration');
        return;
    }
}
   	 
   	 
    	// Allow all other actions
    	this.handleMenuAction(action);
	});
});
    
    // Update menu visibility (hide specific items)
    const perms = this.checkUserPermissions();
    this.updateMenuVisibility(perms.userGroup);
}

// Add method to update menu visibility
// Update updateMenuVisibility() in app.js:
updateMenuVisibility(userGroup) {
	userGroup = parseInt(userGroup) || 0;
    
	// Show "Sales of the day" only for groups 1, 2, 3
	const salesReportLink = document.querySelector('[data-action="sales-day"]');
	if (salesReportLink) {
    	const shouldShow = userGroup >= 1; // Show for groups 1,2,3
    	const listItem = salesReportLink.closest('li');
    	if (listItem) {
        	listItem.style.display = shouldShow ? 'block' : 'none';
    	}
	}
    
	// Show "Purchase of the day" only for groups 1, 2, 3
	const purchaseReportLink = document.querySelector('[data-action="purchase-day"]');
	if (purchaseReportLink) {
    	const shouldShow = userGroup >= 1; // Show for groups 1,2,3
    	const listItem = purchaseReportLink.closest('li');
    	if (listItem) {
        	listItem.style.display = shouldShow ? 'block' : 'none';
    	}
	}
    
	// Only hide "New User" for non-admin users (userGroup < 3)
	const newUserLink = document.querySelector('[data-action="new-user"]');
	if (newUserLink) {
    	const shouldShow = userGroup === 3; // Show only for admin
    	const listItem = newUserLink.closest('li');
    	if (listItem) {
        	listItem.style.display = shouldShow ? 'block' : 'none';
    	}
	}
    
	// DO NOT hide the entire Setup menu - everyone can access it
    
	// Update user group display
	const userGroupElement = document.getElementById('sidebarUserGroup');
	if (userGroupElement) {
    	userGroupElement.textContent = this.getUserGroupLabel(userGroup);
    	userGroupElement.className = `user-group-badge group-${userGroup}`;
	}
	
	
	// Show "Utilities" menu only for groups 2 and 3
const utilitiesMenu = document.querySelector('[data-menu="utilities"]');
if (utilitiesMenu) {
    const shouldShow = userGroup >= 2; // Show for groups 2,3
    const listItem = utilitiesMenu.closest('.menu-item');
    if (listItem) {
        listItem.style.display = shouldShow ? 'block' : 'none';
        
        // If hiding, also close the submenu
        if (!shouldShow) {
            listItem.classList.remove('active');
        }
    }
}

// Hide "System CleanUp" and "Wallet Admin" for group 2
const systemCleanupLink = document.querySelector('[data-action="system-cleanup"]');
const walletAdminLink = document.querySelector('[data-action="wallet-admin"]');

if (systemCleanupLink) {
    const shouldShow = userGroup >= 3; // Show only for group 3
    const listItem = systemCleanupLink.closest('li');
    if (listItem) {
        listItem.style.display = shouldShow ? 'block' : 'none';
    }
}

if (walletAdminLink) {
    const shouldShow = userGroup >= 3; // Show only for group 3
    const listItem = walletAdminLink.closest('li');
    if (listItem) {
        listItem.style.display = shouldShow ? 'block' : 'none';
    }
}
	
	
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
       		 
      /* 		 
    	case 'products':
   		 title = 'Inventory Report';
   		 subtitle = "Current inventory status";
   		 // Don't use await - handle it differently
   		 this.getInventoryReport().then(html => {
       		 contentHTML = html;
       		 contentTitle.textContent = title;
       		 contentSubtitle.textContent = subtitle;
       		 dynamicContent.innerHTML = contentHTML;
       		 this.attachContentEventListeners();
   		 }).catch(error => {
       		 console.error('Error loading inventory report:', error);
       		 contentHTML = '<div class="error-message">Error loading sales report</div>';
   		 });
   		 break;
   		 */
         		 
       		 
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
      case 'utilities':
            title = 'Utilities';
            subtitle = 'System utilities and administration tools';
            contentHTML = this.getBackupRestoreForm();
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

    // Update handleMenuAction method:
// Replace handleMenuAction with this corrected version:
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
    
    // ONLY check permissions for specific restricted actions
    if (action === 'sales-day') {
   	 const perms = this.checkUserPermissions();
   	 if (!perms.canAccessSalesReport) {
   		 this.showAccessDenied('"Sales of the Day" Report');
   		 return;
   	 }
    }
   
   // Check permissions for purchase report
	if (action === 'purchase-day') {
    	const perms = this.checkUserPermissions();
    	if (!perms.canAccessSalesReport) { // Use same permission as sales report
        	this.showAccessDenied('"Purchase of the Day" Report');
        	return;
    	}
	}
    
    if (action === 'new-user') {
   	 const perms = this.checkUserPermissions();
   	 if (!perms.canCreateUsers) {
   		 this.showAccessDenied('Create New Users');
   		 return;
   	 }
    }
    
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
   	 
  		 
   	 case 'sales-day':
   		 title = 'Sales Report';
   		 subtitle = "Today's sales summary";
   		 // Don't use await - handle it differently
   		 this.getSalesReport().then(html => {
       		 contentHTML = html;
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
   		 subtitle = "Today's purchases summary";
   		 // Handle asynchronously like sales report
   		 this.getPurchaseReport().then(html => {
       		 contentHTML = html;
       		 contentTitle.textContent = title;
       		 contentSubtitle.textContent = subtitle;
       		 dynamicContent.innerHTML = contentHTML;
       		 this.attachContentEventListeners();
   		 }).catch(error => {
       		 console.error('Error loading purchase report:', error);
       		 contentHTML = '<div class="error-message">Error loading purchase report</div>';
   		 });
   		 break;
  		 
   	 case 'inventory-report':
   		 title = 'Inventory Report';
   		 subtitle = "Current inventory status";
   		 // Don't use await - handle it differently
   		 this.getInventoryReport().then(html => {
       		 contentHTML = html;
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
   	 case 'wallet-topup':
   		 title = 'Wallet TopUp';
   		 subtitle = 'Add funds to your wallet';
   		 contentHTML = this.getWalletTopUpForm();
   		 break;    
     case 'backup-restore':
          title = 'Backup & Restore';
          subtitle = 'Backup or restore system data';
          contentHTML = this.getBackupRestoreForm();
          break;
      
      case 'system-cleanup':
          // Check if user is group 3
          const permsCleanup = this.checkUserPermissions();
          if (!permsCleanup.isAdmin) { // Assuming isAdmin is for group 3
              this.showAccessDenied('System CleanUp');
              return;
          }
          title = 'System CleanUp';
          subtitle = 'Clean up old transactions';
          contentHTML = this.getSystemCleanupForm();
          break;
      
      case 'wallet-admin':
          // Check if user is group 3
          const permsWallet = this.checkUserPermissions();
          if (!permsWallet.isAdmin) {
              this.showAccessDenied('Wallet Administration');
              return;
          }
          title = 'Wallet Administration';
          subtitle = 'Manage user wallet balances';
          contentHTML = this.getWalletAdminForm();
          break;  		 
         		 
   		 
   		 
   		 
   	 default:
   		 return;
    }
    
    // Only update if not handled asynchronously
 if (action !== 'sales-day' && action !== 'purchase-day' && action !== 'inventory-report') {
   	 contentTitle.textContent = title;
   	 contentSubtitle.textContent = subtitle;
   	 dynamicContent.innerHTML = contentHTML;
   	 this.attachContentEventListeners();
    }
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
           		 <p>This demo account is limited to 3 s per day.</p>
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


// Add debounce function to prevent rapid UI updates
debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
    	const later = () => {
        	clearTimeout(timeout);
        	func(...args);
    	};
    	clearTimeout(timeout);
    	timeout = setTimeout(later, wait);
	};
}




// Add barcode search functionality
// Update searchBarcode() method to use cache:
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

    	// Use cached inventory
    	const inventoryData = await this.getCachedInventory(currentUser.userID);
    	const products = inventoryData.products || [];

    	// Use Map for O(1) lookup instead of array.find()
    	const productMap = new Map();
    	products.forEach(p => productMap.set(p.barcode, p));
   	 
    	const product = productMap.get(barcodeValue);

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
// Update setupBarcodeField() method:
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
            	return;
        	}
       	 
        	hasScanned = true;
        	lastScanTime = now;
       	 
        	// Check if product exists with this barcode
        	const productExists = await this.checkProductByBarcode(value);
       	 
        	if (productExists) {
            	// Product exists - load it for editing
            	await this.loadExistingProduct(productExists);
            	// DO NOT clear barcode field in edit mode
        	} else {
            	// New product - just validate barcode
            	await this.validateBarcode(value);
            	// Keep barcode visible in create mode
        	}
       	 
        	// Reset flag after 2 seconds
        	setTimeout(() => {
            	hasScanned = false;
        	}, 2000);
    	}
	});

	// IGNORE input events completely for scanners
	newInput.addEventListener('input', (e) => {
    	// Do nothing - let the Enter key handler handle everything
	});

	// Focus on barcode field
	newInput.focus();
}


// Update validateBarcode() method:
async validateBarcode(barcodeValue) {
	// Prevent empty barcodes
	if (!barcodeValue || barcodeValue.trim() === '') {
    	this.showBarcodeStatus('Please enter or scan a barcode', 'error');
    	return false;
	}

	// Show loading status
	this.showBarcodeStatus('Checking barcode...', 'loading');

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
        	// Product exists - suggest editing
        	this.showBarcodeStatus(
            	`⚠️ Product exists: "${existingProduct.name}"`,
            	'warning'
        	);
       	 
        	// Keep barcode visible in the field
        	const barcodeInput = document.getElementById('productBarcode');
        	if (barcodeInput) {
            	barcodeInput.value = barcodeValue;
        	}
       	 
        	// Show option to load existing product
        	setTimeout(() => {
            	if (confirm(`Product "${existingProduct.name}" already exists with this barcode.\\n\\nDo you want to edit this product instead?`)) {
                	this.loadExistingProduct(existingProduct);
            	}
        	}, 500);
       	 
        	return false;
    	}

    	// Barcode is available
    	this.showBarcodeStatus(
        	`✅ Barcode "${barcodeValue}" is available for new product`,
        	'success'
    	);

    	// Show preview
    	this.showBarcodePreview(barcodeValue);

    	// Keep barcode visible in the field
    	const barcodeInput = document.getElementById('productBarcode');
    	if (barcodeInput) {
        	barcodeInput.value = barcodeValue;
    	}

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


getBuyProductsForm() {
    return `
   	 <div class="content-page">
   		 <h2>🛒 Buy Products</h2>
   		 <p>Add quantities to existing products in your inventory</p>
  		 
   		 <div class="buy-products-container">
       		 <!-- Barcode Search Section -->
       		 <div class="barcode-search-section" style="margin-bottom: 30px;">
           		 <h3 style="color: #2c3e50; margin-bottom: 15px;">
               		 <span class="menu-icon">🔍</span> Find Product
           		 </h3>
          		 
           		 <div class="form-group">
               		 <label for="searchProductBarcode" class="required-field">Search by Barcode *</label>
               		 <div class="search-input-group">
                   		 <input type="text"
                          		 id="searchProductBarcode"
                          		 name="searchProductBarcode"
                          		 required
                          		 placeholder="Enter product barcode"
                          		 class="barcode-input"
                          		 autocomplete="off"
                          		 autofocus>
                   		 <button type="button" class="btn-primary" id="searchProductBtn">
                       		 Search Product
                   		 </button>
               		 </div>
               		 <div class="form-hint">
                   		 💡 Enter the barcode of the product you want to add stock to
               		 </div>
               		 <div id="searchStatus" style="display: none; margin-top: 10px; padding: 8px; border-radius: 4px;">
               		 </div>
           		 </div>
       		 </div>
      		 
       		 <!-- Product Information Display -->
       		 <div id="productDisplaySection" style="display: none; margin-bottom: 30px;">
           		 <h3 style="color: #2c3e50; margin-bottom: 15px;">
               		 <span class="menu-icon">📋</span> Product Information
           		 </h3>
          		 
           		 <div class="product-info-card">
               		 <div class="product-info-row">
                   		 <div class="info-column">
                       		 <div class="info-item">
                           		 <span class="info-label">Product Name:</span>
                           		 <span class="info-value" id="productNameDisplay"></span>
                       		 </div>
                       		 <div class="info-item">
                           		 <span class="info-label">Barcode:</span>
                           		 <span class="info-value" id="productBarcodeDisplay"></span>
                       		 </div>
                       		 <div class="info-item">
                           		 <span class="info-label">Category:</span>
                           		 <span class="info-value" id="productCategoryDisplay"></span>
                       		 </div>
                   		 </div>
                   		 <div class="info-column">
                       		 <div class="info-item">
                           		 <span class="info-label">Current Stock:</span>
                           		 <span class="info-value" id="currentStockDisplay"></span>
                       		 </div>
                       		 <div class="info-item">
                           		 <span class="info-label">Cost Price:</span>
                           		 <span class="info-value" id="costPriceDisplay"></span>
                       		 </div>
                       		 <div class="info-item">
                           		 <span class="info-label">Selling Price:</span>
                           		 <span class="info-value" id="sellingPriceDisplay"></span>
                       		 </div>
                   		 </div>
               		 </div>
           		 </div>
       		 </div>
      		 
       		 <!-- Purchase Form -->
       		 <div id="purchaseFormSection" style="display: none;">
           		 <h3 style="color: #2c3e50; margin-bottom: 15px;">
               		 <span class="menu-icon">📦</span> Purchase Details
           		 </h3>
          		 
           		 <form id="purchaseForm" class="content-form">
               		 <input type="hidden" id="productId" name="productId">
               		 <input type="hidden" id="productBarcode" name="productBarcode">
              		 
               		 <div class="form-row">
                   		 <div class="form-group">
                       		 <label for="purchaseQuantity" class="required-field">Quantity to Add *</label>
                       		 <input type="number"
                              		 id="purchaseQuantity"
                              		 name="purchaseQuantity"
                              		 required
                              		 min="1"
                              		 step="1"
                              		 placeholder="Enter quantity"
                              		 oninput="app.calculatePurchaseTotal()">
                   		 </div>
                  		 
                   		 <div class="form-group">
                       		 <label for="unitCost" class="required-field">Unit Cost (₦) *</label>
                       		 <input type="number"
                              		 id="unitCost"
                              		 name="unitCost"
                              		 required
                              		 min="0.01"
                              		 step="0.01"
                              		 placeholder="Enter cost per unit"
                              		 oninput="app.calculatePurchaseTotal()">
                       		 <div class="form-hint">Cost price for this purchase</div>
                   		 </div>
               		 </div>
              		 
               		 <div class="form-row">
                   		 <div class="form-group">
                       		 <label for="totalCost" readonly>Total Cost (₦)</label>
                       		 <input type="number"
                              		 id="totalCost"
                              		 name="totalCost"
                              		 readonly
                              		 class="readonly-field"
                              		 placeholder="Auto-calculated">
                   		 </div>
                  		 
                   		 <div class="form-group">
                       		 <label for="supplier">Supplier Name</label>
                       		 <input type="text"
                              		 id="supplier"
                              		 name="supplier"
                              		 placeholder="Enter supplier name">
                   		 </div>
               		 </div>
              		 
               		 <div class="form-row">
                   		 <div class="form-group">
                       		 <label for="purchaseDate">Purchase Date</label>
                       		 <input type="date"
                              		 id="purchaseDate"
                              		 name="purchaseDate"
                              		 value="${new Date().toISOString().split('T')[0]}">
                   		 </div>
                  		 
                   		 <div class="form-group">
                       		 <label for="purchaseNotes">Notes</label>
                       		 <input type="text"
                              		 id="purchaseNotes"
                              		 name="purchaseNotes"
                              		 placeholder="Any additional notes">
                   		 </div>
               		 </div>
              		 
             		 <!-- Current Balance Display (Optional - for information only) -->
             		 <div class="balance-display" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                 		 <div class="balance-info">
                     		 <span class="balance-label">Current Wallet Balance:</span>
                     		 <span class="balance-amount" id="currentWalletBalance">₦0.00</span>
                 		 </div>
             		 </div>
              		 
               		 <!-- Form Actions -->
               		 <div class="form-actions-content">
                   		 <button type="submit" class="btn-primary" id="processPurchaseBtn">
                       		 <span class="menu-icon">💾</span> Process Purchase
                   		 </button>
                   		 <button type="button" class="btn-secondary" onclick="app.clearPurchaseForm()">
                       		 <span class="menu-icon">🗑️</span> Clear Form
                   		 </button>
                   		 <button type="button" class="btn-secondary" onclick="app.loadMenuContent('products')">
                       		 <span class="menu-icon">↩️</span> Cancel
                   		 </button>
               		 </div>
           		 </form>
       		 </div>
      		 
       		 <!-- Success/Error Message Area -->
       		 <div id="purchaseMessage" style="display: none; margin-top: 20px;">
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
   		  	<!-- Hidden fields for mode and product ID -->
            	<input type="hidden" id="productMode" value="create">
            	<input type="hidden" id="existingProductId" value="">
         	 
   		 
   		 
       		 <!-- Barcode Section (Most Important) -->
       		 <div class="barcode-input-section" style="margin-bottom: 30px;">
           		 <h3 style="color: #2c3e50; margin-bottom: 15px;">
               		 <span class="menu-icon">📊</span> Product Barcode
           		 </h3>
           		 <div class="form-hint">
                  	💡 Press Enter after manual entry or scan automatically.
                  	Barcode will remain visible. For existing products, barcode becomes read-only.
              	</div>
          		 
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
      		 
      		 
      		  <!-- Mode Indicator -->
            	<div id="modeIndicator" style="display: none; margin-bottom: 20px; padding: 15px; border-radius: 8px; background: #e3f2fd; border: 1px solid #2196f3;">
                	<div style="display: flex; align-items: center; gap: 10px;">
                    	<span style="color: #2196f3; font-size: 1.2em;">🔄</span>
                    	<div>
                        	<strong style="color: #1976d2;">Edit Existing Product</strong>
                        	<div style="color: #1565c0; font-size: 0.9em;">
                            	Product found! You are now editing existing product. Changes will update the product.
                        	</div>
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
                	<button type="button" class="btn-small" id="newProductBtn" style="display: none;" onclick="app.resetToNewProductMode()">
                    	<span class="menu-icon">🆕</span> Create New Instead
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
  	 
		 // Initialize payment form if it exists
   	 if (document.getElementById('customAmount')) {
   		 this.initializePaymentForm();
   	 }
  	 
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
  	 
if (document.getElementById('backupList')) {
    // Initialize backup list when Backup/Restore page loads
    setTimeout(() => {
        this.initBackupRestore();
    }, 100);
}


// Backup/Restore file input
const backupFile = document.getElementById('backupFile');
if (backupFile) {
    backupFile.addEventListener('change', (e) => {
        app.handleBackupFileSelect(e);
    });
}

// Bulk cleanup confirmation
const confirmBulkCleanup = document.getElementById('confirmBulkCleanup');
if (confirmBulkCleanup) {
    confirmBulkCleanup.addEventListener('change', (e) => {
        const bulkBtn = document.getElementById('bulkCleanupBtn');
        if (bulkBtn) {
            bulkBtn.disabled = !e.target.checked;
        }
    });
}


  	// In attachContentEventListeners() method, add:

      if (document.getElementById('usersList')) {
          // Initialize wallet admin when page loads
          setTimeout(() => {
              this.initWalletAdmin();
          }, 100);
      }



// User search input
const userSearch = document.getElementById('userSearch');
if (userSearch) {
    userSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            app.searchUsers();
        }
    });
}

// Wallet action form validation
const walletAction = document.getElementById('walletAction');
const walletAmount = document.getElementById('walletAmount');
const executeWalletBtn = document.getElementById('executeWalletAction');

if (walletAction && walletAmount && executeWalletBtn) {
    const validateWalletForm = () => {
        const action = walletAction.value;
        const amount = parseFloat(walletAmount.value);
        
        let isValid = true;
        
        if (action === 'add' || action === 'deduct' || action === 'set') {
            isValid = !isNaN(amount) && amount >= 0;
        }
        
        executeWalletBtn.disabled = !isValid;
    };
    
    walletAction.addEventListener('change', validateWalletForm);
    walletAmount.addEventListener('input', validateWalletForm);
}


  	 
  	 
  	  const newSystemUserForm = document.getElementById('newSystemUserForm');
    	if (newSystemUserForm) {
        	newSystemUserForm.addEventListener('submit', (e) => {
            	e.preventDefault();
            	this.createSystemUser();
        	});
    	}
   	 
	 
 	// Create User Button
  	const createUserBtn = document.getElementById('createUserBtn');
  	if (createUserBtn) {
      	const newBtn = createUserBtn.cloneNode(true);
      	createUserBtn.parentNode.replaceChild(newBtn, createUserBtn);
      	newBtn.addEventListener('click', (e) => {
          	e.preventDefault();
          	this.createSystemUser();
      	});
  	}   
  	 
	 // Buy Products Search Button
    const searchProductBtn = document.getElementById('searchProductBtn');
    if (searchProductBtn) {
   	 const newBtn = searchProductBtn.cloneNode(true);
   	 searchProductBtn.parentNode.replaceChild(newBtn, searchProductBtn);
  	 
   	 newBtn.addEventListener('click', async (e) => {
   		 e.preventDefault();
   		 await this.searchProductByBarcode();
   	 });
    }
    
    // Buy Products Barcode Input
    const searchProductBarcode = document.getElementById('searchProductBarcode');
    if (searchProductBarcode) {
   	 const newInput = searchProductBarcode.cloneNode(true);
   	 searchProductBarcode.parentNode.replaceChild(newInput, searchProductBarcode);
  	 
   	 newInput.addEventListener('keypress', async (e) => {
   		 if (e.key === 'Enter') {
       		 e.preventDefault();
       		 await this.searchProductByBarcode();
   		 }
   	 });
    }
    
    // Purchase Form Submit
    const purchaseForm = document.getElementById('purchaseForm');
    if (purchaseForm) {
   	 const newForm = purchaseForm.cloneNode(true);
   	 purchaseForm.parentNode.replaceChild(newForm, purchaseForm);
  	 
   	 newForm.addEventListener('submit', async (e) => {
   		 e.preventDefault();
   		 await this.processPurchase();
   	 });
    }
    
    // Process Purchase Button
    const processPurchaseBtn = document.getElementById('processPurchaseBtn');
    if (processPurchaseBtn) {
   	 const newBtn = processPurchaseBtn.cloneNode(true);
   	 processPurchaseBtn.parentNode.replaceChild(newBtn, processPurchaseBtn);
  	 
   	 newBtn.addEventListener('click', async (e) => {
   		 e.preventDefault();
   		 await this.processPurchase();
   	 });
    }    
  	 



  	 
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
// Replace the entire processSale() method with this optimized version:
async processSale() {
	// Validation Phase
	if (this.cart.length === 0) {
    	alert('Cart is empty. Add products before processing sale.');
    	return;
	}

	const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    
	// Quick validation before confirmation
	if (total <= 0) {
    	alert('Invalid sale amount. Please check cart items.');
    	return;
	}

	// Confirm sale with important info upfront
	const confirmMessage = `Process sale for ₦${total.toFixed(2)}?\n\n` +
                      	`• Transaction fee: ₦25 (deducted from wallet)\n` +
                      	`• Items in cart: ${this.cart.length}\n` +
                      	`• After sale, you'll return to sales interface`;
    
	if (!confirm(confirmMessage)) {
    	return;
	}

	try {
    	// Get user info once
    	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    	if (!currentUser) {
        	alert('Please login first');
        	return;
    	}

    	const userID = currentUser.userID;
    	const isDemoUser = userID === 'tmp101';

    	// DEMO USER CHECK - Optimized
    	if (isDemoUser) {
        	const canProceed = await this.checkDemoTransactionLimit(userID);
        	if (!canProceed) {
            	alert('⚠️ Demo User Limit Reached\n\nDemo users are limited to 3 transactions per day.\nPlease create a regular account for unlimited transactions.');
            	return;
        	}
    	}

    	// WALLET CHECK - Optimized (minimum required: ₦25)
    	if (currentUser.wallet < 25) {
        	alert(`Insufficient funds for transaction fee.\n\nRequired: ₦25.00\nAvailable: ₦${currentUser.wallet.toFixed(2)}\n\nPlease add funds to your wallet.`);
        	return;
    	}

    	// STOCK CHECK - Batch processing with early exit
   	// console.time('StockCheck');
   	// const inventoryData = await api.getUserInventory(userID);
   	// const products = inventoryData.products || [];
   	 
    	console.time('StockCheck');
    	const inventoryData = await this.getCachedInventory(userID);
    	const products = inventoryData.products || [];
   	 
    	const stockIssues = [];
    	const productMap = new Map(); // Faster lookup than array.find()
   	 
    	// Create a map of product IDs for O(1) lookup
    	products.forEach(product => {
        	productMap.set(product.id, product);
    	});

    	// Validate stock for all items at once
    	for (const cartItem of this.cart) {
        	const product = productMap.get(cartItem.productId);
       	 
        	if (!product) {
            	stockIssues.push(`Product "${cartItem.name}" no longer exists in inventory`);
            	continue;
        	}

        	if (product.quantity < cartItem.quantity) {
            	stockIssues.push(`Insufficient stock for "${cartItem.name}". Available: ${product.quantity}, Requested: ${cartItem.quantity}`);
        	}
    	}

    	if (stockIssues.length > 0) {
        	console.timeEnd('StockCheck');
        	alert('❌ Stock Issues:\n\n' + stockIssues.join('\n'));
        	return;
    	}
    	console.timeEnd('StockCheck');

    	// PROCESS TRANSACTION - Batch operations
    	console.time('TransactionProcessing');
   	 
    	// Prepare all updates in parallel
    	const timestamp = new Date().toISOString();
    	const transactionId = this.currentCartId;
    	const newBalance = currentUser.wallet - 25; // Fixed fee
   	 
    	// 1. Update inventory (batch operation)
    	await this.updateInventoryBatch(userID, this.cart, products, timestamp);
   	 
    	// 2. Record sales transaction (single call with all items)
    	await this.recordSalesBatch(userID, this.cart, transactionId, timestamp, isDemoUser);
   	 
    	// 3. Update wallet balance (single call)
    	await api.updateUser(userID, { wallet: newBalance });
   	 
    	console.timeEnd('TransactionProcessing');

    	// UPDATE UI AND LOCAL STORAGE - Single operation
    	console.time('UIUpdate');
    	currentUser.wallet = newBalance;
    	localStorage.setItem('webstarng_user', JSON.stringify(currentUser));
   	 
    	// Print receipt (non-blocking)
    	setTimeout(() => {
        	try {
            	this.printSimpleReceipt(this.cart, total);
        	} catch (printError) {
            	console.warn('Receipt printing failed:', printError);
            	// Continue even if printing fails
            	
            //clearCart	New addition 21st Jan
            	this.cart = [];
    	        this.saveCart();
        	}
    	}, 100); // Small delay to not block main process

    	// Show success message with all details
    	const successMessage =
        	`✅ Sale completed successfully!\n\n` +
        	`📊 Sale Amount: ₦${total.toFixed(2)}\n` +
        	`📦 Items Sold: ${this.cart.length}\n` +
        	`💰 Transaction Fee: ₦25.00\n` +
        	`💳 New Balance: ₦${newBalance.toFixed(2)}\n` +
        	`🆔 Transaction ID: ${transactionId.substring(0, 12)}...`;
   	 
    	alert(successMessage);
   	 
    	// Clear cart efficiently
    //	this.cart = [];
    	this.saveCart();
   	 
    	// Update UI with new balance
    	this.updateUserDisplay(currentUser);
   	 
    	// Load refreshed sales interface without blocking
    	setTimeout(() => {
        	this.loadSellProductsInterface();
    	}, 50);
   	 
    	console.timeEnd('UIUpdate');

    	// Demo user counter update (non-blocking)
    	if (isDemoUser) {
        	setTimeout(() => {
            	this.updateDemoTransactionCounter(userID);
        	}, 0);
    	}

	} catch (error) {
    	console.error('Error processing sale:', error);
   	 
    	// User-friendly error messages
    	let errorMessage = '❌ Sale failed: ';
   	 
    	if (error.message.includes('network') || error.message.includes('fetch')) {
        	errorMessage += 'Network error. Please check your connection.';
    	} else if (error.message.includes('timeout')) {
        	errorMessage += 'Request timeout. Please try again.';
    	} else if (error.message.includes('insufficient')) {
        	errorMessage += 'Insufficient funds or stock.';
    	} else {
        	errorMessage += error.message;
    	}
   	 
    	alert(errorMessage);
   	 
    	// Optionally: Re-enable UI elements if they were disabled
    	const payNowBtn = document.getElementById('payNowBtn');
    	if (payNowBtn) {
        	payNowBtn.disabled = false;
    	}
	}
}

// Add these helper methods to WebStarNgApp class:

// Batch update inventory
async updateInventoryBatch(userID, cartItems, products, timestamp) {
	try {
    	// Create a map for quick product updates
    	const productMap = new Map();
    	products.forEach(product => {
        	productMap.set(product.id, { ...product });
    	});

    	// Apply all quantity updates
    	cartItems.forEach(cartItem => {
        	const product = productMap.get(cartItem.productId);
        	if (product) {
            	product.quantity -= cartItem.quantity;
            	product.updatedAt = timestamp;
            	product.lastModifiedBy = userID;
        	}
    	});

    	// Convert map back to array
    	const updatedProducts = Array.from(productMap.values());
   	 
    	// Single API call to update inventory
    	const inventoryData = {
        	products: updatedProducts,
        	lastUpdated: timestamp,
        	lastModifiedBy: userID
    	};

    	return await api.updateUserInventory(userID, inventoryData);
	} catch (error) {
    	console.error('Error in batch inventory update:', error);
    	throw error;
	}
}

// Batch record sales transactions
// Update the recordSalesBatch() helper method to include all user info:
async recordSalesBatch(userID, cartItems, transactionId, timestamp, isDemoUser) {
	try {
    	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    	if (!currentUser) throw new Error('User not found in session');
   	 
    	const salesData = await api.getUserSales(userID);
   	 
    	// Get business info from current user
    	const businessName = currentUser.businessName || 'WebStarNg Store';
    	const userGroup = currentUser.userGroup || 0;
    	const userFullName = currentUser.fullName || currentUser.userID;
   	 
    	// Create all transactions with complete user info
    	const newTransactions = cartItems.map(cartItem => ({
        	productId: cartItem.productId,
        	productName: cartItem.name,
        	barcode: cartItem.barcode,
        	quantity: cartItem.quantity,
        	unitPrice: cartItem.sellingPrice,
        	amount: cartItem.subtotal,
        	transactionId: transactionId,
        	paymentMethod: 'cash',
        	customerInfo: 'Walk-in Customer',
        	notes: `Sold ${cartItem.quantity} ${cartItem.name}`,
        	serverTimestamp: timestamp,
        	isDemoUser: isDemoUser,
        	// User identification - complete info
        	performedBy: userID,
        	userID: userID,
        	userName: userFullName,
        	userGroup: userGroup,
        	// Business info
        	businessName: businessName,
        	businessInfo: {
            	name: businessName,
            	address: currentUser.addressLine1 || '',
            	telephone: currentUser.telephone || '',
            	userGroup: userGroup
        	},
        	// Transaction metadata
        	id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        	timestamp: timestamp,
        	date: timestamp.split('T')[0], // Store date separately for easy filtering
        	time: timestamp.split('T')[1]?.split('.')[0] || '',
        	// Client info
        	clientInfo: {
            	userAgent: navigator.userAgent,
            	timestamp: timestamp,
            	performedBy: userID,
            	userName: userFullName,
            	userGroup: userGroup
        	}
    	}));

    	// Add all transactions at once
    	salesData.transactions = [...(salesData.transactions || []), ...newTransactions];
   	 
    	// Calculate total sales from all transactions
    	salesData.totalSales = salesData.transactions.reduce((sum, transaction) => {
        	return sum + (parseFloat(transaction.amount) || 0);
    	}, 0);
   	 
    	salesData.lastUpdated = timestamp;
    	salesData.lastModifiedBy = userID;

    	// Update sales bin
    	return await api.updateUserSalesBin(userID, salesData);
	} catch (error) {
    	console.error('Error in batch sales recording:', error);
    	throw error;
	}
}



    // Update saveNewProduct() method:
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
	const supplierCode = document.getElementById('supplierCode')?.value.trim() || '';
	const location = document.getElementById('location')?.value.trim() || '';
	const expiryDate = document.getElementById('expiryDate')?.value || null;
	const unit = document.getElementById('unit')?.value || 'piece';
    
	// Get mode and existing product ID
	const mode = document.getElementById('productMode').value;
	const existingProductId = document.getElementById('existingProductId').value;

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

	// Get current user
	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
	if (!currentUser) {
    	alert('Please login first');
    	window.location.href = 'index.html';
    	return;
	}

	// Check if barcode already exists (for new products only)
	if (mode === 'create') {
    	try {
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
	}

	// Create product data object
	const productData = {
    	barcode: barcode,
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
    	updatedAt: new Date().toISOString()
	};

	// Add createdAt only for new products
	if (mode === 'create') {
    	productData.createdAt = new Date().toISOString();
	}

	try {
    	// Disable save button to prevent multiple submissions
    	const saveBtn = document.getElementById('saveProductBtn');
    	if (saveBtn) {
        	saveBtn.disabled = true;
        	saveBtn.innerHTML = mode === 'edit'
            	? '<span class="spinner"></span> Updating Product...'
            	: '<span class="spinner"></span> Saving Product...';
    	}

    	let result;
   	 
    	if (mode === 'edit' && existingProductId) {
        	// UPDATE EXISTING PRODUCT
        	// Get current inventory
        	const inventoryData = await api.getUserInventory(currentUser.userID);
        	const products = inventoryData.products || [];
       	 
        	// Find the product to update
        	const productIndex = products.findIndex(p => p.id === existingProductId);
        	if (productIndex === -1) {
            	throw new Error('Product not found for updating');
        	}
       	 
        	// Keep the original ID and creation date
        	productData.id = existingProductId;
        	productData.createdAt = products[productIndex].createdAt;
       	 
        	// Update the product in the array
        	products[productIndex] = productData;
       	 
        	// Save updated inventory
        	inventoryData.products = products;
        	inventoryData.lastUpdated = new Date().toISOString();
       	 
        	result = await api.updateUserInventory(currentUser.userID, inventoryData);
       	 
    	} else {
        	// CREATE NEW PRODUCT
        	result = await api.addProductToInventory(currentUser.userID, productData);
   	 
      	if (result && result.record) {
            	// ======================================================
            	// NEW: CREATE PURCHASE TRANSACTION FOR THE NEW PRODUCT
            	// ======================================================
            	try {
                	// Calculate total purchase cost
                	const purchaseTotal = quantity * purchasePrice;
               	 
                	// Create purchase transaction data
                	const purchaseTransaction = {
                    	productId: result.record.id || productData.id,
                    	productName: productName,
                    	barcode: barcode,
                    	quantity: quantity,
                    	unitPrice: purchasePrice,
                    	amount: purchaseTotal,
                    	supplier: supplier || 'Unknown',
                    	purchaseDate: new Date().toISOString().split('T')[0],
                    	notes: `Initial stock for new product: ${productName}`,
                    	type: 'initial_stock',
                    	previousStock: 0,
                    	newStock: quantity,
                    	timestamp: new Date().toISOString()
                	};
               	 
                	// Add purchase transaction to user's purchase bin
                	await api.addPurchaseTransaction(currentUser.userID, purchaseTransaction);
               	 
                	console.log('✅ Purchase transaction created for new product');
            	} catch (purchaseError) {
                	console.error('Error creating purchase transaction:', purchaseError);
                	// Don't fail the product creation if purchase transaction fails
                	// Continue with success message
            	}
            	// ======================================================
           	 
           	}  //Questionable
    	 
    	 
      	}
          	 
    	if (result) {
        	// Show success message
        	const action = mode === 'edit' ? 'updated' : 'saved';
        	alert(`✅ Product "${productName}" has been successfully ${action}!\\n\\n📊 Barcode: ${barcode}\\n💰 Price: ₦${sellingPrice.toFixed(2)}\\n📦 Quantity: ${quantity} ${unit}`);
       	 
        	// Clear the form
        	this.clearProductForm();
       	 
        	// Return to products page
        	this.loadMenuContent('products');
    	} else {
        	throw new Error(`Failed to ${mode === 'edit' ? 'update' : 'save'} product`);
    	}
	} catch (error) {
    	console.error(`Error ${mode === 'edit' ? 'updating' : 'saving'} product:`, error);
    	// Re-enable save button
    	const saveBtn = document.getElementById('saveProductBtn');
    	if (saveBtn) {
        	saveBtn.disabled = false;
        	saveBtn.innerHTML = mode === 'edit'
            	? '<span class="menu-icon">✏️</span> Update Product'
            	: '<span class="menu-icon">💾</span> Save Product';
    	}

    	if (error.message.includes('barcode')) {
        	alert(`❌ Error: ${error.message}\\n\\nPlease use a different barcode.`);
        	document.getElementById('productBarcode').focus();
    	} else {
        	alert(`❌ Error ${mode === 'edit' ? 'updating' : 'saving'} product: ${error.message}\\n\\nPlease try again.`);
    	}
	}
}

//End new addition Dec 15t

    // Update clearProductForm() method:
clearProductForm() {
	// Clear all form fields
	const form = document.getElementById('newProductForm');
	if (form) {
    	form.reset();
	}
    
	// Reset mode
	document.getElementById('productMode').value = 'create';
	document.getElementById('existingProductId').value = '';
    
	// Hide mode indicator
	const modeIndicator = document.getElementById('modeIndicator');
	if (modeIndicator) {
    	modeIndicator.style.display = 'none';
	}
    
	// Enable barcode field
	const barcodeInput = document.getElementById('productBarcode');
	if (barcodeInput) {
    	barcodeInput.readOnly = false;
    	barcodeInput.style.backgroundColor = '';
    	barcodeInput.style.cursor = '';
	}
    
	// Reset save button
	const saveBtn = document.getElementById('saveProductBtn');
	if (saveBtn) {
    	saveBtn.innerHTML = '<span class="menu-icon">💾</span> Save Product';
	}
    
	// Hide new product button
	const newProductBtn = document.getElementById('newProductBtn');
	if (newProductBtn) {
    	newProductBtn.style.display = 'none';
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
	if (status) {
    	status.style.display = 'block';
    	status.textContent = '📊 Enter barcode to check for existing products or create new.';
    	status.style.backgroundColor = '#f8f9fa';
    	status.style.color = '#6c757d';
    	status.style.border = '1px solid #e9ecef';
	}
    
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
    // Get form values
    const productId = document.getElementById('productId').value;
    const productBarcode = document.getElementById('productBarcode').value;
    const quantity = parseInt(document.getElementById('purchaseQuantity').value);
    const unitCost = parseFloat(document.getElementById('unitCost').value);
    const totalCost = parseFloat(document.getElementById('totalCost').value);
    const supplier = document.getElementById('supplier').value.trim();
    const purchaseDate = document.getElementById('purchaseDate').value;
    const notes = document.getElementById('purchaseNotes').value.trim();
    
    // Validate
    if (!productId) {
   	 this.showPurchaseMessage('Please search for a product first', 'error');
   	 return;
    }
    
    if (!quantity || quantity < 1) {
   	 this.showPurchaseMessage('Please enter a valid quantity (minimum 1)', 'error');
   	 document.getElementById('purchaseQuantity').focus();
   	 return;
    }
    
    if (!unitCost || unitCost <= 0) {
   	 this.showPurchaseMessage('Please enter a valid unit cost', 'error');
   	 document.getElementById('unitCost').focus();
   	 return;
    }
    
    try {
   	 const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
   	 if (!currentUser) {
   		 this.showPurchaseMessage('Please login first', 'error');
   		 return;
   	 }
  	 
   	 // Disable process button
   	 const processBtn = document.getElementById('processPurchaseBtn');
   	 if (processBtn) {
   		 processBtn.disabled = true;
   		 processBtn.innerHTML = '<span class="spinner"></span> Processing...';
   	 }
  	 
   	 // Get current product info before update
   	 const inventoryData = await api.getUserInventory(currentUser.userID);
   	 const products = inventoryData.products || [];
   	 const product = products.find(p => p.id === productId);
  	 
   	 if (!product) {
   		 throw new Error('Product not found in inventory');
   	 }
  	 
   	 const oldQuantity = product.quantity || 0;
   	 const newQuantity = oldQuantity + quantity;
  	 
   	 // 1. Update product quantity in inventory
   	 await api.updateProductQuantity(currentUser.userID, productId, quantity);
  	 
   	 // 2. Record purchase transaction (NO WALLET DEDUCTION)
   	 await api.addPurchaseTransaction(currentUser.userID, {
   		 productId: productId,
   		 productName: product.name,
   		 barcode: productBarcode,
   		 quantity: quantity,
   		 unitPrice: unitCost,
   		 amount: totalCost,
   		 supplier: supplier || product.supplier || 'Unknown',
   		 purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
   		 notes: notes,
   		 type: 'restock',
   		 previousStock: oldQuantity,
   		 newStock: newQuantity,
   		 timestamp: new Date().toISOString()
   	 });
  	 
   	 // Show success message
   	 this.showPurchaseMessage(`
   		 <div class="success-card">
       		 <div class="success-icon">✅</div>
       		 <div class="success-details">
           		 <h3>Purchase Recorded Successfully!</h3>
           		 <div class="success-grid">
               		 <div class="success-item">
                   		 <span class="success-label">Product:</span>
                   		 <span class="success-value">${product.name}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Barcode:</span>
                   		 <span class="success-value">${productBarcode}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Quantity Added:</span>
                   		 <span class="success-value">${quantity} ${product.unit || 'units'}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Previous Stock:</span>
                   		 <span class="success-value">${oldQuantity} ${product.unit || 'units'}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">New Stock:</span>
                   		 <span class="success-value">${newQuantity} ${product.unit || 'units'}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Unit Cost:</span>
                   		 <span class="success-value">₦${unitCost.toFixed(2)}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Total Cost:</span>
                   		 <span class="success-value">₦${totalCost.toFixed(2)}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Wallet Balance:</span>
                   		 <span class="success-value">₦${currentUser.wallet.toFixed(2)} (unchanged)</span>
               		 </div>
               		 ${supplier ? `
               		 <div class="success-item">
                   		 <span class="success-label">Supplier:</span>
                   		 <span class="success-value">${supplier}</span>
               		 </div>
               		 ` : ''}
           		 </div>
           		 <div class="success-note" style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px; color: #1565c0;">
               		 💡 Note: Purchase recorded without affecting wallet balance.
           		 </div>
       		 </div>
       		 <div class="success-actions">
           		 <button class="btn-primary" onclick="app.clearPurchaseForm()">
               		 Add Another Product
           		 </button>
           		 <button class="btn-secondary" onclick="app.handleMenuAction('products')">
               		 Back to Products
           		 </button>
       		 </div>
   		 </div>
   	 `, 'success');
  	 
   	 // Clear form for next entry
   	 document.getElementById('purchaseQuantity').value = '';
   	 document.getElementById('unitCost').value = '';
   	 document.getElementById('totalCost').value = '';
   	 document.getElementById('supplier').value = '';
   	 document.getElementById('purchaseNotes').value = '';
  	 
   	 // Update displayed current stock
   	 document.getElementById('currentStockDisplay').textContent =
   		 `${newQuantity} ${product.unit || 'units'}`;
  	 
   	 // Update current product reference
   	 if (this.currentProduct) {
   		 this.currentProduct.quantity = newQuantity;
   	 }
  	 
    } catch (error) {
   	 console.error('Error processing purchase:', error);
   	 this.showPurchaseMessage(`❌ Error: ${error.message}`, 'error');
    } finally {
   	 // Re-enable process button
   	 const processBtn = document.getElementById('processPurchaseBtn');
   	 if (processBtn) {
   		 processBtn.disabled = false;
   		 processBtn.innerHTML = '<span class="menu-icon">💾</span> Process Purchase';
   	 }
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
    
   // In app.js, replace the getSalesReport() method with this:

// Update getSalesReport() method in app.js:
// Update getSalesReport() method:
async getSalesReport() {
	try {
    	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    	if (!currentUser) {
        	return '<div class="error-message">Please login to view sales report</div>';
    	}

    	const userGroup = currentUser.userGroup || 0;
    	const isAdmin = userGroup >= 2;
    	const today = new Date().toISOString().split('T')[0];
    	const currentUserID = currentUser.userID;

    	// Get sales data
    	const salesData = await api.getUserSales(currentUser.userID, true, isAdmin);
    	const allTransactions = salesData.allTransactions || [];
   	 
    	// Filter today's transactions
    	let todayTransactions = [];
   	 
    	if (isAdmin) {
        	// Admin sees ALL transactions from the shared database for today
        	todayTransactions = allTransactions.filter(transaction => {
            	if (!transaction.performedBy && !transaction.userID) {
                	console.warn('Transaction missing userID:', transaction.id);
                	return false;
            	}
           	 
            	let transactionDate;
            	if (transaction.serverTimestamp) {
                	transactionDate = new Date(transaction.serverTimestamp).toISOString().split('T')[0];
            	} else if (transaction.timestamp) {
                	transactionDate = new Date(transaction.timestamp).toISOString().split('T')[0];
            	} else if (transaction.date) {
                	transactionDate = transaction.date;
            	} else {
                	return false;
            	}
           	 
            	return transactionDate === today;
        	});
    	} else {
        	// Non-admin users see only THEIR transactions for today
        	todayTransactions = allTransactions.filter(transaction => {
            	const transactionUserID = transaction.performedBy || transaction.userID;
            	if (!transactionUserID || transactionUserID !== currentUserID) {
                	return false;
            	}
           	 
            	let transactionDate;
            	if (transaction.serverTimestamp) {
                	transactionDate = new Date(transaction.serverTimestamp).toISOString().split('T')[0];
            	} else if (transaction.timestamp) {
                	transactionDate = new Date(transaction.timestamp).toISOString().split('T')[0];
            	} else if (transaction.date) {
                	transactionDate = transaction.date;
            	} else {
                	return false;
            	}
           	 
            	return transactionDate === today;
        	});
    	}

    	// Create pagination instance
    	this.salesReportPagination = new ReportPagination(todayTransactions, 10);
   	 
    	// Store for rendering
    	this.currentSalesData = {
        	todayTransactions,
        	isAdmin,
        	currentUserID,
        	currentUser,
        	today,
        	salesData,
        	userGroup
    	};
   	 
    	// Initial render
    	return this.renderSalesReport();
   	 
	} catch (error) {
    	console.error('Error generating sales report:', error);
    	return `
        	<div class="content-page">
            	<div class="error-message">
                	<h3>Error Loading Sales Report</h3>
                	<p>Unable to load sales data. Please try again.</p>
                	<pre class="error-details">${error.message}</pre>
                	<button class="btn-primary" onclick="app.handleMenuAction('sales-day')">
                    	Retry
                	</button>
            	</div>
        	</div>
    	`;
	}
}

// Add renderSalesReport() method:
renderSalesReport() {
	if (!this.salesReportPagination || !this.currentSalesData) {
    	return '<div class="error-message">Report data not loaded</div>';
	}
    
	const {
    	todayTransactions,
    	isAdmin,
    	currentUserID,
    	currentUser,
    	today,
    	userGroup
	} = this.currentSalesData;
    
	const pageTransactions = this.salesReportPagination.getCurrentPageItems();
	const pageInfo = this.salesReportPagination.getPageInfo();
    
	// Calculate totals from ALL transactions (not just current page)
	const totalSales = todayTransactions.reduce((sum, transaction) => {
    	return sum + (parseFloat(transaction.amount) || 0);
	}, 0);
    
	const totalItems = todayTransactions.reduce((sum, transaction) => {
    	return sum + (parseInt(transaction.quantity) || 1);
	}, 0);
    
	// Group transactions by user (for admin view)
	let transactionsByUser = {};
	if (isAdmin && todayTransactions.length > 0) {
    	todayTransactions.forEach(transaction => {
        	const userID = transaction.performedBy || transaction.userID || 'Unknown';
        	const userName = transaction.userName || userID;
        	const businessName = transaction.businessName || 'Unknown Business';
       	 
        	if (!transactionsByUser[userID]) {
            	transactionsByUser[userID] = {
                	userName: userName,
                	businessName: businessName,
                	count: 0,
                	total: 0,
                	transactions: []
            	};
        	}
        	transactionsByUser[userID].count++;
        	transactionsByUser[userID].total += (parseFloat(transaction.amount) || 0);
        	transactionsByUser[userID].transactions.push(transaction);
    	});
	}
    
	// Headers
	const adminHeader = isAdmin ? `
    	<div class="admin-view-indicator">
        	<strong>👑 Admin View - All Sales Today</strong>
        	<p>You are viewing ALL sales transactions for today from all users.</p>
        	<div class="admin-stats">
            	<span>📊 Total Transactions: ${todayTransactions.length}</span>
            	<span>👥 Total Users: ${Object.keys(transactionsByUser).length}</span>
            	<span>📄 Current Page: ${pageInfo.currentPage}/${pageInfo.totalPages}</span>
        	</div>
    	</div>
	` : '';
    
	const userHeader = !isAdmin ? `
    	<div class="user-view-indicator">
        	<strong>👤 Your Sales Today</strong>
        	<p>You are viewing only your sales transactions for today.</p>
        	<div class="user-info">
            	<span>User ID: ${currentUserID}</span>
            	<span>Total Transactions: ${todayTransactions.length}</span>
            	<span>Current Page: ${pageInfo.currentPage}/${pageInfo.totalPages}</span>
        	</div>
    	</div>
	` : '';
    
	if (todayTransactions.length === 0) {
    	return `
        	<div class="content-page report-container">
            	<h2>Sales Report - ${new Date().toLocaleDateString()}</h2>
            	${adminHeader}
            	${userHeader}
            	<div class="no-sales-message">
                	<div class="no-sales-icon">📊</div>
                	<h3>No Sales Today</h3>
                	<p>There are no sales transactions recorded for today (${today}).</p>
                	${isAdmin ?
                    	'<p><em>As an admin, you would see all users\' transactions here.</em></p>' :
                    	'<p><em>Only your transactions are shown here.</em></p>'
                	}
                	<button class="btn-primary" onclick="app.handleMenuAction('sell-now')">
                    	Start Selling
                	</button>
            	</div>
        	</div>
    	`;
	}
    
	// Sort page transactions by timestamp
	const sortedPageTransactions = [...pageTransactions].sort((a, b) => {
    	const timeA = new Date(a.serverTimestamp || a.timestamp);
    	const timeB = new Date(b.serverTimestamp || b.timestamp);
    	return timeB - timeA;
	});
    
	return `
    	<div class="content-page report-container">
        	${adminHeader}
        	${userHeader}
       	 
        	<div class="report-header">
            	<div>
                	<h2>Sales Report - ${new Date().toLocaleDateString()}</h2>
                	<p class="report-date">
                    	Date: ${today} |
                    	${isAdmin ? '👑 Admin View (All Users)' : '👤 User View (Your Sales Only)'}
                	</p>
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

        	<!-- Admin Summary -->
        	${isAdmin && Object.keys(transactionsByUser).length > 0 ? `
            	<div class="admin-summary-section">
                	<h3><span>📊</span> Sales Breakdown by User</h3>
                	<div class="user-breakdown-grid">
                    	${Object.entries(transactionsByUser).map(([userID, data]) => `
                        	<div class="user-breakdown-card">
                            	<div class="user-header">
                                	<div class="user-id">${userID}</div>
                                	<div class="user-name">${data.userName}</div>
                                	<div class="business-name">${data.businessName}</div>
                            	</div>
                            	<div class="user-stats">
                                	<div class="stat">
                                    	<span class="label">Transactions:</span>
                                    	<span class="value">${data.count}</span>
                                	</div>
                                	<div class="stat">
                                    	<span class="label">Total Sales:</span>
                                    	<span class="value amount">₦${data.total.toFixed(2)}</span>
                                	</div>
                            	</div>
                        	</div>
                    	`).join('')}
                	</div>
            	</div>
        	` : ''}

        	<!-- Sales Summary -->
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
                	<span class="summary-value">${totalItems}</span>
            	</div>
            	${isAdmin ? `
                	<div class="summary-item">
                    	<span class="summary-label">Unique Users:</span>
                    	<span class="summary-value">${Object.keys(transactionsByUser).length}</span>
                	</div>
            	` : ''}
        	</div>

        	<!-- Pagination Top -->
        	${todayTransactions.length > 10 ? this.salesReportPagination.getPaginationHTML('app.paginateSalesReport') : ''}

        	<!-- Transactions List -->
        	<h3>Today's Sales Transactions${isAdmin ? ' (All Users)' : ' (Your Sales)'}</h3>
        	<p class="page-info-small">Showing ${pageInfo.startItem}-${pageInfo.endItem} of ${pageInfo.totalItems} transactions</p>
       	 
        	<div class="sales-list">
            	${sortedPageTransactions.map((transaction, index) => {
                	const absoluteIndex = pageInfo.startItem + index - 1;
                	const transactionUserID = transaction.performedBy || transaction.userID || 'Unknown';
                	const isCurrentUser = transactionUserID === currentUserID;
                	const userName = transaction.userName || transactionUserID;
                	const businessName = transaction.businessName || 'Unknown';
               	 
                	const userBadge = isAdmin ? `
                    	<div class="transaction-user-info">
                        	<span class="user-badge ${isCurrentUser ? 'current-user' : 'other-user'}"
                              	title="${isCurrentUser ? 'Your transaction' : `User: ${userName}`}">
                            	${isCurrentUser ? '👤 You' : `👥 ${userName}`}
                        	</span>
                        	${!isCurrentUser ? `<span class="user-id-small">(${transactionUserID})</span>` : ''}
                    	</div>
                	` : '';
               	 
                	const businessInfo = isAdmin && !isCurrentUser ? `
                    	<div class="business-info">
                        	<small>🏢 ${businessName}</small>
                    	</div>
                	` : '';
               	 
                	return `
                	<div class="sale-item ${isCurrentUser ? 'current-user-transaction' : 'other-user-transaction'}">
                    	<div class="sale-header">
                        	<span class="sale-number">${absoluteIndex + 1}.</span>
                        	<span class="sale-time">
                            	${new Date(transaction.serverTimestamp || transaction.timestamp).toLocaleTimeString([], {
                                	hour: '2-digit',
                                	minute: '2-digit',
                                	second: '2-digit'
                            	})}
                        	</span>
                        	${userBadge}
                        	<span class="sale-id">ID: ${transaction.transactionId || transaction.id || 'N/A'}</span>
                    	</div>
                    	${businessInfo}
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
                    	${transaction.barcode ? `
                        	<div class="sale-meta">
                            	<span class="sale-barcode">Barcode: <code>${transaction.barcode}</code></span>
                        	</div>
                    	` : ''}
                    	<div class="sale-footer">
                        	${transaction.paymentMethod ? `<span class="sale-payment">Payment: ${transaction.paymentMethod}</span>` : ''}
                        	${isAdmin ? `
                            	<span class="transaction-date">
                                	${new Date(transaction.serverTimestamp || transaction.timestamp).toLocaleDateString()}
                            	</span>
                        	` : ''}
                    	</div>
                	</div>
                	`;
            	}).join('')}
        	</div>

        	<!-- Pagination Bottom -->
        	${todayTransactions.length > 10 ? this.salesReportPagination.getPaginationHTML('app.paginateSalesReport') : ''}

        	<!-- Total Summary -->
        	<div class="sales-total">
            	<div class="total-label">
                	TOTAL SALES FOR TODAY${isAdmin ? ' (ALL USERS)' : ' (YOUR SALES)'}:
            	</div>
            	<div class="total-amount">₦${totalSales.toFixed(2)}</div>
        	</div>

        	<!-- Report Footer -->
        	<div class="report-footer">
            	<p>Report generated on ${new Date().toLocaleString()}</p>
            	<p>
                	User: ${currentUserID} |
                	${isAdmin ? 'Admin View • All Transactions' : 'User View • Your Transactions Only'} |
                	Page: ${pageInfo.currentPage}/${pageInfo.totalPages}
            	</p>
        	</div>
    	</div>
	`;
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
 
 
 
 // Add this method to WebStarNgApp class near the export methods
async exportPurchasesToCSV() {
    try {
   	 const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
   	 if (!currentUser) {
   		 alert('Please login to export purchase report');
   		 return;
   	 }

   	 // Get today's date
   	 const today = new Date().toISOString().split('T')[0];

   	 // Get purchases data
   	 const purchasesData = await api.getUserPurchases(currentUser.userID);
   	 const transactions = purchasesData.transactions || [];

   	 // Filter today's purchases
   	 const todayPurchases = transactions.filter(transaction => {
   		 if (!transaction.timestamp && !transaction.purchaseDate) return false;
   		 const transactionDate = transaction.purchaseDate || transaction.timestamp;
   		 const dateStr = new Date(transactionDate).toISOString().split('T')[0];
   		 return dateStr === today;
   	 });

   	 if (todayPurchases.length === 0) {
   		 alert('No purchase data to export for today');
   		 return;
   	 }

   	 // Sort transactions
   	 todayPurchases.sort((a, b) => {
   		 const timeA = new Date(a.timestamp || a.purchaseDate);
   		 const timeB = new Date(b.timestamp || b.purchaseDate);
   		 return timeA - timeB;
   	 });

   	 // Calculate totals
   	 const totalPurchases = todayPurchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
   	 const totalItems = todayPurchases.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0);

   	 // Create CSV content
   	 let csvContent = "S/No.,Time,Date,Transaction ID,Product Name,Barcode,Quantity,Unit Price (₦),Amount (₦),Supplier,Type,Previous Stock,New Stock,Notes\\n";

   	 // Add each transaction
   	 todayPurchases.forEach((purchase, index) => {
   		 const timestamp = purchase.timestamp || purchase.purchaseDate;
   		 const date = new Date(timestamp);
  		 
   		 const row = [
       		 index + 1,
       		 date.toLocaleTimeString(),
       		 date.toISOString().split('T')[0],
       		 `"${purchase.id || ''}"`,
       		 `"${purchase.productName || ''}"`,
       		 `"${purchase.barcode || ''}"`,
       		 purchase.quantity || 1,
       		 purchase.unitPrice || 0,
       		 purchase.amount || 0,
       		 `"${purchase.supplier || ''}"`,
       		 purchase.type || 'purchase',
       		 purchase.previousStock || '',
       		 purchase.newStock || '',
       		 `"${purchase.notes || ''}"`
   		 ];
  		 
   		 csvContent += row.join(',') + '\\n';
   	 });

   	 // Add summary rows
   	 csvContent += '\\n';
   	 csvContent += 'PURCHASE SUMMARY\\n';
   	 csvContent += `Total Transactions,${todayPurchases.length}\\n`;
   	 csvContent += `Total Items Purchased,${totalItems}\\n`;
   	 csvContent += `Total Purchase Amount (₦),${totalPurchases.toFixed(2)}\\n`;
   	 csvContent += `Average Transaction (₦),${(totalPurchases / todayPurchases.length).toFixed(2)}\\n`;
   	 csvContent += `\\nReport Information\\n`;
   	 csvContent += `Generated On,${new Date().toLocaleString()}\\n`;
   	 csvContent += `User,${currentUser.userID}\\n`;
   	 csvContent += `Business,${currentUser.businessName || 'WebStarNg'}\\n`;

   	 // Create and download CSV file
   	 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
   	 const link = document.createElement('a');
   	 const url = URL.createObjectURL(blob);
   	 const dateStr = new Date().toISOString().split('T')[0];
  	 
   	 link.setAttribute('href', url);
   	 link.setAttribute('download', `purchases_report_${dateStr}.csv`);
   	 link.style.visibility = 'hidden';
   	 document.body.appendChild(link);
   	 link.click();
   	 document.body.removeChild(link);

   	 alert(`✅ Purchase CSV report downloaded!\\n\\n📊 Transactions: ${todayPurchases.length}\\n💰 Total: ₦${totalPurchases.toFixed(2)}`);

    } catch (error) {
   	 console.error('Error exporting purchases CSV:', error);
   	 alert('Error exporting purchases CSV: ' + error.message);
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



    	const userGroup = currentUser.userGroup || 0;
    	const isAdmin = userGroup >= 2;
    	const today = new Date().toISOString().split('T')[0];
    	const currentUserID = currentUser.userID;

    	// Get sales data
    	const salesData = await api.getUserSales(currentUser.userID, true, isAdmin);
    	const transactions = isAdmin ? salesData.allTransactions || [] : salesData.transactions || [];

    	// Filter today's transactions with user validation
    	const todayTransactions = transactions.filter(transaction => {
        	// For non-admin, verify transaction belongs to current user
        	if (!isAdmin) {
            	const transactionUserID = transaction.performedBy || transaction.userID;
            	if (!transactionUserID || transactionUserID !== currentUserID) {
                	return false;
            	}
        	}
       	 
        	// Get transaction date
        	let transactionDate;
        	if (transaction.serverTimestamp) {
            	transactionDate = new Date(transaction.serverTimestamp).toISOString().split('T')[0];
        	} else if (transaction.timestamp) {
            	transactionDate = new Date(transaction.timestamp).toISOString().split('T')[0];
        	} else {
            	return false;
        	}
       	 
        	return transactionDate === today;
    	});



 // Use the stored data from currentSalesData, not paginated data
        if (!this.currentSalesData || !this.currentSalesData.todayTransactions) {
            alert('Please load the sales report first');
            return;
        }

    
    	if (todayTransactions.length === 0) {
        	alert('No sales data to export for today');
        	return;
    	}

    	// Create CSV header with user info for admin
    	let csvHeader = isAdmin ?
        	"S/No.,Time,Date,User ID,User Name,Business Name,Transaction ID,Product Name,Barcode,Quantity,Unit Price (₦),Amount (₦),Payment Method,Customer,Description\n" :
        	"S/No.,Time,Date,Transaction ID,Product Name,Barcode,Quantity,Unit Price (₦),Amount (₦),Payment Method,Customer,Description\n";

    	let csvContent = csvHeader;

    	// Add each transaction
    	todayTransactions.forEach((transaction, index) => {
        	const transactionUserID = transaction.performedBy || transaction.userID || 'Unknown';
        	const userName = transaction.userName || transactionUserID;
        	const businessName = transaction.businessName || 'Unknown';
       	 
        	if (isAdmin) {
            	const row = [
                	index + 1,
                	new Date(transaction.serverTimestamp || transaction.timestamp).toLocaleTimeString(),
                	new Date(transaction.serverTimestamp || transaction.timestamp).toISOString().split('T')[0],
                	`"${transactionUserID}"`,
                	`"${userName}"`,
                	`"${businessName}"`,
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
        	} else {
            	const row = [
                	index + 1,
                	new Date(transaction.serverTimestamp || transaction.timestamp).toLocaleTimeString(),
                	new Date(transaction.serverTimestamp || transaction.timestamp).toISOString().split('T')[0],
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
        	}
    	});

    	// ... rest of export function (create and download file)
    	// [Keep existing file creation and download code]
   	 
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



// Export Purchases to Excel
async exportPurchasesToExcel() {
    try {
   	 const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
   	 if (!currentUser) {
   		 alert('Please login to export purchase report');
   		 return;
   	 }
  	 
   	 // Get today's date
   	 const today = new Date().toISOString().split('T')[0];
  	 
   	 // Get purchases data
   	 const purchasesData = await api.getUserPurchases(currentUser.userID);
   	 const transactions = purchasesData.transactions || [];
  	 
   	 // Filter today's purchases
   	 const todayPurchases = transactions.filter(transaction => {
   		 if (!transaction.timestamp && !transaction.purchaseDate) return false;
   		 const transactionDate = transaction.purchaseDate || transaction.timestamp;
   		 const dateStr = new Date(transactionDate).toISOString().split('T')[0];
   		 return dateStr === today;
   	 });
  	 
   	 if (todayPurchases.length === 0) {
   		 alert('No purchase data to export for today');
   		 return;
   	 }
  	 
   	 // Calculate totals
   	 const totalPurchases = todayPurchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
   	 const totalItems = todayPurchases.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0);
  	 
   	 // Sort by time
   	 todayPurchases.sort((a, b) => {
   		 const timeA = new Date(a.timestamp || a.purchaseDate);
   		 const timeB = new Date(b.timestamp || b.purchaseDate);
   		 return timeA - timeB;
   	 });
  	 
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
                       		 <x:Name>Purchase Report ${today}</x:Name>
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
       		 <div class="header">Purchase Report - ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
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
                   		 <th>Supplier</th>
                   		 <th>Type</th>
               		 </tr>
           		 </thead>
           		 <tbody>
   	 `;
  	 
   	 // Add purchases
   	 todayPurchases.forEach((purchase, index) => {
   		 const timestamp = purchase.timestamp || purchase.purchaseDate;
   		 const date = new Date(timestamp);
  		 
   		 excelContent += `
       		 <tr>
           		 <td>${index + 1}</td>
           		 <td>${date.toLocaleTimeString()}</td>
           		 <td>${date.toISOString().split('T')[0]}</td>
           		 <td>${purchase.id || ''}</td>
           		 <td>${purchase.productName || ''}</td>
           		 <td>${purchase.barcode || ''}</td>
           		 <td>${purchase.quantity || 1}</td>
           		 <td>${(purchase.unitPrice || 0).toFixed(2)}</td>
           		 <td>${(purchase.amount || 0).toFixed(2)}</td>
           		 <td>${purchase.supplier || ''}</td>
           		 <td>${purchase.type || 'purchase'}</td>
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
                   		 <td><strong>₦${totalPurchases.toFixed(2)}</strong></td>
                   		 <td colspan="2"></td>
               		 </tr>
           		 </tfoot>
       		 </table>
     		 
       		 <div class="summary">
           		 <div class="summary-title">Purchase Summary</div>
           		 <p><strong>Report Date:</strong> ${today}</p>
           		 <p><strong>Total Transactions:</strong> ${todayPurchases.length}</p>
           		 <p><strong>Total Items Purchased:</strong> ${totalItems}</p>
           		 <p><strong>Total Purchase Amount:</strong> ₦${totalPurchases.toFixed(2)}</p>
           		 <p><strong>Average Transaction Value:</strong> ₦${(totalPurchases / todayPurchases.length).toFixed(2)}</p>
           		 <p><strong>Generated By:</strong> ${currentUser.userID}</p>
           		 <p><strong>Business:</strong> ${currentUser.businessName || 'WebStarNg'}</p>
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
   	 link.setAttribute('download', `purchases_report_${dateStr}.xls`);
   	 link.style.visibility = 'hidden';
  	 
   	 document.body.appendChild(link);
   	 link.click();
   	 document.body.removeChild(link);
  	 
   	 alert(`✅ Purchase Excel report downloaded!\n\n📊 Transactions: ${todayPurchases.length}\n💰 Total: ₦${totalPurchases.toFixed(2)}`);
  	 
    } catch (error) {
   	 console.error('Error exporting purchases Excel:', error);
   	 alert('Error exporting purchases Excel: ' + error.message);
    }
}
// Update getInventoryReport() for pagination
async getInventoryReport() {
	try {
    	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    	if (!currentUser) {
        	return '<div class="error-message">Please login to view inventory report</div>';
    	}

    	// Get inventory data
    	const inventoryData = await api.getUserInventory(currentUser.userID);
    	const products = inventoryData.products || [];
   	 
    	// Create pagination instance for inventory
    	this.inventoryReportPagination = new ReportPagination(products, 10);
   	 
    	// Store for rendering
    	this.currentInventoryData = {
        	products,
        	inventoryData,
        	currentUser,
        	totalProducts: products.length
    	};
   	 
    	return this.renderInventoryReport();
   	 
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

// Add renderInventoryReport() method
renderInventoryReport() {
	if (!this.inventoryReportPagination || !this.currentInventoryData) {
    	return '<div class="error-message">Inventory data not loaded</div>';
	}
    
	const { products, inventoryData, currentUser, totalProducts } = this.currentInventoryData;
	const pageProducts = this.inventoryReportPagination.getCurrentPageItems();
	const pageInfo = this.inventoryReportPagination.getPageInfo();
    
	// Calculate totals from ALL products
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
    
	// Sort page products
	const sortedPageProducts = [...pageProducts].sort((a, b) => {
    	const categoryCompare = (a.category || '').localeCompare(b.category || '');
    	if (categoryCompare !== 0) return categoryCompare;
    	return (a.name || '').localeCompare(b.name || '');
	});
    
	if (products.length === 0) {
    	return `
        	<div class="content-page report-container">
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
    
	return `
    	<div class="content-page report-container">
        	<div class="report-header">
            	<div>
                	<h2>Inventory Report</h2>
                	<p class="report-date">Generated: ${new Date().toLocaleDateString()}</p>
                	<p class="page-info">Page ${pageInfo.currentPage} of ${pageInfo.totalPages} (${pageInfo.totalItems} total products)</p>
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
                	<span class="summary-value">₦${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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

        	<!-- Pagination Top -->
        	${products.length > 10 ? this.inventoryReportPagination.getPaginationHTML('app.paginateInventoryReport') : ''}

        	<!-- Products List -->
        	<h3>Inventory Items (${pageInfo.startItem}-${pageInfo.endItem} of ${totalProducts})</h3>
       	 
        	<div class="inventory-list">
            	${sortedPageProducts.map((product, index) => {
                	const absoluteIndex = pageInfo.startItem + index - 1;
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
                        	<span class="item-number">${absoluteIndex + 1}.</span>
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
                    	</div>
                	</div>
                	`;
            	}).join('')}
        	</div>

        	<!-- Pagination Bottom -->
        	${products.length > 10 ? this.inventoryReportPagination.getPaginationHTML('app.paginateInventoryReport') : ''}

        	<!-- Inventory Summary Footer -->
        	<div class="inventory-summary-footer">
            	<div class="summary-total">
                	<span class="total-label">TOTAL INVENTORY VALUE (${totalProducts} products):</span>
                	<span class="total-amount">₦${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            	</div>
        	</div>

        	<!-- Report Footer -->
        	<div class="report-footer">
            	<p>Report generated on ${new Date().toLocaleString()}</p>
            	<p>User: ${currentUser.userID} | Total Products: ${totalProducts} | Total Items: ${totalQuantity} | Page: ${pageInfo.currentPage}/${pageInfo.totalPages}</p>
        	</div>
    	</div>
	`;
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
// Update checkDemoTransactionLimit() method:
async checkDemoTransactionLimit(userID) {
	if (userID !== 'tmp101') {
    	return true; // Not a demo user, no limit
	}

	try {
    	const today = new Date().toISOString().split('T')[0];
   	 
    	// Cache check in localStorage to avoid API calls when possible
    	const cacheKey = `demo_limit_${today}`;
    	const cachedData = localStorage.getItem(cacheKey);
   	 
    	if (cachedData) {
        	const { count, timestamp } = JSON.parse(cachedData);
        	const cacheAge = Date.now() - timestamp;
       	 
        	// Use cache if less than 5 minutes old
        	if (cacheAge < 5 * 60 * 1000) {
            	console.log(`Using cached demo limit: ${count}/3`);
            	return count < 3;
        	}
    	}

    	// Get fresh data from server
    	const salesData = await api.getUserSales(userID, false, false);
    	const transactions = salesData.transactions || [];
   	 
    	// Count today's transactions efficiently
    	const todayTransactionCount = transactions.reduce((count, transaction) => {
        	if (!transaction.timestamp && !transaction.serverTimestamp) return count;
       	 
        	const timestamp = transaction.serverTimestamp || transaction.timestamp;
        	const transactionDate = new Date(timestamp).toISOString().split('T')[0];
       	 
        	return transactionDate === today ? count + 1 : count;
    	}, 0);

    	console.log(`Demo user transactions today: ${todayTransactionCount}/3`);
   	 
    	// Cache the result
    	localStorage.setItem(cacheKey, JSON.stringify({
        	count: todayTransactionCount,
        	timestamp: Date.now()
    	}));

    	// Check if limit reached
    	return todayTransactionCount < 3;
	} catch (error) {
    	console.error('Error checking demo transaction limit:', error);
    	// If there's an error, allow the transaction (fail open for usability)
    	return true;
	}
}

// Update updateDemoTransactionCounter() method:
async updateDemoTransactionCounter(userID) {
	if (userID !== 'tmp101') {
    	return; // Not a demo user
	}

	try {
    	const today = new Date().toISOString().split('T')[0];
    	const cacheKey = `demo_limit_${today}`;
   	 
    	// Update cache first (immediate response)
    	const cachedData = localStorage.getItem(cacheKey);
    	let newCount = 1;
   	 
    	if (cachedData) {
        	const data = JSON.parse(cachedData);
        	newCount = (data.count || 0) + 1;
    	}
   	 
    	localStorage.setItem(cacheKey, JSON.stringify({
        	count: newCount,
        	timestamp: Date.now()
    	}));

    	console.log(`Demo transaction counter updated (cache): ${newCount}/3`);
   	 
    	// Update server asynchronously (don't wait for it)
    	setTimeout(async () => {
        	try {
            	const demoUser = await api.getUser(userID);
            	if (!demoUser) return;

            	const lastTransactionDate = demoUser.lastTransactionDate || '';
           	 
            	if (lastTransactionDate === today) {
                	// Increment today's counter
                	demoUser.demoTransactionsToday = (demoUser.demoTransactionsToday || 0) + 1;
            	} else {
                	// Reset counter for new day
                	demoUser.demoTransactionsToday = 1;
                	demoUser.lastTransactionDate = today;
            	}

            	demoUser.lastTransactionTime = new Date().toISOString();

            	// Update user data (fire and forget)
            	api.updateUser(userID, {
                	demoTransactionsToday: demoUser.demoTransactionsToday,
                	lastTransactionDate: demoUser.lastTransactionDate,
                	lastTransactionTime: demoUser.lastTransactionTime
            	}).catch(err => console.warn('Background update failed:', err));
           	 
        	} catch (error) {
            	console.warn('Error in background demo counter update:', error);
        	}
    	}, 0);
   	 
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



// Search product by barcode
async searchProductByBarcode() {
    const barcodeInput = document.getElementById('searchProductBarcode');
    const statusElement = document.getElementById('searchStatus');
    
    if (!barcodeInput || !statusElement) return;
    
    const barcodeValue = barcodeInput.value.trim();
    
    if (!barcodeValue) {
   	 this.showSearchStatus('Please enter a barcode', 'error');
   	 return;
    }
    
    try {
   	 this.showSearchStatus('Searching for product...', 'loading');
  	 
   	 const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
   	 if (!currentUser) {
   		 this.showSearchStatus('Please login first', 'error');
   		 return;
   	 }
  	 
   	 // Get inventory data
   	 const inventoryData = await api.getUserInventory(currentUser.userID);
   	 const products = inventoryData.products || [];
  	 
   	 // Find product by barcode
   	 const product = products.find(p => p.barcode === barcodeValue);
  	 
   	 if (product) {
   		 // Store product reference
   		 this.currentProduct = product;
  		 
   		 // Display product information
   		 this.displayProductForPurchase(product);
   		 this.showSearchStatus(`✅ Product found: "${product.name}"`, 'success');
  		 
   		 // Show purchase form
   		 document.getElementById('purchaseFormSection').style.display = 'block';
  		 
   		 // Update wallet balance display
  		 // this.updateWalletBalanceDisplay();
  		 
   		 // Set unit cost to current cost price by default
   		 const unitCostInput = document.getElementById('unitCost');
   		 if (unitCostInput && product.purchasePrice) {
       		 unitCostInput.value = product.purchasePrice;
       		 this.calculatePurchaseTotal();
   		 }
  		 
   		 // Focus on quantity input
   		 document.getElementById('purchaseQuantity').focus();
  		 
   	 } else {
   		 this.showSearchStatus(`❌ Product with barcode "${barcodeValue}" not found in inventory`, 'error');
   		 this.hideProductDisplay();
   	 }
  	 
    } catch (error) {
   	 console.error('Error searching product:', error);
   	 this.showSearchStatus('Error searching product. Please try again.', 'error');
    }
}

// Display product information
displayProductForPurchase(product) {
    const displaySection = document.getElementById('productDisplaySection');
    if (!displaySection) return;
    
    // Update display elements
    document.getElementById('productNameDisplay').textContent = product.name || 'N/A';
    document.getElementById('productBarcodeDisplay').textContent = product.barcode || 'N/A';
    document.getElementById('productCategoryDisplay').textContent = product.category || 'Uncategorized';
    document.getElementById('currentStockDisplay').textContent = `${product.quantity || 0} ${product.unit || 'units'}`;
    document.getElementById('costPriceDisplay').textContent = `₦${(product.purchasePrice || 0).toFixed(2)}`;
    document.getElementById('sellingPriceDisplay').textContent = `₦${(product.sellingPrice || 0).toFixed(2)}`;
    
    // Set hidden fields
    document.getElementById('productId').value = product.id;
    document.getElementById('productBarcode').value = product.barcode;
    
    // Show the display section
    displaySection.style.display = 'block';
}

// Hide product display
hideProductDisplay() {
    const displaySection = document.getElementById('productDisplaySection');
    const purchaseForm = document.getElementById('purchaseFormSection');
    
    if (displaySection) displaySection.style.display = 'none';
    if (purchaseForm) purchaseForm.style.display = 'none';
    
    this.currentProduct = null;
}

// Show search status
showSearchStatus(message, type = 'info') {
    const statusElement = document.getElementById('searchStatus');
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

// Calculate purchase total
calculatePurchaseTotal() {
    const quantity = parseFloat(document.getElementById('purchaseQuantity').value) || 0;
    const unitCost = parseFloat(document.getElementById('unitCost').value) || 0;
    
    const totalCost = quantity * unitCost;
    
    const totalCostField = document.getElementById('totalCost');
    if (totalCostField) {
   	 totalCostField.value = totalCost.toFixed(2);
    }
    
    // NO WALLET BALANCE CHECK
}

// Check wallet balance
/*
checkWalletBalance(totalCost) {
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    if (!currentUser) return;
    
    const balanceWarning = document.getElementById('balanceWarning');
    const processBtn = document.getElementById('processPurchaseBtn');
    
    // Always enable process button since wallet balance doesn't matter
    if (processBtn) {
   	 processBtn.disabled = false;
    }
    
    // Show warning but don't prevent purchase
    if (totalCost > currentUser.wallet) {
   	 if (balanceWarning) {
   		 balanceWarning.style.display = 'block';
   		 balanceWarning.innerHTML = `
       		 ⚠️ Note: Total cost (₦${totalCost.toFixed(2)}) exceeds wallet balance (₦${currentUser.wallet.toFixed(2)}).
       		 Purchase will be recorded without affecting wallet balance.
   		 `;
   	 }
    } else {
   	 if (balanceWarning) {
   		 balanceWarning.style.display = 'none';
   	 }
    }
}
*/

// Update wallet balance display
/*
updateWalletBalanceDisplay() {
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    if (!currentUser) return;
    
    const balanceElement = document.getElementById('currentWalletBalance');
    if (balanceElement) {
   	 balanceElement.textContent = `₦${currentUser.wallet.toFixed(2)}`;
    }
}
*/

// Clear purchase form
clearPurchaseForm() {
    // Clear input fields
    document.getElementById('searchProductBarcode').value = '';
    document.getElementById('purchaseQuantity').value = '';
    document.getElementById('unitCost').value = '';
    document.getElementById('totalCost').value = '';
    document.getElementById('supplier').value = '';
    document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseNotes').value = '';
    
    // Hide sections
    this.hideProductDisplay();
    
    // Clear status and messages
    const statusElement = document.getElementById('searchStatus');
    const messageElement = document.getElementById('purchaseMessage');
    
    if (statusElement) statusElement.style.display = 'none';
    if (messageElement) {
   	 messageElement.style.display = 'none';
   	 messageElement.innerHTML = '';
    }
    
    // Reset product reference
    this.currentProduct = null;
    
    // Focus on search input
    document.getElementById('searchProductBarcode').focus();
}





// Process purchase
async processPurchase() {
    // Get form values
    const productId = document.getElementById('productId').value;
    const productBarcode = document.getElementById('productBarcode').value;
    const quantity = parseInt(document.getElementById('purchaseQuantity').value);
    const unitCost = parseFloat(document.getElementById('unitCost').value);
    const totalCost = parseFloat(document.getElementById('totalCost').value);
    const supplier = document.getElementById('supplier').value.trim();
    const purchaseDate = document.getElementById('purchaseDate').value;
    const notes = document.getElementById('purchaseNotes').value.trim();
    
    // Validate
    if (!productId) {
   	 this.showPurchaseMessage('Please search for a product first', 'error');
   	 return;
    }
    
    if (!quantity || quantity < 1) {
   	 this.showPurchaseMessage('Please enter a valid quantity (minimum 1)', 'error');
   	 document.getElementById('purchaseQuantity').focus();
   	 return;
    }
    
    if (!unitCost || unitCost <= 0) {
   	 this.showPurchaseMessage('Please enter a valid unit cost', 'error');
   	 document.getElementById('unitCost').focus();
   	 return;
    }
    
    try {
   	 const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
   	 if (!currentUser) {
   		 this.showPurchaseMessage('Please login first', 'error');
   		 return;
   	 }
  	 
   	 // Disable process button
   	 const processBtn = document.getElementById('processPurchaseBtn');
   	 if (processBtn) {
   		 processBtn.disabled = true;
   		 processBtn.innerHTML = '<span class="spinner"></span> Processing...';
   	 }
  	 
   	 // Get current product info before update
   	 const inventoryData = await api.getUserInventory(currentUser.userID);
   	 const products = inventoryData.products || [];
   	 const product = products.find(p => p.id === productId);
  	 
   	 if (!product) {
   		 throw new Error('Product not found in inventory');
   	 }
  	 
   	 const oldQuantity = product.quantity || 0;
   	 const newQuantity = oldQuantity + quantity;
  	 
   	 // 1. Update product quantity in inventory
   	 await api.updateProductQuantity(currentUser.userID, productId, quantity);
  	 
   	 // 2. Record purchase transaction (NO WALLET CHECK OR DEDUCTION)
   	 await api.addPurchaseTransaction(currentUser.userID, {
   		 productId: productId,
   		 productName: product.name,
   		 barcode: productBarcode,
   		 quantity: quantity,
   		 unitPrice: unitCost,
   		 amount: totalCost,
   		 supplier: supplier || product.supplier || 'Unknown',
   		 purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
   		 notes: notes,
   		 type: 'restock',
   		 previousStock: oldQuantity,
   		 newStock: newQuantity,
   		 timestamp: new Date().toISOString()
   	 });
  	 
   	 // Show success message
   	 this.showPurchaseMessage(`
   		 <div class="success-card">
       		 <div class="success-icon">✅</div>
       		 <div class="success-details">
           		 <h3>Purchase Recorded Successfully!</h3>
           		 <div class="success-grid">
               		 <div class="success-item">
                   		 <span class="success-label">Product:</span>
                   		 <span class="success-value">${product.name}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Barcode:</span>
                   		 <span class="success-value">${productBarcode}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Quantity Added:</span>
                   		 <span class="success-value">${quantity} ${product.unit || 'units'}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Previous Stock:</span>
                   		 <span class="success-value">${oldQuantity} ${product.unit || 'units'}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">New Stock:</span>
                   		 <span class="success-value">${newQuantity} ${product.unit || 'units'}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Unit Cost:</span>
                   		 <span class="success-value">₦${unitCost.toFixed(2)}</span>
               		 </div>
               		 <div class="success-item">
                   		 <span class="success-label">Total Cost:</span>
                   		 <span class="success-value">₦${totalCost.toFixed(2)}</span>
               		 </div>
               		 ${supplier ? `
               		 <div class="success-item">
                   		 <span class="success-label">Supplier:</span>
                   		 <span class="success-value">${supplier}</span>
               		 </div>
               		 ` : ''}
           		 </div>
       		 </div>
       		 <div class="success-actions">
           		 <button class="btn-primary" onclick="app.clearPurchaseForm()">
               		 Add Another Product
           		 </button>
           		 <button class="btn-secondary" onclick="app.handleMenuAction('products')">
               		 Back to Products
           		 </button>
       		 </div>
   		 </div>
   	 `, 'success');
  	 
   	 // Clear form for next entry
   	 document.getElementById('purchaseQuantity').value = '';
   	 document.getElementById('unitCost').value = '';
   	 document.getElementById('totalCost').value = '';
   	 document.getElementById('supplier').value = '';
   	 document.getElementById('purchaseNotes').value = '';
  	 
   	 // Update displayed current stock
   	 document.getElementById('currentStockDisplay').textContent =
   		 `${newQuantity} ${product.unit || 'units'}`;
  	 
   	 // Update current product reference
   	 if (this.currentProduct) {
   		 this.currentProduct.quantity = newQuantity;
   	 }
  	 
    } catch (error) {
   	 console.error('Error processing purchase:', error);
   	 this.showPurchaseMessage(`❌ Error: ${error.message}`, 'error');
    } finally {
   	 // Re-enable process button
   	 const processBtn = document.getElementById('processPurchaseBtn');
   	 if (processBtn) {
   		 processBtn.disabled = false;
   		 processBtn.innerHTML = '<span class="menu-icon">💾</span> Process Purchase';
   	 }
    }
}

// Show purchase message
showPurchaseMessage(message, type = 'info') {
    const messageElement = document.getElementById('purchaseMessage');
    if (!messageElement) return;
    
    messageElement.innerHTML = message;
    messageElement.style.display = 'block';
    
    // Set styling based on type
    if (type === 'error') {
   	 messageElement.style.backgroundColor = '#f8d7da';
   	 messageElement.style.color = '#721c24';
   	 messageElement.style.border = '1px solid #f5c6cb';
   	 messageElement.style.padding = '15px';
   	 messageElement.style.borderRadius = '8px';
    } else if (type === 'success') {
   	 messageElement.style.backgroundColor = 'transparent';
   	 messageElement.style.border = 'none';
   	 messageElement.style.padding = '0';
    }
    
    // Scroll to message
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
}



// Add this method to the WebStarNgApp class in app.js
// Similar updates for purchase report - create renderPurchaseReport() method
async getPurchaseReport() {
	try {
    	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    	if (!currentUser) {
        	return `<div class="error-message">Please login to view purchase report</div>`;
    	}

    	const userGroup = currentUser.userGroup || 0;
    	const isAdmin = userGroup >= 2;
    	const today = new Date().toISOString().split('T')[0];
    	const currentUserID = currentUser.userID;

    	// Get purchases data
    	const purchasesData = await api.getUserPurchases(currentUser.userID, true, isAdmin);
    	const allTransactions = purchasesData.allTransactions || [];
   	 
    	// Filter today's transactions
    	let todayPurchases = [];
   	 
    	if (isAdmin) {
        	todayPurchases = allTransactions.filter(transaction => {
            	if (!transaction.timestamp && !transaction.purchaseDate) return false;
            	const transactionDate = transaction.purchaseDate || transaction.timestamp;
            	const dateStr = new Date(transactionDate).toISOString().split('T')[0];
            	return dateStr === today;
        	});
    	} else {
        	todayPurchases = allTransactions.filter(transaction => {
            	const transactionUserID = transaction.performedBy || transaction.userID;
            	if (!transactionUserID || transactionUserID !== currentUserID) {
                	return false;
            	}
           	 
            	if (!transaction.timestamp && !transaction.purchaseDate) return false;
            	const transactionDate = transaction.purchaseDate || transaction.timestamp;
            	const dateStr = new Date(transactionDate).toISOString().split('T')[0];
            	return dateStr === today;
        	});
    	}

    	// Create pagination instance
    	this.purchaseReportPagination = new ReportPagination(todayPurchases, 10);
   	 
    	// Store for rendering
    	this.currentPurchaseData = {
        	todayPurchases,
        	isAdmin,
        	currentUserID,
        	currentUser,
        	today,
        	userGroup
    	};
   	 
    	return this.renderPurchaseReport();
   	 
	} catch (error) {
    	console.error('Error generating purchase report:', error);
    	return `
        	<div class="content-page">
            	<div class="error-message" style="text-align: center; padding: 40px 20px; background: #f8f9fa; border-radius: 12px; margin: 20px 0;">
                	<h3 style="color: #e74c3c; margin-bottom: 15px;">Error Loading Purchase Report</h3>
                	<p style="color: #7f8c8d; margin-bottom: 20px;">Unable to load purchase data. Please try again.</p>
                	<button class="btn-primary" onclick="app.handleMenuAction('purchase-day')">
                    	Retry
                	</button>
            	</div>
        	</div>
    	`;
	}
}

// Add renderPurchaseReport() method (similar structure to renderSalesReport)
renderPurchaseReport() {
	// Implementation similar to renderSalesReport() but for purchases
	// Create paginated purchase report with 10 items per page
	// [Full implementation would follow same pattern as sales report]
}


// Add these methods to WebStarNgApp class in app.js:

// Check user permissions based on userGroup
checkUserPermissions() {
	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
	if (!currentUser) return { userGroup: 0, hasAccess: false };

	const userGroup = currentUser.userGroup || 0;

	return {
    	userGroup: userGroup,
    	// Basic users can access everything EXCEPT sales and purchase reports
    	canAccessSalesReport: userGroup >= 1, // Groups 1, 2, 3 can access
    	canAccessPurchaseReport: userGroup >= 1, // Groups 1, 2, 3 can access
    	canViewAllSales: userGroup >= 2, // Only groups 2 and 3 can view all sales
    	canViewAllPurchases: userGroup >= 2, // Only groups 2 and 3 can view all purchases
    	canAccessSetup: userGroup >= 0,
    	canAccessAllMenus: userGroup >= 0,
    	canCreateUsers: userGroup === 3,
    	isAdmin: userGroup >= 2 // Groups 2 and 3 are admins
	};
}

// Show access denied message
showAccessDenied(featureName = 'this feature') {
    const perms = this.checkUserPermissions();
    const userGroupLabel = this.getUserGroupLabel(perms.userGroup);
    
    alert(`🔒 Access Denied\n\nFeature: ${featureName}\nYour Account Type: ${userGroupLabel}\n\nRequired: Higher access level\nPlease contact your administrator for access.`);
}

// Get user group label
getUserGroupLabel(userGroup) {
    switch(parseInt(userGroup)) {
   	 case 0: return 'Basic User';
   	 case 1: return 'Standard User';
   	 case 2: return 'Manager';
   	 case 3: return 'Super Admin';
   	 default: return 'Basic User';
    }
}

// Update user display with group info
updateUserDisplay(user) {
    const userGroup = user.userGroup || 0;
    const userGroupLabel = this.getUserGroupLabel(userGroup);
    
    const elements = {
   	 'currentUser': user.userID,
   	 'sidebarUser': user.userID,
   	 'userFullName': user.fullName || 'Demo User',
   	 'userIdDisplay': user.userID,
   	 'walletBalance': user.wallet ? user.wallet.toFixed(2) : '0.00',
   	 'sidebarBalance': user.wallet ? user.wallet.toFixed(2) : '0.00',
   	 // Add user group display elements if they exist
   	 'userGroupDisplay': userGroupLabel,
   	 'sidebarUserGroup': userGroupLabel
    };

    for (const [id, value] of Object.entries(elements)) {
   	 const element = document.getElementById(id);
   	 if (element) {
   		 element.textContent = value;
  		 
   		 // Add badge styling for user group
   		 if (id.includes('UserGroup') || id.includes('userGroup')) {
       		 element.className = `user-group-badge group-${userGroup}`;
   		 }
   	 }
    }
    
    
    
    const receiptCounter = document.getElementById('receiptCounter');
      if (receiptCounter) {
 		 const nextReceipt = parseInt(localStorage.getItem('receipt_counter') || '1000');
 		 receiptCounter.textContent = nextReceipt;
      }
 
 
 
   // Add shared database indicator if applicable
	if (user.sharesAllBins || user.sharedSales || user.sharedPurchases) {
    	const userGroupElement = document.getElementById('sidebarUserGroup');
    	if (userGroupElement) {
        	const originalText = userGroupElement.textContent;
        	userGroupElement.textContent = `${originalText} 🔄`;
        	userGroupElement.title = 'Shared Database User';
    	}
	}
 
    
    // Update menu visibility based on permissions
    this.updateMenuVisibility(userGroup);
}


// Add this method if it doesn't exist, or fix the existing one:
// In getNewUserForm() method in app.js, add inheritance info:
getNewUserForm() {
	// Get current user to show what will be inherited
	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    
	return `
    	<div class="content-page">
        	<h2>👤 Create New User</h2>
        	<p>Create a new system user account. This feature is only available to Administrators.</p>
       	 
        	<!-- Inheritance Information -->
        	<div class="inheritance-info" style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 12px; border-left: 5px solid #2196f3;">
            	<h3 style="color: #1976d2; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                	<span>🔄</span> Inheritance Information
            	</h3>
            	<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                	<div>
                    	<strong>Creating User:</strong><br>
                    	<span>${currentUser?.userID || 'Current User'}</span>
                	</div>
                	<div>
                    	<strong>Business Name:</strong><br>
                    	<span>${currentUser?.businessName || 'Company name'}</span>
                	</div>
                	<div>
                    	<strong>Contact:</strong><br>
                    	<span>${currentUser?.telephone || '070 56 7356 63'}</span>
                	</div>
            	</div>
            	<div style="margin-top: 15px; padding: 12px; background: white; border-radius: 8px; font-size: 0.9em;">
                	<strong>⚠️ Note:</strong> New user will inherit:
                	<ul style="margin: 8px 0 0 20px;">
                    	<li>Same business information</li>
                    	<li>Access to shared inventory structure</li>
                    	<li>Separate sales and purchase records</li>
                    	<li>Independent wallet balance (starts at ₦0)</li>
                	</ul>
            	</div>
        	</div>
       	 
        	<form id="newSystemUserForm" class="content-form">
            	<div class="form-row">
                	<div class="form-group">
                    	<label for="newSystemUserID" class="required-field">User ID *</label>
                    	<input type="text" id="newSystemUserID" name="newSystemUserID" required
                        	placeholder="Enter unique user ID">
                	</div>
                	<div class="form-group">
                    	<label for="newSystemFullName" class="required-field">Full Name *</label>
                    	<input type="text" id="newSystemFullName" name="newSystemFullName" required
                        	placeholder="Enter full name">
                	</div>
            	</div>
           	 
            	<div class="form-row">
                	<div class="form-group">
                    	<label for="newSystemPassword" class="required-field">Password *</label>
                    	<input type="password" id="newSystemPassword" name="newSystemPassword" required
                        	placeholder="Enter password">
                	</div>
                	<div class="form-group">
                    	<label for="confirmSystemPassword" class="required-field">Confirm Password *</label>
                    	<input type="password" id="confirmSystemPassword" name="confirmSystemPassword" required
                        	placeholder="Confirm password">
                	</div>
            	</div>
           	 
            	<div class="form-row">
                	<div class="form-group">
                    	<label for="newUserGroup" class="required-field">User Group *</label>
                    	<select id="newUserGroup" name="newUserGroup" required>
                        	<option value="0">Basic User (Limited Access)</option>
                        	<option value="1">Standard User</option>
                        	<option value="2">Manager</option>
                        	<option value="3" ${currentUser?.userGroup === 3 ? '' : 'disabled'}>Administrator</option>
                    	</select>
                    	<div class="form-hint">
                        	Basic users cannot access "Sales of the Day" report
                    	</div>
                	</div>
                	<div class="form-group">
                    	<label for="newUserEmail">Email Address</label>
                    	<input type="email" id="newUserEmail" name="newUserEmail"
                        	placeholder="Enter email address"
                        	value="${currentUser?.email || ''}">
                	</div>
            	</div>
           	 
            	<!-- Business Information Section (Read-only, showing inherited values) -->
            	<div class="form-section" style="margin-top: 25px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                	<h3 style="color: #2c3e50; margin-bottom: 15px;">Inherited Business Information</h3>
                	<div class="form-row">
                    	<div class="form-group">
                        	<label>Business Name (Inherited)</label>
                        	<input type="text" readonly value="${currentUser?.businessName || 'Company name'}"
                            	class="readonly-field" style="background: #e9ecef;">
                    	</div>
                    	<div class="form-group">
                        	<label>Telephone (Inherited)</label>
                        	<input type="text" readonly value="${currentUser?.telephone || '070 56 7356 63'}"
                            	class="readonly-field" style="background: #e9ecef;">
                    	</div>
                	</div>
                	<div class="form-row">
                    	<div class="form-group">
                        	<label>Address Line 1 (Inherited)</label>
                        	<input type="text" readonly value="${currentUser?.addressLine1 || 'Address line 1'}"
                            	class="readonly-field" style="background: #e9ecef;">
                    	</div>
                    	<div class="form-group">
                        	<label>Email (Inherited)</label>
                        	<input type="text" readonly value="${currentUser?.email || 'xemail@xmail.com'}"
                            	class="readonly-field" style="background: #e9ecef;">
                    	</div>
                	</div>
                	<div style="font-size: 0.9em; color: #6c757d; margin-top: 10px;">
                    	<span>ℹ️</span> This information is inherited from ${currentUser?.userID || 'the creating user'}
                	</div>
            	</div>
           	 
            	<div class="form-actions-content">
                	<button type="submit" class="btn-primary" id="createUserBtn">
                    	<span class="menu-icon">👤</span> Create User with Inheritance
                	</button>
                	<button type="button" class="btn-secondary" onclick="app.loadMenuContent('setup')">
                    	<span class="menu-icon">↩️</span> Cancel
                	</button>
            	</div>
        	</form>
    	</div>
	`;
}



// ========== PAYSTACK PAYMENT METHODS ==========

    // Get wallet top-up form with Paystack integration
    getWalletTopUpForm() {
   	 const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
   	 const currentBalance = currentUser ? currentUser.wallet : 0;
  	 
   	 return `
   		 <div class="content-page">
       		 <div class="payment-form-container">
           		 <div class="payment-header">
               		 <h2>💰 Wallet Top-Up</h2>
               		 <p>Add funds to your wallet using Paystack payment gateway</p>
           		 </div>
          		 
           		 <!-- Current Balance Display -->
           		 <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
               		 <div style="display: flex; justify-content: space-between; align-items: center;">
                   		 <span style="font-weight: 600; color: #2c3e50;">Current Balance:</span>
                   		 <span style="font-size: 1.2em; font-weight: 700; color: #2ecc71;">₦${currentBalance.toFixed(2)}</span>
               		 </div>
           		 </div>
          		 
           		 <!-- Payment Amount Section -->
           		 <div style="margin-bottom: 25px;">
               		 <h3 style="color: #2c3e50; margin-bottom: 15px;">Payment Amount</h3>
              		 
               		 <!-- Quick Amount Selection -->
               		 <div class="amount-quick-select">
                   		 <div class="amount-option" data-amount="1000">₦1,000</div>
                   		 <div class="amount-option" data-amount="2000">₦2,000</div>
                   		 <div class="amount-option" data-amount="5000">₦5,000</div>
                   		 <div class="amount-option" data-amount="10000">₦10,000</div>
                   		 <div class="amount-option" data-amount="20000">₦20,000</div>
                   		 <div class="amount-option" data-amount="50000">₦50,000</div>
               		 </div>
              		 
               		 <!-- Custom Amount Input -->
               		 <div style="margin-top: 20px;">
                   		 <label for="customAmount" style="display: block; margin-bottom: 8px; color: #2c3e50; font-weight: 500;">Or Enter Custom Amount (₦)</label>
                   		 <input type="number"
                          		 id="customAmount"
                          		 name="customAmount"
                          		 min="100"
                          		 max="1000000"
                          		 step="100"
                          		 placeholder="Enter amount (minimum ₦100)"
                          		 value="1000"
                          		 style="width: 100%; padding: 12px 15px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 16px;">
                   		 <div style="font-size: 0.85em; color: #7f8c8d; margin-top: 5px;">Minimum: ₦100 | Maximum: ₦1,000,000</div>
               		 </div>
           		 </div>
          		 
           		 <!-- Amount Display -->
           		 <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 25px;">
               		 <div style="font-size: 0.9em; opacity: 0.9;">You are paying:</div>
               		 <div style="font-size: 2.5em; font-weight: 700; margin: 10px 0;">₦<span id="displayAmount">1,000.00</span></div>
               		 <div style="font-size: 0.9em; opacity: 0.9;" id="paymentFeeInfo">+ ₦0.00 transaction fee</div>
           		 </div>
          		 
           		 <!-- Email Input -->
           		 <div style="margin-bottom: 25px;">
               		 <label for="customerEmail" style="display: block; margin-bottom: 8px; color: #2c3e50; font-weight: 500;">Email Address *</label>
               		 <input type="email"
                      		 id="customerEmail"
                      		 name="customerEmail"
                      		 required
                      		 placeholder="Enter your email for receipt"
                      		 value="${currentUser?.email || ''}"
                      		 style="width: 100%; padding: 12px 15px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 16px;">
           		 </div>
          		 
           		 <!-- Paystack Payment Button -->
           		 <button id="paystackPayButton" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #00a859 0%, #008751 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
               		 <span>💳</span> Proceed to Pay ₦<span id="payButtonAmount">1,000.00</span>
           		 </button>
          		 
           		 <!-- Payment Status Display -->
           		 <div id="paymentStatus" style="display: none; margin-top: 20px;"></div>
          		 
           		 <!-- Security Note -->
           		 <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px; color: #7f8c8d; font-size: 0.9em;">
               		 <span style="color: #2ecc71;">🔒</span>
               		 <span>Secure payment by Paystack. Your card details are never stored.</span>
           		 </div>
       		 </div>
   		 </div>
   	 `;
    }

    // Initialize payment form
    initializePaymentForm() {
   	 // Amount quick select
   	 const amountOptions = document.querySelectorAll('.amount-option');
   	 amountOptions.forEach(option => {
   		 option.addEventListener('click', () => {
       		 amountOptions.forEach(opt => opt.classList.remove('selected'));
       		 option.classList.add('selected');
       		 const amount = option.getAttribute('data-amount');
       		 document.getElementById('customAmount').value = amount;
       		 this.updatePaymentAmount();
   		 });
   	 });
  	 
   	 // Custom amount input
   	 const customAmountInput = document.getElementById('customAmount');
   	 if (customAmountInput) {
   		 customAmountInput.addEventListener('input', () => {
       		 amountOptions.forEach(opt => opt.classList.remove('selected'));
       		 this.updatePaymentAmount();
   		 });
   	 }
  	 
   	 // Paystack payment button
   	 const payButton = document.getElementById('paystackPayButton');
   	 if (payButton) {
   		 payButton.addEventListener('click', () => {
       		 this.processPaystackPayment();
   		 });
   	 }
  	 
   	 // Initial amount update
   	 this.updatePaymentAmount();
    }

    // Update payment amount display
    updatePaymentAmount() {
   	 const amountInput = document.getElementById('customAmount');
   	 if (!amountInput) return;
  	 
   	 let amount = parseFloat(amountInput.value) || 1000;
  	 
   	 // Validate minimum and maximum
   	 if (amount < 100) amount = 100;
   	 if (amount > 1000000) amount = 1000000;
  	 
   	 // Update input value
   	 amountInput.value = amount;
  	 
   	 // Calculate transaction fee (1.5% + ₦100, maximum ₦2000)
   	 const fee = Math.min(Math.ceil(amount * 0.015) + 100, 2000);
   	 const totalAmount = amount + fee;
  	 
   	 // Update displays
   	 const displayAmount = document.getElementById('displayAmount');
   	 const payButtonAmount = document.getElementById('payButtonAmount');
   	 const feeInfo = document.getElementById('paymentFeeInfo');
  	 
   	 if (displayAmount) {
   		 displayAmount.textContent = totalAmount.toLocaleString('en-NG', {
       		 minimumFractionDigits: 2,
       		 maximumFractionDigits: 2
   		 });
   	 }
  	 
   	 if (payButtonAmount) {
   		 payButtonAmount.textContent = totalAmount.toLocaleString('en-NG', {
       		 minimumFractionDigits: 2,
       		 maximumFractionDigits: 2
   		 });
   	 }
  	 
   	 if (feeInfo) {
   		 feeInfo.textContent = `+ ₦${fee.toLocaleString('en-NG', {
       		 minimumFractionDigits: 2,
       		 maximumFractionDigits: 2
   		 })} transaction fee`;
   	 }
    }

    // Validate amount
    validateAmount() {
   	 const amountInput = document.getElementById('customAmount');
   	 if (!amountInput) return true;
  	 
   	 const amount = parseFloat(amountInput.value) || 0;
  	 
   	 if (amount < 100) {
   		 alert('Minimum payment amount is ₦100');
   		 amountInput.value = 100;
   		 this.updatePaymentAmount();
   		 return false;
   	 }
  	 
   	 if (amount > 1000000) {
   		 alert('Maximum payment amount is ₦1,000,000');
   		 amountInput.value = 1000000;
   		 this.updatePaymentAmount();
   		 return false;
   	 }
  	 
   	 return true;
    }

    // Validate email
    isValidEmail(email) {
   	 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   	 return emailRegex.test(email);
    }

    // Process Paystack payment
    // Update the processPaystackPayment method in app.js:
  async processPaystackPayment() {
    // Validate inputs
    if (!this.validateAmount()) return;
    
    const amountInput = document.getElementById('customAmount');
    const emailInput = document.getElementById('customerEmail');
    
    if (!amountInput || !emailInput) return;
    
    const amount = parseFloat(amountInput.value) || 1000;
    const email = emailInput.value.trim();
    
    // Validate email
    if (!email || !this.isValidEmail(email)) {
   	 alert('Please enter a valid email address for your payment receipt');
   	 emailInput.focus();
   	 return;
    }
    
    // Calculate total amount with fees
    const fee = Math.min(Math.ceil(amount * 0.015) + 100, 2000);
    const totalAmount = amount + fee;
    
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    if (!currentUser) {
   	 alert('Please login to make a payment');
   	 return;
    }
    
    // Store current instance reference
    const self = this;
    
    // Disable payment button and show loading
    const payButton = document.getElementById('paystackPayButton');
    if (payButton) {
   	 payButton.disabled = true;
   	 payButton.innerHTML = '<span>⏳</span> Processing...';
    }
    
    // Show payment processing
    this.showPaymentStatus('Processing payment...', 'info');
    
    try {
   	 // Create callback function with proper binding
   	 const paymentCallback = function(response) {
   		 console.log('Paystack payment successful:', response);
  		 
   		 // Re-enable payment button
   		 if (payButton) {
       		 payButton.disabled = false;
       		 payButton.innerHTML = '<span>💳</span> Proceed to Pay';
   		 }
  		 
   		 // Process successful payment
   		 self.handleSuccessfulPayment(response, amount, totalAmount, fee, currentUser);
   	 };
  	 
   	 // Create onClose function
   	 const paymentOnClose = function() {
   		 console.log('Payment modal closed');
  		 
   		 // Re-enable payment button
   		 if (payButton) {
       		 payButton.disabled = false;
       		 payButton.innerHTML = '<span>💳</span> Proceed to Pay';
   		 }
  		 
   		 self.showPaymentStatus('Payment cancelled. You can try again.', 'warning');
   	 };
  	 
   	 // Initialize Paystack payment with properly defined functions
   	 const handler = PaystackPop.setup({
   		 key: PAYSTACK_CONFIG.publicKey,
   		 email: email,
   		 amount: totalAmount * 100, // Convert to kobo
   		 currency: 'NGN',
   		 ref: `WSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
   		 metadata: {
       		 custom_fields: [
           		 {
               		 display_name: "User ID",
               		 variable_name: "user_id",
               		 value: currentUser.userID
           		 },
           		 {
               		 display_name: "Wallet Top-up",
               		 variable_name: "transaction_type",
               		 value: "wallet_topup"
           		 },
           		 {
               		 display_name: "Amount Added",
               		 variable_name: "amount_added",
               		 value: amount
           		 }
       		 ]
   		 },
   		 callback: paymentCallback, // Pass the defined function
   		 onClose: paymentOnClose    // Pass the defined function
   	 });
  	 
   	 // Open Paystack payment modal
   	 handler.openIframe();
  	 
    } catch (error) {
   	 console.error('Paystack payment error:', error);
  	 
   	 // Re-enable payment button
   	 if (payButton) {
   		 payButton.disabled = false;
   		 payButton.innerHTML = '<span>💳</span> Proceed to Pay';
   	 }
  	 
   	 this.showPaymentStatus(`Payment error: ${error.message}`, 'error');
    }
}

    // Handle successful payment
    async handleSuccessfulPayment(paymentResponse, amount, totalPaid, fee, currentUser) {
   	 try {
   		 this.showPaymentStatus('Payment successful! Updating your wallet...', 'success');
  		 
   		 // Add funds to user's wallet
   		 const newBalance = await api.addFunds(currentUser.userID, amount);
  		 
   		 // Update local session
   		 currentUser.wallet = newBalance;
   		 localStorage.setItem('webstarng_user', JSON.stringify(currentUser));
  		 
   		 // Record payment transaction
   		 await this.recordPaymentTransaction({
       		 userId: currentUser.userID,
       		 paymentId: paymentResponse.reference,
       		 amount: amount,
       		 totalPaid: totalPaid,
       		 fee: fee,
       		 paymentMethod: 'paystack',
       		 status: 'success',
       		 paymentData: paymentResponse,
       		 timestamp: new Date().toISOString()
   		 });
  		 
   		 // Show success details
   		 setTimeout(() => {
       		 this.showPaymentSuccessDetails({
           		 reference: paymentResponse.reference,
           		 amount: amount,
           		 totalPaid: totalPaid,
           		 fee: fee,
           		 newBalance: newBalance,
           		 transactionDate: new Date().toLocaleString()
       		 });
      		 
       		 // Update UI with new balance
       		 this.updateUserDisplay(currentUser);
      		 
   		 }, 1000);
  		 
   	 } catch (error) {
   		 console.error('Error processing payment:', error);
   		 this.showPaymentStatus(`Error updating wallet: ${error.message}`, 'error');
   	 }
    }

    // Record payment transaction
    async recordPaymentTransaction(transactionData) {
   	 try {
   		 // Store in localStorage
   		 const paymentHistory = JSON.parse(localStorage.getItem('payment_history') || '[]');
  		 
   		 const transaction = {
       		 id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
       		 userId: transactionData.userId,
       		 paymentId: transactionData.paymentId,
       		 amount: transactionData.amount,
       		 totalPaid: transactionData.totalPaid,
       		 fee: transactionData.fee,
       		 paymentMethod: transactionData.paymentMethod,
       		 status: transactionData.status,
       		 timestamp: transactionData.timestamp,
       		 createdAt: new Date().toISOString()
   		 };
  		 
   		 paymentHistory.push(transaction);
   		 localStorage.setItem('payment_history', JSON.stringify(paymentHistory));
  		 
   		 return transaction;
  		 
   	 } catch (error) {
   		 console.error('Error recording payment transaction:', error);
   	 }
    }

    // Show payment status
    showPaymentStatus(message, type = 'info') {
   	 const statusElement = document.getElementById('paymentStatus');
   	 if (!statusElement) return;
  	 
   	 let icon = '⏳';
   	 let bgColor = '#f8f9fa';
   	 let textColor = '#7f8c8d';
   	 let borderColor = '#e1e5e9';
  	 
   	 switch(type) {
   		 case 'success':
       		 icon = '✅';
       		 bgColor = '#e8f6f3';
       		 textColor = '#27ae60';
       		 borderColor = '#2ecc71';
       		 break;
   		 case 'error':
       		 icon = '❌';
       		 bgColor = '#ffebee';
       		 textColor = '#c62828';
       		 borderColor = '#e74c3c';
       		 break;
   		 case 'warning':
       		 icon = '⚠️';
       		 bgColor = '#fff3cd';
       		 textColor = '#856404';
       		 borderColor = '#ffeaa7';
       		 break;
   	 }
  	 
   	 statusElement.innerHTML = `
   		 <div style="padding: 15px; background: ${bgColor}; color: ${textColor}; border: 2px solid ${borderColor}; border-radius: 8px; text-align: center;">
       		 <div style="font-size: 1.2em; margin-bottom: 10px;">${icon}</div>
       		 <div>${message}</div>
   		 </div>
   	 `;
  	 
   	 statusElement.style.display = 'block';
    }

    // Show payment success details
    showPaymentSuccessDetails(details) {
   	 const statusElement = document.getElementById('paymentStatus');
   	 if (!statusElement) return;
  	 
   	 statusElement.innerHTML = `
   		 <div style="background: #e8f6f3; border: 2px solid #2ecc71; color: #27ae60; text-align: center; padding: 30px; border-radius: 12px; margin: 20px 0;">
       		 <div style="font-size: 3em; margin-bottom: 15px;">🎉</div>
       		 <h3 style="margin-bottom: 10px; font-size: 1.3em;">Payment Successful!</h3>
       		 <p>Your wallet has been topped up successfully.</p>
      		 
       		 <div style="background: rgba(255,255,255,0.5); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
           		 <p style="margin: 8px 0; display: flex; justify-content: space-between;">
               		 <strong>Reference:</strong>
               		 <span>${details.reference}</span>
           		 </p>
           		 <p style="margin: 8px 0; display: flex; justify-content: space-between;">
               		 <strong>Amount Added:</strong>
               		 <span>₦${details.amount.toLocaleString('en-NG', {minimumFractionDigits: 2})}</span>
           		 </p>
           		 <p style="margin: 8px 0; display: flex; justify-content: space-between;">
               		 <strong>Transaction Fee:</strong>
               		 <span>₦${details.fee.toLocaleString('en-NG', {minimumFractionDigits: 2})}</span>
           		 </p>
           		 <p style="margin: 8px 0; display: flex; justify-content: space-between;">
               		 <strong>Total Paid:</strong>
               		 <span>₦${details.totalPaid.toLocaleString('en-NG', {minimumFractionDigits: 2})}</span>
           		 </p>
           		 <p style="margin: 8px 0; display: flex; justify-content: space-between;">
               		 <strong>New Balance:</strong>
               		 <span style="color: #2ecc71; font-weight: 700;">₦${details.newBalance.toLocaleString('en-NG', {minimumFractionDigits: 2})}</span>
           		 </p>
           		 <p style="margin: 8px 0; display: flex; justify-content: space-between;">
               		 <strong>Date & Time:</strong>
               		 <span>${details.transactionDate}</span>
           		 </p>
       		 </div>
      		 
       		 <div style="margin-top: 20px;">
           		 <button onclick="app.handleMenuAction('wallet-topup')" style="padding: 10px 20px; background: #2ecc71; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
               		 Make Another Payment
           		 </button>
           		 <button onclick="app.goToHomeDashboard()" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer;">
               		 Return to Dashboard
           		 </button>
       		 </div>
      		 
       		 <div style="margin-top: 15px; font-size: 0.9em; color: #7f8c8d;">
           		 A receipt has been sent to your email.
       		 </div>
   		 </div>
   	 `;
  	 
   	 statusElement.style.display = 'block';
    }



// Alternative simpler method in WebStarNgApp class:
showPaystackPaymentModal() {
    // Simply redirect to the wallet topup page
    this.handleMenuAction('wallet-topup');
}

// Add this simple print receipt method
// Replace the existing printSimpleReceipt() method with this:

printSimpleReceipt(cartItems, totalAmount) {
	try {
    	// Get current user and business info
    	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    	if (!currentUser) return;

    	const businessName = currentUser.businessName || 'WebStarNg Store';
    	const businessAddress = currentUser.addressLine1 || '';
    	const businessTel = currentUser.telephone || '';
    	const now = new Date();
    	const dateTime = now.toLocaleString();

    	// Generate receipt number
    	let receiptNumber = parseInt(localStorage.getItem('receipt_counter') || '1000');
    	localStorage.setItem('receipt_counter', (receiptNumber + 1).toString());

    	// Create receipt content optimized for thermal/USB printers
    	let receiptContent = `
        	<!DOCTYPE html>
        	<html>
        	<head>
            	<title>Sales Receipt #${receiptNumber}</title>
            	<meta charset="UTF-8">
            	<style>
                	/* Thermal printer optimized styles - NO PRINT CONTROLS */
                	@media print {
                    	@page {
                        	margin: 0;
                        	size: 80mm auto;
                    	}
                    	body {
                        	margin: 0;
                        	padding: 5mm;
                        	width: 80mm;
                        	font-family: 'Courier New', monospace;
                        	font-size: 10pt;
                        	line-height: 1.2;
                    	}
                	}
               	 
                	body {
                    	font-family: 'Courier New', monospace;
                    	font-size: 10pt;
                    	line-height: 1.2;
                    	width: 80mm;
                    	margin: 0 auto;
                    	padding: 5mm;
                	}
               	 
                	.business-name {
                    	font-weight: bold;
                    	text-align: center;
                    	font-size: 12pt;
                    	margin-bottom: 2mm;
                    	text-transform: uppercase;
                	}
               	 
                	.business-info {
                    	text-align: center;
                    	font-size: 9pt;
                    	margin-bottom: 3mm;
                    	border-bottom: 1px dashed #000;
                    	padding-bottom: 2mm;
                	}
               	 
                	.receipt-header {
                    	text-align: center;
                    	margin-bottom: 3mm;
                	}
               	 
                	.receipt-number {
                    	font-weight: bold;
                    	margin: 2mm 0;
                    	font-size: 11pt;
                	}
               	 
                	.date-time {
                    	margin: 2mm 0;
                    	font-size: 9pt;
                	}
               	 
                	.items-table {
                    	width: 100%;
                    	border-collapse: collapse;
                    	margin: 3mm 0;
                    	font-size: 9pt;
                	}
               	 
                	.items-table th {
                    	border-bottom: 1px solid #000;
                    	padding: 1mm 0;
                    	text-align: left;
                    	font-weight: bold;
                	}
               	 
                	.items-table td {
                    	padding: 1mm 0;
                    	border-bottom: 1px dashed #ccc;
                    	vertical-align: top;
                	}
               	 
                	.total-section {
                    	border-top: 2px solid #000;
                    	margin-top: 3mm;
                    	padding-top: 2mm;
                    	font-weight: bold;
                    	text-align: right;
                    	font-size: 11pt;
                	}
               	 
                	.thank-you {
                    	text-align: center;
                    	margin-top: 4mm;
                    	font-style: italic;
                    	border-top: 1px dashed #000;
                    	padding-top: 2mm;
                	}
               	 
                	.divider {
                    	border-top: 1px dashed #000;
                    	margin: 2mm 0;
                	}
               	 
                	/* Column widths for thermal printer */
                	.col-item { width: 40%; }
                	.col-qty { width: 15%; text-align: center; }
                	.col-price { width: 20%; text-align: right; }
                	.col-total { width: 25%; text-align: right; }
            	</style>
            	<script>
                	// Auto-print function - SILENT VERSION
                	function autoPrint() {
                    	// Wait a moment for content to load
                    	setTimeout(function() {
                        	if (window.print) {
                            	window.print();
                            	// Close immediately after attempting to print
                            	setTimeout(function() {
                                	// This will close the iframe, not the main window
                                	if (window.frameElement) {
                                    	window.frameElement.parentNode.removeChild(window.frameElement);
                                	}
                            	}, 100);
                        	}
                    	}, 300);
                	}
               	 
                	// Trigger auto-print immediately on load
                	window.addEventListener('load', autoPrint);
                	// Also try on DOMContentLoaded in case load event fires too early
                	document.addEventListener('DOMContentLoaded', function() {
                    	setTimeout(autoPrint, 300);
                	});
            	</script>
        	</head>
        	<body>
            	<div class="business-name">${businessName}</div>
            	<div class="business-info">
                	${businessAddress ? `<div>${businessAddress}</div>` : ''}
                	${businessTel ? `<div>Tel: ${businessTel}</div>` : ''}
            	</div>
           	 
            	<div class="receipt-header">
                	<div class="receipt-number">RECEIPT #: ${receiptNumber}</div>
                	<div class="date-time">${dateTime}</div>
            	</div>
           	 
            	<table class="items-table">
                	<thead>
                    	<tr>
                        	<th class="col-item">Item</th>
                        	<th class="col-qty">Qty</th>
                        	<th class="col-price">Price</th>
                        	<th class="col-total">Total</th>
                    	</tr>
                	</thead>
                	<tbody>`;
/*
    	// Add items with proper formatting
    	cartItems.forEach(item => {
        	// Truncate long product names for thermal printer
        	const itemName = item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name;
        	receiptContent += `
                    	<tr>
                        	<td class="col-item">${itemName}</td>
                        	<td class="col-qty">${item.quantity}</td>
                        	<td class="col-price">₦${item.sellingPrice.toFixed(2)}</td>
                        	<td class="col-total">₦${item.subtotal.toFixed(2)}</td>
                    	</tr>`;
    	});
    	*/
    	 // Add all cart items to receipt
        cartItems.forEach((item, index) => {
          	const itemName = item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name;
        
            receiptContent += `
            <tr>
                <td class="item-name">${itemName}</td>
                <td class="item-qty">${item.quantity}</td>
                <td class="item-qty">₦${item.sellingPrice.toFixed(2)}</td>
                <td class="item-price">₦${item.subtotal.toFixed(2)}</td>
            </tr>`;
        });
    	
    	

    	// Add totals and footer
    	receiptContent += `
                	</tbody>
            	</table>
           	 
            	<div class="divider"></div>
           	 
            	<div class="total-section">
                	<div style="font-size: 12pt;">TOTAL: ₦${totalAmount.toFixed(2)}</div>
            	</div>
           	 
            	<div class="divider"></div>
           	 
            	<div class="thank-you">
                	<div>Thank you for your purchase!</div>
                	<div>Please come again!</div>
            	</div>
           	 
            	<div style="text-align: center; margin-top: 3mm; font-size: 8pt; border-top: 1px dashed #ccc; padding-top: 2mm;">
                	*** CUSTOMER COPY ***
            	</div>
        	</body>
        	</html>`;

    	// ======================================================
    	// NEW: CREATE INVISIBLE IFRAME FOR SILENT PRINTING
    	// ======================================================
   	 
    	// Create a completely hidden iframe
    	const iframe = document.createElement('iframe');
   	 
    	// Make it invisible
    	iframe.style.position = 'fixed';
    	iframe.style.width = '0';
    	iframe.style.height = '0';
    	iframe.style.border = 'none';
    	iframe.style.opacity = '0';
    	iframe.style.pointerEvents = 'none';
    	iframe.style.zIndex = '-9999';
    	iframe.style.left = '-9999px';
    	iframe.style.top = '-9999px';
   	 
    	// Append to body
    	document.body.appendChild(iframe);
   	 
    	// Write content to iframe
    	const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    	iframeDoc.open();
    	iframeDoc.write(receiptContent);
    	iframeDoc.close();
   	 
    	// Clean up after printing (remove iframe)
    	const cleanup = () => {
        	setTimeout(() => {
            	if (iframe && iframe.parentNode) {
                	iframe.parentNode.removeChild(iframe);
            	}
        	}, 3000); // Remove after 3 seconds
    	};
   	 
    	// Attach cleanup to iframe's print event
    	iframe.contentWindow.addEventListener('afterprint', cleanup);
   	 
    	// Also cleanup if print dialog is cancelled
    	setTimeout(cleanup, 5000);
   	 
   	 
   	 	//clearCart	New addition 21st Jan
            	this.cart = [];
    	        this.saveCart();
    	        
    	return true;
   	 
	} catch (error) {
    	console.error('Error in silent receipt printing:', error);
   	 
    	// Fallback: Try minimal popup without controls
    	try {
        	// Create a minimal popup that auto-closes
        	const popup = window.open('', '_blank',
            	'width=1,height=1,left=-9999,top=-9999,location=no,menubar=no,toolbar=no,status=no');
       	 
        	if (popup) {
            	popup.document.write(`
                	<html>
                	<head>
                    	<title>Print</title>
                    	<script>
                        	window.onload = function() {
                            	window.print();
                            	setTimeout(function() {
                                	window.close();
                            	}, 100);
                        	};
                    	</script>
                	</head>
                	<body style="display:none;">
                    	Receipt printing...
                	</body>
                	</html>
            	`);
            	popup.document.close();
           	 
            	// Close after a timeout
            	setTimeout(() => {
                	if (popup && !popup.closed) {
                    	popup.close();
                	}
            	}, 1000);
        	}
    	} catch (fallbackError) {
        	console.error('Fallback printing also failed:', fallbackError);
    	}
   	 
    	return false;
	}
	
	

	
	
}


// Add this method to WebStarNgApp class:
async checkProductByBarcode(barcodeValue) {
	try {
    	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    	if (!currentUser) {
        	this.showBarcodeStatus('Please login first', 'error');
        	return null;
    	}

    	// Get inventory and check for existing product
    	const inventoryData = await api.getUserInventory(currentUser.userID);
    	const products = inventoryData.products || [];
   	 
    	// Find product by barcode
    	const existingProduct = products.find(p => p.barcode === barcodeValue);
   	 
    	return existingProduct || null;
	} catch (error) {
    	console.error('Error checking product by barcode:', error);
    	return null;
	}
}


// Update loadExistingProduct() method:
async loadExistingProduct(product) {
	try {
    	// Show mode indicator
    	const modeIndicator = document.getElementById('modeIndicator');
    	if (modeIndicator) {
        	modeIndicator.style.display = 'block';
    	}
   	 
    	// Update form mode
    	document.getElementById('productMode').value = 'edit';
    	document.getElementById('existingProductId').value = product.id;
   	 
    	// Set barcode field value (read-only in edit mode)
    	const barcodeInput = document.getElementById('productBarcode');
    	if (barcodeInput) {
        	barcodeInput.value = product.barcode;
        	barcodeInput.readOnly = true;
        	barcodeInput.style.backgroundColor = '#f8f9fa';
        	barcodeInput.style.cursor = 'not-allowed';
    	}
   	 
    	// Update save button text
    	const saveBtn = document.getElementById('saveProductBtn');
    	if (saveBtn) {
        	saveBtn.innerHTML = '<span class="menu-icon">✏️</span> Update Product';
    	}
   	 
    	// Show new product button
    	const newProductBtn = document.getElementById('newProductBtn');
    	if (newProductBtn) {
        	newProductBtn.style.display = 'inline-block';
    	}
   	 
    	// Populate form fields
    	document.getElementById('productName').value = product.name || '';
    	document.getElementById('productCategory').value = product.category || '';
    	document.getElementById('productCode').value = product.code || '';
    	document.getElementById('brand').value = product.brand || '';
    	document.getElementById('purchasePrice').value = product.purchasePrice || 0;
    	document.getElementById('sellingPrice').value = product.sellingPrice || 0;
    	document.getElementById('quantity').value = product.quantity || 0;
    	document.getElementById('reorderLevel').value = product.reorderLevel || 5;
    	document.getElementById('productDescription').value = product.description || '';
    	document.getElementById('supplier').value = product.supplier || '';
   	 
    	// Optional fields
    	if (document.getElementById('supplierCode')) {
        	document.getElementById('supplierCode').value = product.supplierCode || '';
    	}
    	if (document.getElementById('location')) {
        	document.getElementById('location').value = product.location || '';
    	}
    	if (document.getElementById('expiryDate') && product.expiryDate) {
        	document.getElementById('expiryDate').value = product.expiryDate.split('T')[0];
    	}
    	if (document.getElementById('unit')) {
        	document.getElementById('unit').value = product.unit || 'piece';
    	}
   	 
    	// Update calculated fields
    	this.calculateProfit();
    	this.calculateTotalValue();
   	 
    	// Show success status
    	this.showBarcodeStatus(`✅ Product found: "${product.name}". Form populated for editing.`, 'success');
   	 
    	// Show barcode preview
    	this.showBarcodePreview(product.barcode);
   	 
    	// Focus on product name field
    	setTimeout(() => {
        	document.getElementById('productName')?.focus();
    	}, 300);
   	 
	} catch (error) {
    	console.error('Error loading existing product:', error);
    	this.showBarcodeStatus('Error loading product data', 'error');
	}
}


// Update resetToNewProductMode() method:
resetToNewProductMode() {
	// Reset form mode
	document.getElementById('productMode').value = 'create';
	document.getElementById('existingProductId').value = '';
    
	// Hide mode indicator
	const modeIndicator = document.getElementById('modeIndicator');
	if (modeIndicator) {
    	modeIndicator.style.display = 'none';
	}
    
	// Enable barcode field for new product
	const barcodeInput = document.getElementById('productBarcode');
	if (barcodeInput) {
    	barcodeInput.readOnly = false;
    	barcodeInput.style.backgroundColor = '';
    	barcodeInput.style.cursor = '';
    	barcodeInput.value = ''; // Clear for new entry
    	barcodeInput.focus();
	}
    
	// Reset save button
	const saveBtn = document.getElementById('saveProductBtn');
	if (saveBtn) {
    	saveBtn.innerHTML = '<span class="menu-icon">💾</span> Save Product';
	}
    
	// Hide new product button
	const newProductBtn = document.getElementById('newProductBtn');
	if (newProductBtn) {
    	newProductBtn.style.display = 'none';
	}
    
	// Clear form (except barcode which was already cleared above)
	const form = document.getElementById('newProductForm');
	if (form) {
    	form.reset();
    	// Restore barcode field to editable state
    	if (barcodeInput) {
        	barcodeInput.readOnly = false;
        	barcodeInput.style.backgroundColor = '';
    	}
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
	this.calculateProfit();
	this.calculateTotalValue();
    
	// Hide barcode preview and status
	const preview = document.getElementById('barcodePreview');
	const status = document.getElementById('barcodeStatus');
	if (preview) preview.style.display = 'none';
	if (status) {
    	status.style.display = 'block';
    	status.textContent = '🆕 Creating new product. Enter barcode to check for existing products.';
    	status.style.backgroundColor = '#e3f2fd';
    	status.style.color = '#1565c0';
    	status.style.border = '1px solid #bbdefb';
	}
}



// Add this method to WebStarNgApp class in app.js:
async createSystemUser() {
	// Get form values
	const newUserID = document.getElementById('newSystemUserID').value.trim();
	const newFullName = document.getElementById('newSystemFullName').value.trim();
	const newPassword = document.getElementById('newSystemPassword').value;
	const confirmPassword = document.getElementById('confirmSystemPassword').value;
	const userGroup = parseInt(document.getElementById('newUserGroup').value) || 0;
	const userEmail = document.getElementById('newUserEmail')?.value.trim() || '';
    
	// Get current user (the creator)
	const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
	if (!currentUser) {
    	alert('Please login to create users');
    	return;
	}
    
	// Validate form
	if (!newUserID || !newFullName || !newPassword) {
    	alert('Please fill in all required fields');
    	return;
	}
    
	if (newPassword !== confirmPassword) {
    	alert('Passwords do not match');
    	document.getElementById('confirmSystemPassword').focus();
    	return;
	}
    
	if (newPassword.length < 4) {
    	alert('Password must be at least 4 characters long');
    	document.getElementById('newSystemPassword').focus();
    	return;
	}
    
	// Check user group permissions
	if (userGroup === 3 && currentUser.userGroup !== 3) {
    	alert('Only Administrators can create other Administrators');
    	return;
	}
    
	try {
    	// Disable create button
    	const createBtn = document.getElementById('createUserBtn');
    	if (createBtn) {
        	createBtn.disabled = true;
        	createBtn.innerHTML = '<span class="spinner"></span> Creating User...';
    	}
   	 
    	// Prepare user data
    	const userData = {
        	userID: newUserID,
        	password: newPassword,
        	fullName: newFullName,
        	userGroup: userGroup,
        	email: userEmail || currentUser.email || 'xemail@xmail.com'
    	};
   	 
    	// Create user with inheritance from current user
    	const createdUser = await api.createUser(userData, currentUser);
   	 
    	// Show success message with inheritance details
    	alert(`✅ User "${newFullName}" created successfully!\n\n📋 Inheritance Details:\n• Business: ${createdUser.businessName}\n• Contact: ${createdUser.telephone}\n• Email: ${createdUser.email}\n• User Group: ${this.getUserGroupLabel(userGroup)}\n\nUser can now login with ID: ${newUserID}`);
   	 
    	// Return to setup menu
    	this.loadMenuContent('setup');
   	 
	} catch (error) {
    	console.error('Error creating user:', error);
   	 
    	// Re-enable create button
    	const createBtn = document.getElementById('createUserBtn');
    	if (createBtn) {
        	createBtn.disabled = false;
        	createBtn.innerHTML = '<span class="menu-icon">👤</span> Create User with Inheritance';
    	}
   	 
    	if (error.message.includes('already exists')) {
        	alert(`❌ User ID "${newUserID}" already exists. Please choose a different ID.`);
        	document.getElementById('newSystemUserID').focus();
    	} else {
        	alert(`❌ Error creating user: ${error.message}`);
    	}
	}
}



// Cache inventory data to reduce API calls
async getCachedInventory(userID) {
	const cacheKey = `inventory_cache_${userID}`;
	const cacheTimestampKey = `inventory_cache_timestamp_${userID}`;
    
	const cachedData = localStorage.getItem(cacheKey);
	const cacheTime = localStorage.getItem(cacheTimestampKey);
    
	// Use cache if less than 30 seconds old
	if (cachedData && cacheTime) {
    	const age = Date.now() - parseInt(cacheTime);
    	if (age < 30000) { // 30 seconds
        	return JSON.parse(cachedData);
    	}
	}
    
	// Fetch fresh data
	const inventoryData = await api.getUserInventory(userID);
    
	// Cache the data
	localStorage.setItem(cacheKey, JSON.stringify(inventoryData));
	localStorage.setItem(cacheTimestampKey, Date.now().toString());
    
	return inventoryData;
}

// Clear inventory cache
clearInventoryCache(userID) {
	localStorage.removeItem(`inventory_cache_${userID}`);
	localStorage.removeItem(`inventory_cache_timestamp_${userID}`);
}



// Add data validation method to ensure transactions have user info
validateTransactionData(transaction) {
	// Ensure transaction has required user identification
	if (!transaction.performedBy && !transaction.userID) {
    	console.error('Transaction missing userID:', transaction);
    	return false;
	}
    
	// Ensure transaction has a valid date
	if (!transaction.serverTimestamp && !transaction.timestamp && !transaction.date) {
    	console.error('Transaction missing date:', transaction);
    	return false;
	}
    
	return true;
}



getBackupRestoreForm() {
    return `
        <div class="content-page">
            <h2>💾 Backup & Restore</h2>
            <p>Create backups or restore system data</p>
            
            <div class="utilities-container">
                <!-- Backup Section -->
                <div class="utility-section">
                    <h3><span class="menu-icon">📥</span> Create Backup</h3>
                    <div class="utility-card">
                        <p>Create a complete backup of all your data including:</p>
                        <ul class="feature-list">
                            <li>📦 Inventory data (loading...)</li>
                            <li>💰 Sales transactions</li>
                            <li>🛒 Purchase transactions</li>
                            <li>👤 User accounts</li>
                            <li>🏢 Business settings</li>
                        </ul>
                        
                        <div class="utility-actions">
                            <button class="btn-primary" onclick="app.createBackup()">
                                <span class="menu-icon">💾</span> Create Backup Now
                            </button>
                            <button class="btn-secondary" onclick="app.downloadSampleBackup()">
                                <span class="menu-icon">📋</span> Download Template
                            </button>
                        </div>
                        
                        <div class="form-hint">
                            ⚠️ Backups are stored securely on JSONBin.io servers
                        </div>
                    </div>
                </div>
                
                <!-- Restore Section -->
                <div class="utility-section">
                    <h3><span class="menu-icon">📤</span> Restore Data</h3>
                    <div class="utility-card">
                        <div class="warning-box">
                            <strong>⚠️ Warning:</strong> Restoring will overwrite existing data!
                        </div>
                        
                        <div class="form-group" style="margin-top: 20px;">
                            <label for="backupFile">Select Backup File</label>
                            <input type="file" 
                                   id="backupFile" 
                                   accept=".json,.txt"
                                   class="file-input">
                            <div class="form-hint">
                                Select a previously created backup file (.json format)
                            </div>
                        </div>
                        
                        <div class="utility-actions">
                            <button class="btn-primary" onclick="app.restoreBackup()">
                                <span class="menu-icon">🔄</span> Restore from File
                            </button>
                            <button class="btn-secondary" onclick="app.clearRestoreForm()">
                                <span class="menu-icon">🗑️</span> Clear
                            </button>
                        </div>
                        
                        <div id="restoreStatus" class="status-message" style="display: none; margin-top: 15px;">
                        </div>
                    </div>
                </div>
                
                <!-- Recent Backups -->
                <div class="utility-section">
                    <h3><span class="menu-icon">📅</span> Recent Backups</h3>
                    <div class="utility-card">
                        <div id="backupList">
                            <div class="loading-state">
                                <span class="spinner"></span>
                                <p>Loading backups...</p>
                            </div>
                        </div>
                        <div class="utility-actions">
                            <button class="btn-secondary" onclick="app.refreshBackupList()">
                                <span class="menu-icon">🔄</span> Refresh List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

getSystemCleanupForm() {
    return `
        <div class="content-page">
            <h2>🧹 System CleanUp</h2>
            <p class="warning-text">⚠️ Admin Only: Clean up old transaction data</p>
            
            <div class="utilities-container">
                <!-- Sales Cleanup -->
                <div class="utility-section">
                    <h3><span class="menu-icon">💰</span> Sales Transactions</h3>
                    <div class="utility-card">
                        <div class="stats-display">
                            <div class="stat-item">
                                <span class="stat-label">Total Transactions:</span>
                                <span class="stat-value" id="totalSalesCount">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Old Transactions:</span>
                                <span class="stat-value" id="oldSalesCount">0</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="salesAge">Delete sales older than:</label>
                            <select id="salesAge" class="cleanup-select">
                                <option value="30">30 days</option>
                                <option value="90">90 days</option>
                                <option value="180">180 days</option>
                                <option value="365">1 year</option>
                            </select>
                        </div>
                        
                        <div class="utility-actions">
                            <button class="btn-warning" onclick="app.cleanupOldSales()">
                                <span class="menu-icon">🧹</span> Clean Up Sales
                            </button>
                            <button class="btn-secondary" onclick="app.previewSalesCleanup()">
                                <span class="menu-icon">👁️</span> Preview
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Purchases Cleanup -->
                <div class="utility-section">
                    <h3><span class="menu-icon">🛒</span> Purchase Transactions</h3>
                    <div class="utility-card">
                        <div class="stats-display">
                            <div class="stat-item">
                                <span class="stat-label">Total Transactions:</span>
                                <span class="stat-value" id="totalPurchasesCount">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Old Transactions:</span>
                                <span class="stat-value" id="oldPurchasesCount">0</span>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="purchasesAge">Delete purchases older than:</label>
                            <select id="purchasesAge" class="cleanup-select">
                                <option value="30">30 days</option>
                                <option value="90">90 days</option>
                                <option value="180">180 days</option>
                                <option value="365">1 year</option>
                            </select>
                        </div>
                        
                        <div class="utility-actions">
                            <button class="btn-warning" onclick="app.cleanupOldPurchases()">
                                <span class="menu-icon">🧹</span> Clean Up Purchases
                            </button>
                            <button class="btn-secondary" onclick="app.previewPurchasesCleanup()">
                                <span class="menu-icon">👁️</span> Preview
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Bulk Cleanup -->
                <div class="utility-section">
                    <h3><span class="menu-icon">⚡</span> Bulk Cleanup</h3>
                    <div class="utility-card danger-card">
                        <div class="danger-warning">
                            <strong>⚠️ DANGER ZONE:</strong> This will permanently delete data!
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="confirmBulkCleanup">
                                I understand this action cannot be undone
                            </label>
                        </div>
                        
                        <div class="utility-actions">
                            <button class="btn-danger" id="bulkCleanupBtn" disabled onclick="app.bulkCleanup()">
                                <span class="menu-icon">💥</span> Bulk Cleanup All Old Data
                            </button>
                        </div>
                        
                        <div class="form-hint">
                            This will clean BOTH sales and purchases older than selected age
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

getWalletAdminForm() {
    return `
        <div class="content-page">
            <h2>💰 Wallet Administration</h2>
            <p class="admin-text">👑 Admin Only: Manage all user wallet balances</p>
            
            <div class="utilities-container">
                <!-- User List -->
                <div class="utility-section">
                    <h3><span class="menu-icon">👥</span> All Users</h3>
                    <div class="utility-card">
                        <div class="search-bar">
                            <input type="text" 
                                   id="userSearch" 
                                   placeholder="Search by User ID, Name, or Email..."
                                   class="search-input">
                            <button class="btn-primary" onclick="app.searchUsers()">
                                <span class="menu-icon">🔍</span> Search
                            </button>
                        </div>
                        
                        <div class="users-list-container">
                            <div class="users-list-header">
                                <span>Total Users: <span id="totalUsersCount">0</span></span>
                                <span>Total Wallet Value: <span id="totalWalletValue">₦0.00</span></span>
                            </div>
                            <div class="users-list" id="usersList">
                                <div class="loading-state">
                                    <span class="spinner"></span>
                                    <p>Loading users...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Wallet Management -->
                <div class="utility-section">
                    <h3><span class="menu-icon">💰</span> Wallet Management</h3>
                    <div class="utility-card">
                        <div id="selectedUserInfo" style="display: none;">
                            <h4>Selected User</h4>
                            <div class="selected-user-card">
                                <div class="user-identity">
                                    <div class="user-id-display" id="selectedUserName"></div>
                                    <div class="user-group-display" id="selectedUserGroup"></div>
                                </div>
                                <div class="user-wallet-display">
                                    <div class="wallet-label">Current Balance:</div>
                                    <div class="wallet-amount-large" id="selectedUserBalance">₦0.00</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="wallet-form">
                            <div class="form-group">
                                <label for="walletAction">Action:</label>
                                <select id="walletAction" class="wallet-select">
                                    <option value="">Select Action</option>
                                    <option value="add">➕ Add Funds</option>
                                    <option value="deduct">➖ Deduct Funds</option>
                                    <option value="set">🔧 Set Balance</option>
                                    <option value="reset">🔄 Reset to Zero</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="walletAmount">Amount (₦):</label>
                                <input type="number" 
                                       id="walletAmount" 
                                       min="0" 
                                       step="0.01"
                                       placeholder="Enter amount"
                                       class="wallet-input"
                                       disabled>
                                <div class="form-hint">Required for Add, Deduct, and Set actions</div>
                            </div>
                            
                            <div class="form-group">
                                <label for="walletReason">Reason:</label>
                                <input type="text" 
                                       id="walletReason" 
                                       placeholder="e.g., Bonus, Correction, Refund, Adjustment"
                                       class="reason-input">
                                <div class="form-hint">Reason for this adjustment (optional but recommended)</div>
                            </div>
                            
                            <div class="utility-actions">
                                <button class="btn-primary" id="executeWalletAction" disabled onclick="app.executeWalletAction()">
                                    <span class="menu-icon">✅</span> Execute Action
                                </button>
                                <button class="btn-secondary" onclick="app.clearWalletForm()">
                                    <span class="menu-icon">🗑️</span> Clear Form
                                </button>
                            </div>
                        </div>
                        
                        <div id="walletActionStatus" class="wallet-status" style="display: none; margin-top: 15px;">
                        </div>
                    </div>
                </div>
                
                <!-- Adjustment History -->
                <div class="utility-section">
                    <h3><span class="menu-icon">📋</span> Your Adjustment History</h3>
                    <div class="utility-card">
                        <div class="adjustments-container">
                            <div class="adjustments-header">
                                <span>Total Adjustments Made: <span id="totalAdjustmentsCount">0</span></span>
                                <button class="btn-small" onclick="app.exportAdminAdjustments()">
                                    📥 Export All
                                </button>
                            </div>
                            <div class="adjustments-list" id="adjustmentsList">
                                <div class="loading-state">
                                    <span class="spinner"></span>
                                    <p>Loading adjustment history...</p>
                                </div>
                            </div>
                            <div class="adjustments-footer">
                                <button class="btn-secondary" onclick="app.refreshAdjustments()">
                                    <span class="menu-icon">🔄</span> Refresh List
                                </button>
                                <button class="btn-small" onclick="app.printAllAdjustments()">
                                    🖨️ Print Summary
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}


// Backup/Restore Methods
async createBackup() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            alert('Please login to create backups');
            return;
        }
        
        // Ask for backup name
        const backupName = prompt('Enter a name for this backup (optional):', 
                                 `Backup_${new Date().toLocaleDateString()}`);
        
        if (backupName === null) return; // User cancelled
        
        // Show loading
        this.showBackupStatus('Creating backup... Please wait.', 'loading');
        
        // Create backup
        const result = await api.createBackup(currentUser.userID, backupName);
        
        if (result.success) {
            this.showBackupStatus(`
                <div class="success-message">
                    <div class="success-icon">✅</div>
                    <div class="success-content">
                        <h4>Backup Created Successfully!</h4>
                        <p>Backup ID: <code>${result.backupBinId.substring(0, 12)}...</code></p>
                        <p>Name: ${result.backupRecord.backupName}</p>
                        <p>Time: ${new Date(result.backupRecord.timestamp).toLocaleString()}</p>
                        <div class="backup-stats">
                            <span>📦 Products: ${result.backupRecord.productCount}</span>
                            <span>💰 Sales: ${result.backupRecord.salesCount}</span>
                            <span>🛒 Purchases: ${result.backupRecord.purchasesCount}</span>
                        </div>
                    </div>
                </div>
            `, 'success');
            
            // Refresh backup list
            this.loadBackupList();
            
        } else {
            throw new Error('Backup creation failed');
        }
        
    } catch (error) {
        console.error('Error creating backup:', error);
        this.showBackupStatus(`
            <div class="error-message">
                <div class="error-icon">❌</div>
                <div class="error-content">
                    <h4>Backup Failed</h4>
                    <p>${error.message}</p>
                    <p>Please check your internet connection and try again.</p>
                </div>
            </div>
        `, 'error');
    }
}

async downloadSampleBackup() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) return;
        
        // Create sample backup structure
        const sampleBackup = {
            metadata: {
                backupId: `sample_${Date.now()}`,
                backupName: "Sample Backup Template",
                createdBy: currentUser.userID,
                timestamp: new Date().toISOString(),
                version: '1.0',
                system: 'WebStarNg',
                type: 'template'
            },
            instructions: {
                title: "WebStarNg Backup Template",
                description: "This is a sample backup template. Fill in your data following this structure.",
                usage: "Use this template to create manual backups or to understand the data structure."
            },
            dataStructure: {
                mainData: {
                    users: [
                        {
                            userID: "example_user",
                            fullName: "Example User",
                            wallet: 1000.00,
                            userGroup: 1,
                            businessName: "Example Business"
                        }
                    ]
                },
                userData: {
                    inventory: {
                        products: [
                            {
                                id: "prod_1",
                                barcode: "EXAMPLE001",
                                name: "Example Product",
                                category: "example",
                                quantity: 10,
                                sellingPrice: 100.00
                            }
                        ]
                    },
                    sales: {
                        transactions: [
                            {
                                id: "sale_1",
                                productName: "Example Product",
                                amount: 100.00,
                                timestamp: new Date().toISOString()
                            }
                        ]
                    },
                    purchases: {
                        transactions: [
                            {
                                id: "purch_1",
                                productName: "Example Product",
                                amount: 50.00,
                                timestamp: new Date().toISOString()
                            }
                        ]
                    }
                }
            }
        };
        
        // Convert to JSON and download
        const jsonStr = JSON.stringify(sampleBackup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `webstarng_backup_template_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        this.showBackupStatus(`
            <div class="success-message">
                <div class="success-icon">📋</div>
                <div class="success-content">
                    <h4>Template Downloaded!</h4>
                    <p>Sample backup template has been downloaded.</p>
                    <p>Check the JSON structure for creating manual backups.</p>
                </div>
            </div>
        `, 'success');
        
    } catch (error) {
        console.error('Error downloading sample backup:', error);
        this.showBackupStatus('Error downloading template', 'error');
    }
}

handleBackupFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backupData = JSON.parse(e.target.result);
            
            // Validate backup file
            if (!backupData.metadata || !backupData.metadata.system === 'WebStarNg') {
                throw new Error('Invalid backup file format');
            }
            
            // Store the backup data temporarily
            this.selectedBackupFile = {
                data: backupData,
                name: file.name,
                size: file.size,
                lastModified: file.lastModified
            };
            
            this.showBackupStatus(`
                <div class="info-message">
                    <div class="info-icon">📄</div>
                    <div class="info-content">
                        <h4>Backup File Ready</h4>
                        <p><strong>File:</strong> ${file.name}</p>
                        <p><strong>Size:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                        <p><strong>Created:</strong> ${backupData.metadata.timestamp ? 
                            new Date(backupData.metadata.timestamp).toLocaleString() : 'Unknown'}</p>
                        <p><strong>Backup Name:</strong> ${backupData.metadata.backupName || 'Unnamed'}</p>
                    </div>
                </div>
            `, 'info');
            
        } catch (error) {
            console.error('Error parsing backup file:', error);
            this.showBackupStatus(`
                <div class="error-message">
                    <div class="error-icon">❌</div>
                    <div class="error-content">
                        <h4>Invalid Backup File</h4>
                        <p>The selected file is not a valid WebStarNg backup file.</p>
                        <p>Error: ${error.message}</p>
                    </div>
                </div>
            `, 'error');
            
            // Clear the file input
            event.target.value = '';
        }
    };
    
    reader.onerror = () => {
        this.showBackupStatus('Error reading file', 'error');
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

async restoreBackup() {
    if (!this.selectedBackupFile) {
        alert('Please select a backup file first');
        return;
    }
    
    const backupData = this.selectedBackupFile.data;
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    
    if (!currentUser) {
        alert('Please login to restore backup');
        return;
    }
    
    // Show confirmation with details
    const confirmMessage = `
        🚨 RESTORE CONFIRMATION 🚨
        
        You are about to restore from backup:
        
        📁 Backup: ${backupData.metadata.backupName}
        📅 Created: ${new Date(backupData.metadata.timestamp).toLocaleString()}
        👤 By: ${backupData.metadata.createdBy}
        
        ⚠️ WARNING: This will overwrite existing data!
        
        Type "RESTORE" to confirm:
    `;
    
    const userConfirmation = prompt(confirmMessage);
    
    if (userConfirmation !== 'RESTORE') {
        alert('Restore cancelled');
        return;
    }
    
    try {
        this.showBackupStatus('Restoring data... This may take a moment.', 'loading');
        
        // Check if user is admin for full restore
        const isAdmin = currentUser.userGroup >= 3;
        
        if (isAdmin) {
            // For admin - full system restore
            const result = await this.performFullRestore(backupData, currentUser);
            this.showRestoreResult(result);
        } else {
            // For regular user - user data only restore
            const result = await this.performUserRestore(backupData, currentUser);
            this.showRestoreResult(result);
        }
        
    } catch (error) {
        console.error('Error during restore:', error);
        this.showBackupStatus(`
            <div class="error-message">
                <div class="error-icon">❌</div>
                <div class="error-content">
                    <h4>Restore Failed</h4>
                    <p>${error.message}</p>
                    <p>Please check the backup file and try again.</p>
                </div>
            </div>
        `, 'error');
    }
}

async performFullRestore(backupData, currentUser) {
    // Validate admin access
    if (currentUser.userGroup < 3) {
        throw new Error('Admin privileges required for full system restore');
    }
    
    // Step 1: Create a backup before restore (safety measure)
    const safetyBackup = await api.createBackup(currentUser.userID, 'Pre-restore_safety_backup');
    
    try {
        // Step 2: Restore main data
        if (backupData.mainData) {
            await api.updateData(backupData.mainData);
        }
        
        // Step 3: Restore all users' data
        if (backupData.mainData && backupData.mainData.users) {
            for (const user of backupData.mainData.users) {
                if (backupData.userData && backupData.userData[user.userID]) {
                    const userData = backupData.userData[user.userID];
                    
                    if (userData.inventory) {
                        await api.updateUserInventory(user.userID, userData.inventory);
                    }
                    
                    if (userData.sales) {
                        await api.updateUserSalesBin(user.userID, userData.sales);
                    }
                    
                    if (userData.purchases) {
                        const purchasesBin = await api.getUserPurchases(user.userID);
                        purchasesBin.transactions = userData.purchases.transactions || [];
                        purchasesBin.totalPurchases = userData.purchases.totalPurchases || 0;
                        await api.updateUserInventoryBatch(user.userID, purchasesBin);
                    }
                }
            }
        }
        
        // Update current user session
        const updatedUser = await api.getUser(currentUser.userID);
        localStorage.setItem('webstarng_user', JSON.stringify(updatedUser));
        
        return {
            success: true,
            type: 'full',
            safetyBackupId: safetyBackup.backupBinId,
            message: 'Full system restore completed successfully',
            stats: {
                users: backupData.mainData?.users?.length || 0,
                products: this.countTotalProducts(backupData),
                sales: this.countTotalSales(backupData),
                purchases: this.countTotalPurchases(backupData)
            }
        };
        
    } catch (error) {
        // Attempt to restore from safety backup
        console.error('Restore failed, attempting safety restore:', error);
        try {
            await api.restoreFromBackup(currentUser.userID, safetyBackup.backupBinId);
            throw new Error(`Restore failed. System reverted to safety backup. Original error: ${error.message}`);
        } catch (safetyError) {
            throw new Error(`Critical restore failure. Contact support. Errors: ${error.message}, ${safetyError.message}`);
        }
    }
}

async performUserRestore(backupData, currentUser) {
    // Validate user data exists in backup
    if (!backupData.userData || !backupData.userData[currentUser.userID]) {
        throw new Error('Your user data not found in this backup');
    }
    
    const userData = backupData.userData[currentUser.userID];
    
    // Create safety backup
    const safetyBackup = await api.createBackup(currentUser.userID, 'Pre-user-restore_safety');
    
    try {
        // Restore user data
        if (userData.inventory) {
            await api.updateUserInventory(currentUser.userID, userData.inventory);
        }
        
        if (userData.sales) {
            await api.updateUserSalesBin(currentUser.userID, userData.sales);
        }
        
        if (userData.purchases) {
            const purchasesBin = await api.getUserPurchases(currentUser.userID);
            purchasesBin.transactions = userData.purchases.transactions || [];
            purchasesBin.totalPurchases = userData.purchases.totalPurchases || 0;
            await api.updateUserInventoryBatch(currentUser.userID, purchasesBin);
        }
        
        // Update user info if present
        if (userData.userInfo) {
            await api.updateUser(currentUser.userID, {
                ...userData.userInfo,
                lastRestore: new Date().toISOString()
            });
        }
        
        // Refresh session
        const updatedUser = await api.getUser(currentUser.userID);
        localStorage.setItem('webstarng_user', JSON.stringify(updatedUser));
        
        return {
            success: true,
            type: 'user',
            safetyBackupId: safetyBackup.backupBinId,
            message: 'User data restored successfully',
            stats: {
                products: userData.inventory?.products?.length || 0,
                sales: userData.sales?.transactions?.length || 0,
                purchases: userData.purchases?.transactions?.length || 0
            }
        };
        
    } catch (error) {
        // Restore from safety backup
        console.error('User restore failed, reverting:', error);
        try {
            await api.restoreFromBackup(currentUser.userID, safetyBackup.backupBinId);
            throw new Error(`Restore failed. Reverted to safety backup. Error: ${error.message}`);
        } catch (safetyError) {
            throw new Error(`Critical restore failure. Please contact support.`);
        }
    }
}

showRestoreResult(result) {
    if (result.success) {
        this.showBackupStatus(`
            <div class="success-message">
                <div class="success-icon">✅</div>
                <div class="success-content">
                    <h4>Restore Completed Successfully!</h4>
                    <p><strong>Type:</strong> ${result.type === 'full' ? 'Full System Restore' : 'User Data Restore'}</p>
                    
                    ${result.stats ? `
                    <div class="restore-stats">
                        ${result.stats.users ? `<span>👥 Users: ${result.stats.users}</span>` : ''}
                        ${result.stats.products ? `<span>📦 Products: ${result.stats.products}</span>` : ''}
                        ${result.stats.sales ? `<span>💰 Sales: ${result.stats.sales}</span>` : ''}
                        ${result.stats.purchases ? `<span>🛒 Purchases: ${result.stats.purchases}</span>` : ''}
                    </div>
                    ` : ''}
                    
                    ${result.safetyBackupId ? `
                    <div class="safety-note">
                        <small>Safety backup created: ${result.safetyBackupId.substring(0, 12)}...</small>
                    </div>
                    ` : ''}
                    
                    <div class="restore-actions">
                        <button class="btn-primary" onclick="app.reloadDashboard()">
                            🔄 Reload Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `, 'success');
        
        // Clear selected file
        this.selectedBackupFile = null;
        const fileInput = document.getElementById('backupFile');
        if (fileInput) fileInput.value = '';
        
    } else {
        throw new Error(result.message || 'Restore failed');
    }
}

async loadBackupList() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) return;
        
        const backups = await api.getUserBackups(currentUser.userID);
        const backupList = document.getElementById('backupList');
        
        if (!backupList) return;
        
        if (backups.length === 0) {
            backupList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">💾</span>
                    <p>No backups created yet</p>
                    <p class="hint">Create your first backup to see it here</p>
                </div>
            `;
            return;
        }
        
        // Sort by timestamp (newest first)
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        backupList.innerHTML = `
            <div class="backups-table">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Date</th>
                            <th>Size</th>
                            <th>Data</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${backups.map(backup => `
                            <tr class="backup-item" data-backup-id="${backup.backupId}">
                                <td>
                                    <strong>${backup.backupName}</strong>
                                    <div class="backup-id">${backup.backupId.substring(0, 12)}...</div>
                                </td>
                                <td>${new Date(backup.timestamp).toLocaleString()}</td>
                                <td>${(backup.size / 1024).toFixed(2)} KB</td>
                                <td>
                                    <div class="backup-stats-small">
                                        ${backup.productCount ? `<span title="Products">📦 ${backup.productCount}</span>` : ''}
                                        ${backup.salesCount ? `<span title="Sales">💰 ${backup.salesCount}</span>` : ''}
                                        ${backup.purchasesCount ? `<span title="Purchases">🛒 ${backup.purchasesCount}</span>` : ''}
                                    </div>
                                </td>
                                <td>
                                    <div class="backup-actions">
                                        <button class="btn-small" onclick="app.downloadBackup('${backup.backupId}')" title="Download">
                                            📥
                                        </button>
                                        <button class="btn-small" onclick="app.restoreFromBackupId('${backup.backupId}')" title="Restore">
                                            🔄
                                        </button>
                                        <button class="btn-small btn-danger" onclick="app.deleteBackup('${backup.backupId}')" title="Delete">
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading backup list:', error);
        const backupList = document.getElementById('backupList');
        if (backupList) {
            backupList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">❌</span>
                    <p>Error loading backups</p>
                    <button class="btn-small" onclick="app.loadBackupList()">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

async downloadBackup(backupBinId) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) return;
        
        this.showBackupStatus('Downloading backup...', 'loading');
        
        const backupData = await api.downloadBackupFile(backupBinId);
        
        // Convert to JSON string
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create filename
        const backupName = backupData.metadata?.backupName || `backup_${new Date().toISOString().split('T')[0]}`;
        const filename = `webstarng_backup_${backupName.replace(/\s+/g, '_')}.json`;
        
        // Download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        this.showBackupStatus(`
            <div class="success-message">
                <div class="success-icon">✅</div>
                <div class="success-content">
                    <h4>Backup Downloaded!</h4>
                    <p>Backup saved as: <code>${filename}</code></p>
                    <p>Keep this file in a safe location.</p>
                </div>
            </div>
        `, 'success');
        
    } catch (error) {
        console.error('Error downloading backup:', error);
        this.showBackupStatus(`
            <div class="error-message">
                <div class="error-icon">❌</div>
                <div class="error-content">
                    <h4>Download Failed</h4>
                    <p>${error.message}</p>
                </div>
            </div>
        `, 'error');
    }
}

async restoreFromBackupId(backupBinId) {
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    if (!currentUser) return;
    
    // Get backup details first
    try {
        const backupData = await api.downloadBackupFile(backupBinId);
        
        const confirmMessage = `
            🔄 RESTORE FROM BACKUP
            
            Backup: ${backupData.metadata?.backupName || 'Unknown'}
            Created: ${backupData.metadata?.timestamp ? 
                new Date(backupData.metadata.timestamp).toLocaleString() : 'Unknown'}
            By: ${backupData.metadata?.createdBy || 'Unknown'}
            
            ⚠️ This will overwrite current data!
            
            Type "YES" to confirm restore:
        `;
        
        const userConfirmation = prompt(confirmMessage);
        
        if (userConfirmation !== 'YES') {
            alert('Restore cancelled');
            return;
        }
        
        this.showBackupStatus('Restoring from backup...', 'loading');
        
        const result = await api.restoreFromBackup(currentUser.userID, backupBinId);
        
        if (result.success) {
            this.showBackupStatus(`
                <div class="success-message">
                    <div class="success-icon">✅</div>
                    <div class="success-content">
                        <h4>Restore Completed!</h4>
                        <p>${result.message}</p>
                        <div class="restore-actions">
                            <button class="btn-primary" onclick="app.reloadDashboard()">
                                🔄 Reload Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            `, 'success');
            
            // Refresh backup list
            this.loadBackupList();
        } else {
            throw new Error(result.message || 'Restore failed');
        }
        
    } catch (error) {
        console.error('Error restoring from backup ID:', error);
        this.showBackupStatus(`
            <div class="error-message">
                <div class="error-icon">❌</div>
                <div class="error-content">
                    <h4>Restore Failed</h4>
                    <p>${error.message}</p>
                </div>
            </div>
        `, 'error');
    }
}

async deleteBackup(backupBinId) {
    if (!confirm('Are you sure you want to delete this backup?\n\nThis action cannot be undone.')) {
        return;
    }
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) return;
        
        this.showBackupStatus('Deleting backup...', 'loading');
        
        const result = await api.deleteBackup(currentUser.userID, backupBinId);
        
        if (result.success) {
            this.showBackupStatus(`
                <div class="success-message">
                    <div class="success-icon">✅</div>
                    <div class="success-content">
                        <h4>Backup Deleted</h4>
                        <p>Backup has been permanently deleted.</p>
                    </div>
                </div>
            `, 'success');
            
            // Refresh backup list
            this.loadBackupList();
        } else {
            throw new Error(result.message || 'Delete failed');
        }
        
    } catch (error) {
        console.error('Error deleting backup:', error);
        this.showBackupStatus(`
            <div class="error-message">
                <div class="error-icon">❌</div>
                <div class="error-content">
                    <h4>Delete Failed</h4>
                    <p>${error.message}</p>
                </div>
            </div>
        `, 'error');
    }
}

showBackupStatus(message, type = 'info') {
    const statusElement = document.getElementById('restoreStatus');
    if (!statusElement) return;
    
    statusElement.innerHTML = message;
    statusElement.style.display = 'block';
    
    // Set styling based on type
    switch(type) {
        case 'success':
            statusElement.className = 'status-message success';
            break;
        case 'error':
            statusElement.className = 'status-message error';
            break;
        case 'loading':
            statusElement.className = 'status-message loading';
            statusElement.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            break;
        case 'info':
            statusElement.className = 'status-message info';
            break;
    }
}

clearRestoreForm() {
    this.selectedBackupFile = null;
    
    const fileInput = document.getElementById('backupFile');
    if (fileInput) fileInput.value = '';
    
    const statusElement = document.getElementById('restoreStatus');
    if (statusElement) {
        statusElement.style.display = 'none';
        statusElement.innerHTML = '';
    }
}

refreshBackupList() {
    this.loadBackupList();
}

reloadDashboard() {
    location.reload();
}

// Helper methods for counting data
countTotalProducts(backupData) {
    let count = 0;
    if (backupData.userData) {
        for (const userID in backupData.userData) {
            count += backupData.userData[userID]?.inventory?.products?.length || 0;
        }
    }
    return count;
}

countTotalSales(backupData) {
    let count = 0;
    if (backupData.userData) {
        for (const userID in backupData.userData) {
            count += backupData.userData[userID]?.sales?.transactions?.length || 0;
        }
    }
    return count;
}

countTotalPurchases(backupData) {
    let count = 0;
    if (backupData.userData) {
        for (const userID in backupData.userData) {
            count += backupData.userData[userID]?.purchases?.transactions?.length || 0;
        }
    }
    return count;
}

// Initialize backup list when Backup/Restore form loads
async initBackupRestore() {
    await this.loadBackupList();
    
    // Also load current user stats
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    if (currentUser) {
        try {
            const inventoryData = await api.getUserInventory(currentUser.userID);
            const productCount = inventoryData.products?.length || 0;
            
            // Update the feature list with actual count
            const featureList = document.querySelector('.feature-list li:nth-child(1)');
            if (featureList) {
                featureList.innerHTML = `📦 Inventory data (${productCount} products)`;
            }
        } catch (error) {
            console.error('Error loading inventory stats:', error);
        }
    }
}



async searchUsers() {
    try {
        console.log('Starting user search...');
        
        const searchInput = document.getElementById('userSearch');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        
        const usersList = document.getElementById('usersList');
        if (!usersList) {
            console.error('usersList element not found');
            return;
        }
        
        // Show loading state
        usersList.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading users...</p>
            </div>
        `;
        
        // Get current user for comparison
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            usersList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">🔒</span>
                    <p>Please login to view users</p>
                </div>
            `;
            return;
        }
        
        console.log(`Current user: ${currentUser.userID}, Search term: "${searchTerm}"`);
        
        // Add small delay to prevent rapid API calls
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get users from API
        let users = [];
        try {
            users = await api.searchUsers(searchTerm);
            console.log(`API returned ${users.length} users`);
        } catch (apiError) {
            console.error('API error:', apiError);
            usersList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">❌</span>
                    <p>Error connecting to server</p>
                    <button class="btn-small" onclick="app.searchUsers()">
                        Retry
                    </button>
                </div>
            `;
            return;
        }
        
        // Update user counts display
        const totalUsersCount = document.getElementById('totalUsersCount');
        const totalWalletValue = document.getElementById('totalWalletValue');
        
        if (totalUsersCount) {
            totalUsersCount.textContent = users.length;
        }
        
        if (totalWalletValue) {
            const totalValue = users.reduce((sum, user) => sum + (parseFloat(user.wallet) || 0), 0);
            totalWalletValue.textContent = `₦${totalValue.toFixed(2)}`;
        }
        
        // Handle empty results
        if (users.length === 0) {
            usersList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">👤</span>
                    <p>No users found</p>
                    ${searchTerm ? `<p class="hint">No results for "${searchTerm}"</p>` : ''}
                    <button class="btn-small" onclick="app.searchUsers()" style="margin-top: 10px;">
                        Refresh
                    </button>
                </div>
            `;
            return;
        }
        
        // Sort users: current user first, then admins, then by userID
        users.sort((a, b) => {
            // Current user first
            if (a.userID === currentUser.userID) return -1;
            if (b.userID === currentUser.userID) return 1;
            
            // Admins first
            if (a.userGroup !== b.userGroup) {
                return (b.userGroup || 0) - (a.userGroup || 0);
            }
            
            // Alphabetical by userID
            return (a.userID || '').localeCompare(b.userID || '');
        });
        
        console.log(`Rendering ${users.length} users`);
        
        // Render users
        usersList.innerHTML = users.map((user, index) => {
            const isCurrentUser = user.userID === currentUser.userID;
            const isSelected = this.selectedUserForWalletAdmin?.userID === user.userID;
            const userGroup = parseInt(user.userGroup) || 0;
            const userGroupLabel = this.getUserGroupLabel(userGroup);
            const userGroupClass = `group-${userGroup}`;
            const walletAmount = parseFloat(user.wallet) || 0;
            
            // Determine wallet color based on amount
            let walletColorClass = 'wallet-normal';
            if (walletAmount === 0) {
                walletColorClass = 'wallet-zero';
            } else if (walletAmount > 10000) {
                walletColorClass = 'wallet-high';
            }
            
            return `
                <div class="user-item ${isSelected ? 'selected' : ''} ${isCurrentUser ? 'current-user' : ''}" 
                     onclick="app.selectUserForWalletAdmin('${user.userID}')"
                     data-user-id="${user.userID}"
                     data-index="${index}">
                    <div class="user-header">
                        <div class="user-id">${user.userID}</div>
                        ${isCurrentUser ? '<span class="current-badge">(You)</span>' : ''}
                        <span class="user-group-badge ${userGroupClass}">${userGroupLabel}</span>
                    </div>
                    <div class="user-details">
                        <div class="user-name">${user.fullName || 'No name provided'}</div>
                        <div class="user-wallet ${walletColorClass}">
                            <span class="wallet-label">Balance:</span>
                            <span class="wallet-amount">₦${walletAmount.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="user-meta">
                        ${user.businessName ? `<span class="meta-item">🏢 ${user.businessName}</span>` : ''}
                        ${user.email ? `<span class="meta-item">📧 ${user.email}</span>` : ''}
                        ${user.lastLogin ? `
                            <span class="meta-item" title="Last login">
                                ⏰ ${new Date(user.lastLogin).toLocaleDateString()}
                            </span>
                        ` : ''}
                        ${user.createdAt ? `
                            <span class="meta-item" title="Created">
                                📅 ${new Date(user.createdAt).toLocaleDateString()}
                            </span>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('User search completed successfully');
        
    } catch (error) {
        console.error('Error in searchUsers:', error);
        const usersList = document.getElementById('usersList');
        if (usersList) {
            usersList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">❌</span>
                    <div class="error-content">
                        <p><strong>Error loading users</strong></p>
                        <p>${error.message || 'Unknown error'}</p>
                        <p class="hint">Please check your connection and try again.</p>
                    </div>
                    <button class="btn-primary" onclick="app.searchUsers()" style="margin-top: 10px;">
                        🔄 Retry
                    </button>
                    <button class="btn-secondary" onclick="app.debugUserData()" style="margin-top: 5px;">
                        🐛 Debug
                    </button>
                </div>
            `;
        }
    }
}

// Add a debug method to help troubleshoot
async debugUserData() {
    try {
        console.log('=== DEBUG USER DATA ===');
        
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        console.log('Current user from localStorage:', currentUser);
        
        // Test API connectivity
        console.log('Testing API connectivity...');
        const testData = await api.getData();
        console.log('Total users in system:', testData.users?.length || 0);
        
        if (testData.users && testData.users.length > 0) {
            console.log('Sample users:');
            testData.users.slice(0, 3).forEach((user, i) => {
                console.log(`  ${i+1}. ${user.userID} - ${user.fullName} (Group: ${user.userGroup})`);
            });
        }
        
        // Test searchUsers directly
        console.log('Testing searchUsers API...');
        const searchResults = await api.searchUsers('');
        console.log(`searchUsers('') returned: ${searchResults.length} users`);
        
        alert(`Debug complete. Check console for details.\n\nTotal users: ${testData.users?.length || 0}\nAPI working: ${searchResults.length >= 0 ? 'Yes' : 'No'}`);
        
    } catch (error) {
        console.error('Debug error:', error);
        alert(`Debug failed: ${error.message}`);
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

// Add global functions for onclick events
window.clearPurchaseForm = function() {
    if (app) {
   	 app.clearPurchaseForm();
    }
};

window.calculatePurchaseTotal = function() {
    if (app) {
   	 app.calculatePurchaseTotal();
    }
};


