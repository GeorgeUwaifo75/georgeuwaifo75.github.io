// app.js
let pendingProductData = null; // Store product data while processing payment


// Debounce function to prevent rapid successive calls
function debounce(func, wait) {
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

// ============ EMAILJS INTEGRATION ============

// Initialize EmailJS (call this once when app starts)
function initializeEmailJS() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY);
        console.log('✅ EmailJS initialized successfully');
    } else {
        console.error('❌ EmailJS library not loaded');
    }
}

// Function to send email alert to merchant
async function sendChatAlertEmail(chatData) {
    try {
        // Check if EmailJS is available
        if (typeof emailjs === 'undefined') {
            console.error('EmailJS not available');
            return false;
        }

        // Get seller details
        const seller = await api.getUserByUserId(chatData.sellerId);
        if (!seller || !seller.email) {
            console.error('Seller email not found');
            return false;
        }

        // Prepare template parameters
        const templateParams = {
            to_name: seller.firstName || 'Merchant',
            from_name: chatData.buyerName || 'A potential buyer',
            product_name: chatData.productName,
            message_preview: chatData.message.substring(0, 100) + (chatData.message.length > 100 ? '...' : ''),
            product_link: `${window.location.origin}/#product/${chatData.productSku}`, // Adjust based on your URL structure
            timestamp: new Date().toLocaleString(),
            seller_email: seller.email,
            reply_link: `${window.location.origin}/#chat/${chatData.productSku}` // Link to chat
        };

        console.log('📧 Sending email alert to:', seller.email);

        // Send email using EmailJS
        const response = await emailjs.send(
            CONFIG.EMAILJS.SERVICE_ID,
            CONFIG.EMAILJS.TEMPLATE_ID,
            templateParams
        );

        console.log('✅ Email sent successfully!', response);
        
        // Optional: Log the email notification in your system
        await logEmailNotification(chatData, seller.userId);
        
        return true;

    } catch (error) {
        console.error('❌ Failed to send email:', error);
        
        // Optional: Show user-friendly message but don't disrupt chat
        if (error.text) {
            console.error('EmailJS error details:', error.text);
        }
        
        return false;
    }
}

// Optional: Log email notifications in your database
async function logEmailNotification(chatData, sellerId) {
    try {
        // You could create a new bin for email logs or add to existing structure
        const emailLog = {
            sellerId: sellerId,
            productSku: chatData.productSku,
            buyerId: chatData.buyerId,
            messagePreview: chatData.message.substring(0, 50),
            sentAt: new Date().toISOString(),
            status: 'sent'
        };
        
        // Optional: Store in your database
        // await api.createEmailLog(emailLog);
        
        console.log('📝 Email notification logged:', emailLog);
    } catch (error) {
        console.error('Error logging email:', error);
    }
}

// Function to check if email should be sent (e.g., not for own messages)
function shouldSendEmailAlert(chatData) {
    // Don't send email if:
    // 1. The message is from the seller themselves
    // 2. The message is a system message
    // 3. It's a duplicate or test message
    
    if (chatData.senderId === chatData.sellerId) {
        console.log('Message from seller - no email needed');
        return false;
    }
    
    return true;
}



// ============ SEARCH FUNCTIONALITY ============

// Initialize search
function initializeSearch() {
    console.log('Initializing search...');
    
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchButton');
    
    if (!searchInput || !searchBtn) return;
    
    // Search on button click
    searchBtn.addEventListener('click', performSearch);
    
    // Search on Enter key
    // In initializeSearch function, replace the input event listener:
      searchInput.addEventListener('input', debounce(() => {
          if (searchInput.value.trim().length >= 2) {
              performSearch();
          }
      }, 500));
    
    /*
    // Search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    */
    
    // Real-time search with debounce (optional)
    let debounceTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            if (searchInput.value.trim().length >= 2) {
                performSearch();
            }
        }, 400);
    });
}

// Main search function
async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (searchTerm.length < 2) {
        alert('Please enter at least 2 characters to search');
        return;
    }
    
    try {
        // Show loading state in products grid
        const productsGrid = document.getElementById('productsGrid');
        productsGrid.innerHTML = `
            <div class="no-results">
                <div class="loading-spinner" style="margin: 0 auto 1rem;"></div>
                <p>Searching for "${searchTerm}"...</p>
            </div>
        `;
        
        // Get all active products
        const allProducts = await api.getAllProducts();
        const activeProducts = allProducts.filter(p => p.activityStatus === 'Active');
        
        // Perform search in name and description
        let results = activeProducts.filter(product => {
            const nameMatch = product.name.toLowerCase().includes(searchTerm);
            const descMatch = product.description.toLowerCase().includes(searchTerm);
            return nameMatch || descMatch;
        });
        
        // Sort by relevance (name matches first, then description)
        results.sort((a, b) => {
            const aNameMatch = a.name.toLowerCase().includes(searchTerm);
            const bNameMatch = b.name.toLowerCase().includes(searchTerm);
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            // If both match in name or both don't, sort by date
            return new Date(b.dateAdvertised) - new Date(a.dateAdvertised);
        });
        
        // Display results
        displaySearchResults(results, searchTerm);
        
    } catch (error) {
        console.error('Search error:', error);
        alert('An error occurred while searching. Please try again.');
    }
}

// Display search results
function displaySearchResults(results, searchTerm) {
    const productsGrid = document.getElementById('productsGrid');
    const categoryTitle = document.getElementById('currentCategoryTitle');
    
    // Update header with search results info
    categoryTitle.innerHTML = `
        <div class="search-results-header">
            <h3>
                <i class="fas fa-search"></i>
                Found <span>${results.length}</span> result${results.length !== 1 ? 's' : ''} 
                for "${searchTerm}"
            </h3>
            <button class="clear-search-btn" onclick="clearSearch()">
                <i class="fas fa-times"></i> Clear Search
            </button>
        </div>
    `;
    
    // Clear and populate grid
    productsGrid.innerHTML = '';
    
    if (results.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No products found</h3>
                <p>We couldn't find any products matching "${searchTerm}"</p>
                <p class="text-muted">Try different keywords or browse categories instead</p>
                <button class="btn" onclick="clearSearch()">Browse All Categories</button>
            </div>
        `;
    } else {
        results.forEach(product => {
            // Create highlighted version of name and description
            const highlightedProduct = {
                ...product,
                displayName: highlightText(product.name, searchTerm),
                displayDescription: highlightText(product.description, searchTerm)
            };
            
            const card = createSearchResultCard(highlightedProduct, searchTerm);
            productsGrid.appendChild(card);
        });
    }
    
    // Show the products section
    showSection('productsSection');
}

// Create search result card with highlighting
function createSearchResultCard(product, searchTerm) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const mainImage = product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/250x200?text=No+Image';
    
    card.innerHTML = `
        <div class="product-images">
            <img src="${mainImage}" alt="${product.name}" class="product-main-image">
            <span class="image-count">${product.images ? product.images.length : 0} photos</span>
            ${product.paymentStatus === 'free' ? '<span class="free-badge">FREE</span>' : ''}
        </div>
        <div class="product-info">
            <div class="product-name">${product.displayName || product.name}</div>
            <div class="product-description-preview">${product.displayDescription || product.description.substring(0, 60)}${product.description.length > 60 ? '...' : ''}</div>
            <div class="product-price">₦${product.price.toLocaleString()}</div>
            <div class="product-seller">
                <i class="fas fa-user"></i> ${product.sellerName || product.sellerId}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => loadProductDetail(product.sku));
    return card;
}

// Helper function to highlight text
function highlightText(text, searchTerm) {
    if (!text || !searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}


// ============ FIREBASE INTEGRATION ============

// Initialize Firebase when app starts
function initializeFirebase() {
    return firebaseService.initialize();
}

// Add this cleanup function as well (place it after initializeFirebase)
async function cleanupFailedProduct(imageUrls) {
    if (imageUrls && imageUrls.length > 0) {
        try {
            await firebaseService.deleteMultipleImages(imageUrls);
            console.log('🧹 Cleaned up images for failed product');
        } catch (error) {
            console.error('Error cleaning up images:', error);
        }
    }
}


// Clear search and return to categories
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // Go back to categories
    showSection('categoriesSection');
    
    // Reset category title
    document.getElementById('currentCategoryTitle').textContent = '';
}

// Add this CSS for product description preview (add to your styles)
function addSearchStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .product-description-preview {
            font-size: 0.8rem;
            color: #666;
            margin: 0.25rem 0;
            line-height: 1.4;
            max-height: 2.8em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
    `;
    document.head.appendChild(style);
}




// Add this function to app.js - it's currently missing
function initializeAuthForms() {
    console.log('Initializing auth forms...');
    // This function sets up any authentication-related form handlers
    // Since we're already handling forms in showAuthForm, this can be empty
    // or used to pre-fill any auth-related UI elements
}

// Also add this missing function if it's not present
function loadCategories() {
    console.log('Loading categories...');
    // This is likely already handled by initializeCategories()
    // But if it's missing, add this:
    try {
        updateCategoryCounts();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Show temporary notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--success-green)' : 'var(--primary-purple)'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Add this missing function if not present
function loadUserPayments() {
    console.log('Loading user payments...');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (!auth.currentUser) {
        dashboardContent.innerHTML = '<p>Please login to view payments</p>';
        return;
    }
    
    paymentService.getUserPaymentHistory(auth.currentUser.userId).then(payments => {
        dashboardContent.innerHTML = `
            <h3>My Payment History</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product SKU</th>
                            <th>Amount</th>
                            <th>Payment Date</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.length > 0 ? payments.map(payment => `
                            <tr>
                                <td>${payment.productSKU}</td>
                                <td>₦${payment.payAmount}</td>
                                <td>${new Date(payment.paymentDate).toLocaleString()}</td>
                                <td>${payment.reference || 'N/A'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" class="text-center">No payments found</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }).catch(error => {
        console.error('Error loading payments:', error);
        dashboardContent.innerHTML = '<p>Error loading payment history</p>';
    });
}

// Add this missing function
function showUserProfile() {
    console.log('Showing user profile...');
    const dashboardContent = document.getElementById('dashboardContent');
    const user = auth.currentUser;
    
    if (!user) {
        dashboardContent.innerHTML = '<p>Please login to view profile</p>';
        return;
    }
    
    dashboardContent.innerHTML = `
        <h3>My Profile</h3>
        <div class="profile-info">
            <p><strong>User ID:</strong> ${user.userId}</p>
            <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Telephone:</strong> ${user.telephone}</p>
            <p><strong>Member Since:</strong> ${new Date(user.dateOfRegistration).toLocaleDateString()}</p>
            <p><strong>Free Adverts Used:</strong> ${user.numberOfAdverts || 0}/2</p>
            <p><strong>Account Status:</strong> ${user.userActivityStatus === 1 ? 'Active' : 'Inactive'}</p>
        </div>
        <button onclick="showEditProfileForm()" class="btn">Edit Profile</button>
    `;
}




// Add this if needed
function showEditProfileForm() {
    const user = auth.currentUser;
    const dashboardContent = document.getElementById('dashboardContent');
    
    dashboardContent.innerHTML = `
        <h3>Edit Profile</h3>
        <form id="editProfileForm" class="form-container">
            <div class="form-group">
                <label for="firstName">First Name</label>
                <input type="text" id="firstName" value="${user.firstName}" required>
            </div>
            <div class="form-group">
                <label for="lastName">Last Name</label>
                <input type="text" id="lastName" value="${user.lastName}" required>
            </div>
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" value="${user.email}" required>
            </div>
            <div class="form-group">
                <label for="telephone">Telephone</label>
                <input type="tel" id="telephone" value="${user.telephone}" required>
            </div>
            <div class="form-group">
                <label for="currentPassword">Current Password</label>
                <input type="password" id="currentPassword">
            </div>
            <div class="form-group">
                <label for="newPassword">New Password (leave blank to keep current)</label>
                <input type="password" id="newPassword">
            </div>
            <div class="form-group">
                <label for="confirmPassword">Confirm New Password</label>
                <input type="password" id="confirmPassword">
            </div>
            <button type="submit" class="btn">Update Profile</button>
            <button type="button" onclick="showUserProfile()" class="btn" style="background: #666;">Cancel</button>
        </form>
    `;
    
    document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updates = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            telephone: document.getElementById('telephone').value
        };
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Verify current password if trying to change password
        if (newPassword) {
            if (currentPassword !== user.password) {
                alert('Current password is incorrect');
                return;
            }
            if (newPassword !== confirmPassword) {
                alert('New passwords do not match');
                return;
            }
            updates.password = newPassword;
        }
        
        try {
            await api.updateUser(user.userId, updates);
            // Update local user data
            Object.assign(auth.currentUser, updates);
            localStorage.setItem('currentUser', JSON.stringify(auth.currentUser));
            alert('Profile updated successfully!');
            showUserProfile();
        } catch (error) {
            alert('Error updating profile: ' + error.message);
        }
    });
}



// Update pending operations indicator
function updatePendingOperationsIndicator() {
    const indicator = document.getElementById('pendingOperationsIndicator');
    const pendingCount = document.getElementById('pendingCount');
    
    if (api.requestQueue && api.requestQueue.length > 0) {
        pendingCount.textContent = api.requestQueue.length;
        indicator.style.display = 'inline-flex';
    } else {
        indicator.style.display = 'none';
    }
}

// Call this periodically
setInterval(updatePendingOperationsIndicator, 5000);

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('App starting...');
        
        // Check if all required functions exist
        console.log('Checking functions:', {
            initializeNavigation: typeof initializeNavigation,
            initializeCategories: typeof initializeCategories,
            initializeAuthForms: typeof initializeAuthForms,
            loadCategories: typeof loadCategories
        });
        
         // Initialize Firebase FIRST (add this line)
        initializeFirebase();
        
        // Initialize EmailJS
        initializeEmailJS();
        
        // Initialize admin user
        await api.initializeAdmin();
        
        // Hide New Ad menu initially (will be shown if user is merchant)
        const newAdLink = document.getElementById('newAdLink');
        if (newAdLink) {
            newAdLink.style.display = 'none';
        }
        
        // Check for existing session
        const user = auth.checkSession();
        if (user) {
            updateUIForUser(user);
        }

        // Initialize UI components
        initializeNavigation();
        initializeCategories();
        initializeAuthForms();
        
        // Load categories
        loadCategories();
        
        // ============ FIX: Initialize Search ============
        // Initialize search
        initializeSearch();
        addSearchStyles();
        
        
       // testPreflight();//New

// Hamburger menu toggle - DROPDOWN STYLE
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const menuOverlay = document.getElementById('menuOverlay');

if (hamburger && navMenu) {
    console.log('Hamburger menu initialized');
    
    // Hide overlay since we're using dropdown style
    if (menuOverlay) {
        menuOverlay.style.display = 'none';
    }
    
    // Toggle menu on hamburger click
    hamburger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Hamburger clicked');
        
        // Toggle menu
        navMenu.classList.toggle('active');
        
        // Toggle hamburger icon
        const icon = hamburger.querySelector('i');
        if (icon) {
            if (navMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });
    
    // Close menu when clicking on any nav link (except dropdown toggles)
    const navLinks = navMenu.querySelectorAll('.nav-link:not(.dropdown-toggle)');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && navMenu.classList.contains('active')) {
                console.log('Nav link clicked, closing menu');
                
                // Small delay to allow navigation
                setTimeout(() => {
                    navMenu.classList.remove('active');
                    const icon = hamburger.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                }, 150);
            }
        });
    });
    
    // Handle dropdown toggles on mobile
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const dropdownLink = dropdown.querySelector('.nav-link');
        if (dropdownLink) {
            dropdownLink.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Close other dropdowns
                    dropdowns.forEach(d => {
                        if (d !== dropdown) {
                            d.classList.remove('active');
                        }
                    });
                    
                    // Toggle current dropdown
                    dropdown.classList.toggle('active');
                }
            });
        }
    });
    
    // Close menu when clicking outside (on the main content)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const isClickInsideMenu = navMenu.contains(e.target);
            const isClickOnHamburger = hamburger.contains(e.target);
            
            if (!isClickInsideMenu && !isClickOnHamburger && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                const icon = hamburger.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        }
    });
    
    // Close menu when window resizes to desktop size
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            navMenu.classList.remove('active');
            const icon = hamburger.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
            
            // Close all dropdowns
            const dropdowns = document.querySelectorAll('.dropdown');
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.innerWidth <= 768 && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            const icon = hamburger.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });
}
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Error initializing application. Please check the console for details.');
    }
});

// Helper function to close mobile menu - kept for backward compatibility
function closeMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    const hamburger = document.getElementById('hamburger');
    
    if (navMenu && window.innerWidth <= 768) {
        navMenu.classList.remove('active');
        
        if (hamburger) {
            const icon = hamburger.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
        
        // Close all dropdowns
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    }
}




// Rate limit management functions
function showRateLimitWarning(message) {
    const warning = document.getElementById('rateLimitWarning');
    const messageSpan = document.getElementById('rateLimitMessage');
    if (warning && messageSpan) {
        messageSpan.textContent = message;
        warning.style.display = 'flex';
        
        // Disable add product button if it exists
        const addProductBtn = document.querySelector('[data-view="add-product"]');
        if (addProductBtn) {
            addProductBtn.style.pointerEvents = 'none';
            addProductBtn.style.opacity = '0.5';
        }
    }
}

function hideRateLimitWarning() {
    const warning = document.getElementById('rateLimitWarning');
    if (warning) {
        warning.style.display = 'none';
        
        // Re-enable add product button
        const addProductBtn = document.querySelector('[data-view="add-product"]');
        if (addProductBtn) {
            addProductBtn.style.pointerEvents = 'auto';
            addProductBtn.style.opacity = '1';
        }
    }
}

// Check rate limit periodically
setInterval(() => {
    if (api.rateLimitReset > Date.now()) {
        const timeLeft = Math.ceil((api.rateLimitReset - Date.now()) / 1000);
        if (api.rateLimitRemaining < 3 && timeLeft > 0) {
            showRateLimitWarning(`Rate limit will reset in ${timeLeft} seconds`);
        } else if (api.rateLimitRemaining >= 3) {
            hideRateLimitWarning();
        }
    }
}, 5000);






function initializeNavigation() {
   // Home link
    document.getElementById('homeLink').addEventListener('click', (e) => {
        e.preventDefault();
        goToHome();
    });
   
    // About link
    document.getElementById('aboutLink').addEventListener('click', (e) => {
        e.preventDefault();
        showAboutModal();
    });

    // Sign in link
    document.getElementById('signinLink').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('signin');
    });

    // Sign up link
    document.getElementById('signupLink').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('signup');
    });
    
    // ADD THIS: New Ad link
    document.getElementById('newAdLink').addEventListener('click', (e) => {
        e.preventDefault();
        createNewAd();
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        auth.logout();
        location.reload();
    });

    // Back buttons
    document.getElementById('backToCategories').addEventListener('click', () => {
        showSection('categoriesSection');
    });

    document.getElementById('backToProducts').addEventListener('click', () => {
        showSection('productsSection');
    });
}


// Create new ad function
function createNewAd() {
    console.log('Creating new ad...');
    
    // Check if user is logged in
    if (!auth.currentUser) {
        // If not logged in, show sign in form with a message
        alert('Please sign in to create a new advertisement.');
        showAuthForm('signin');
        return;
    }
    
    // Check if user is a merchant (not admin)
    if (auth.currentUser.userGroup === 0) {
        alert('Admins cannot create advertisements. Please use a merchant account.');
        return;
    }
    
    // Navigate to user dashboard and show add product form
    if (auth.currentUser.userGroup === 1) {
        // Show user dashboard
        showSection('userDashboardSection');
        
        // Load the dashboard first
        loadUserDashboard().then(() => {
            // Then show the add product form
            // Find and click the "Add Product" menu item in the dashboard
            const addProductMenuItem = document.querySelector('[data-view="add-product"]');
            if (addProductMenuItem) {
                addProductMenuItem.click();
            } else {
                // Fallback: directly call showAddProductForm
                showAddProductForm();
            }
            
            // Optional: Show a welcome message
            console.log('Ready to create your new advertisement!');
        });
    }
}

// Alternative direct approach if the above doesn't work
function createNewAdDirect() {
    console.log('Creating new ad directly...');
    
    // Check if user is logged in
    if (!auth.currentUser) {
        alert('Please sign in to create a new advertisement.');
        showAuthForm('signin');
        return;
    }
    
    // Check if user is a merchant (not admin)
    if (auth.currentUser.userGroup === 0) {
        alert('Admins cannot create advertisements. Please use a merchant account.');
        return;
    }
    
    // Navigate to user dashboard
    showSection('userDashboardSection');
    
    // Load the dashboard
    loadUserDashboard();
    
    // Directly call showAddProductForm after a short delay to ensure dashboard is loaded
    setTimeout(() => {
        showAddProductForm();
    }, 100);
}


// Go to home page (categories section)
function goToHome() {
    console.log('Navigating to home...');
    
    // Clear any search if active
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Show categories section
    showSection('categoriesSection');
    
    // Reset category title if needed
    const categoryTitle = document.getElementById('currentCategoryTitle');
    if (categoryTitle) {
        categoryTitle.textContent = '';
    }
    
    // Refresh category counts
    updateCategoryCounts();
}


function initializeCategories() {
    const categoriesGrid = document.getElementById('categoriesGrid');
    const dropdown = document.getElementById('categoriesDropdown');
    
    if (!categoriesGrid) {
        console.error('Categories grid not found!');
        return;
    }
    
    // Clear existing content
    categoriesGrid.innerHTML = '';
    dropdown.innerHTML = '';
    
    // Sample category images
    const categoryImages = {
          'Businesses and Outlets': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/supermarket.png',
        'Computing and Electronics': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/computer%20electronics.png',
        'Professional services': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/A%20computer%20services.png',
        'Household and Fashion': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/household%20products.png',
        'Wholesale food commodities': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/food%20commodities.png',
        'Printing and Publishing': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/printing%20and%20publishing.png',
        'Automobiles and Machines': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/automobiles.png',
        'Food and Well-being': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/food%20services.png',
        'Furniture and others': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/furniture%20business.png',
        'Rentals and Properties': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/props%20and%20real%20estate.png'  
    };

    CATEGORIES.forEach(category => {
        // Add to grid
        const card = document.createElement('div');
        card.className = 'category-card';
        
        // Create a safe ID for the count element
        const safeCategoryId = category.replace(/[&\s]+/g, '-').toLowerCase();
        
        card.innerHTML = `
            <img src="${categoryImages[category] || 'https://via.placeholder.com/200x150?text=Category'}" 
                 alt="${category}" 
                 class="category-image"
                 onerror="this.src='https://via.placeholder.com/200x150?text=Category'">
            <div class="category-info">
                <div class="category-name">${category}</div>
                <div class="category-count" id="count-${safeCategoryId}">Loading...</div>
                <span class="notification-badge" id="notif-${safeCategoryId}" style="display: none;">0</span>
            </div>
        `;
        
        // Add click event listener
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Category clicked: ${category}`);
            loadProductsByCategory(category);
        });
        
        categoriesGrid.appendChild(card);

        // Add to dropdown
        const li = document.createElement('li');
        li.innerHTML = `<a href="#" class="dropdown-item" data-category="${category}">${category}</a>`;
        
        const link = li.querySelector('a');
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Dropdown category clicked: ${category}`);
            loadProductsByCategory(category);
            
            // Close mobile menu if open
            if (window.innerWidth <= 768) {
                const navMenu = document.getElementById('navMenu');
                const hamburger = document.getElementById('hamburger');
                if (navMenu) navMenu.classList.remove('active');
                if (hamburger) {
                    const icon = hamburger.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                }
            }
        });
        
        dropdown.appendChild(li);
    });

    // Load category counts
    updateCategoryCounts();
}




async function updateCategoryCounts() {
    const products = await api.getAllProducts();
    
    CATEGORIES.forEach(category => {
        const count = products.filter(p => p.category === category && p.activityStatus === 'Active').length;
        
        // Create a safe ID by replacing spaces and special characters
        const safeCategoryId = category.replace(/[&\s]+/g, '-').toLowerCase();
        const countElement = document.getElementById(`count-${safeCategoryId}`);
        
        if (countElement) {
            countElement.textContent = `${count} ads`;
        }
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const mainImage = product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/250x200?text=No+Image';
    
    card.innerHTML = `
        <div class="product-images">
            <img src="${mainImage}" alt="${product.name}" class="product-main-image">
            <span class="image-count">${product.images ? product.images.length : 0} photos</span>
            ${product.chats && product.chats.length > 0 ? 
                `<span class="chat-notification">${product.chats.filter(c => !c.read).length}</span>` : ''}
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-price">₦${product.price}</div>
            <div class="product-seller">Seller: ${product.sellerId}</div>
        </div>
    `;
    
    card.addEventListener('click', () => loadProductDetail(product.sku));
    return card;
}


async function loadProductsByCategory(category) {
    console.log(`Loading products for category: ${category}`);
    
    try {
        // Show loading indicator
        const productsGrid = document.getElementById('productsGrid');
        const categoryTitle = document.getElementById('currentCategoryTitle');
        
        if (!productsGrid || !categoryTitle) {
            console.error('Required elements not found');
            return;
        }
        
        categoryTitle.textContent = category;
        productsGrid.innerHTML = '<div class="loading-spinner" style="margin: 2rem auto;"></div>';
        
        // Get products for this category
        const products = await api.getProductsByCategory(category);
        console.log(`Found ${products.length} products in ${category}`);
        
        // Clear loading indicator
        productsGrid.innerHTML = '';
        
        if (products.length === 0) {
            productsGrid.innerHTML = '<p class="text-center">No products in this category yet.</p>';
        } else {
            // Sort by date (newest first)
            products.sort((a, b) => new Date(b.dateAdvertised) - new Date(a.dateAdvertised));
            
            products.forEach(product => {
                const card = createProductCard(product);
                productsGrid.appendChild(card);
            });
        }
        
        // Show the products section
        showSection('productsSection');
        
    } catch (error) {
        console.error('Error loading products by category:', error);
        productsGrid.innerHTML = '<p class="text-center">Error loading products. Please try again.</p>';
    }
}




async function loadProductDetail(sku) {
    try {
        const products = await api.getAllProducts();
        const product = products.find(p => p.sku === sku);
        
        if (!product) {
            alert('Product not found');
            return;
        }
        
        const seller = await api.getUserByUserId(product.sellerId);
        const detailContainer = document.getElementById('productDetail');
        
        // Mark chats as read if current user is the seller
        if (auth.currentUser && auth.currentUser.userId === product.sellerId) {
            await api.markChatAsRead(sku, auth.currentUser.userId);
        }
        
        // Format dates
        const advertisedDate = new Date(product.dateAdvertised).toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const endDate = product.endDate ? new Date(product.endDate).toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'Not set';
        
        // Calculate days remaining
        let daysRemaining = 'N/A';
        if (product.endDate) {
            const remaining = Math.ceil((new Date(product.endDate) - new Date()) / (1000 * 60 * 60 * 24));
            daysRemaining = remaining > 0 ? `${remaining} days` : 'Expired';
        }
        
        // Create image grid HTML with 2x2 layout
        const imageGridHTML = product.images && product.images.length > 0 
            ? product.images.map((img, index) => `
                <div class="product-image-item" onclick="expandImage('${img}')">
                    <img src="${img}" alt="${product.name} - Image ${index + 1}" loading="lazy">
                </div>
            `).join('')
            : '<div class="product-image-item"><img src="https://via.placeholder.com/400x400?text=No+Image" alt="No image available"></div>';
        
        detailContainer.innerHTML = `
            <div class="product-detail-container">
                <div class="product-header">
                    <h2>${product.name}</h2>
                    <p class="product-sku">SKU: ${product.sku}</p>
                </div>
                
                <div class="product-images-grid">
                    ${imageGridHTML}
                </div>
                
                <div class="product-info-grid">
                    <div class="product-description">
                        <h3>📝 Description</h3>
                        <p>${product.description || 'No description provided.'}</p>
                    </div>
                    
                    <div class="product-price-large">
                        <h3>💰 Price</h3>
                        <p class="price">₦${product.price.toLocaleString()}</p>
                    </div>
                </div>
                
                

                <div class="product-meta">
                    <div class="meta-item">
                        <div class="meta-label">Category</div>
                        <div class="meta-value">${product.category}</div>
                    </div>
                    <!-- ADD THIS NEW META-ITEM FOR STATE -->
                    <div class="meta-item">
                        <div class="meta-label">Location</div>
                        <div class="meta-value">${product.state || 'Nigeria'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Listed on</div>
                        <div class="meta-value">${advertisedDate}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Ad expires</div>
                        <div class="meta-value">${endDate}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Time remaining</div>
                        <div class="meta-value">${daysRemaining}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Views</div>
                        <div class="meta-value">${product.viewCount || 0}</div>
                    </div>
                </div>
                
                <div class="seller-info">
                    <h3>👤 Seller Information</h3>
                    <div class="seller-details">
                        <div class="seller-detail-item">
                            <i class="fas fa-user"></i>
                            <span>${seller ? seller.firstName + ' ' + seller.lastName : product.sellerName || 'Unknown'}</span>
                        </div>
                        
                        <div class="seller-detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${product.state || 'Nigeria'}</span>
                        </div>
                        
                        <div class="seller-detail-item">
                            <i class="fas fa-phone"></i>
                            <span>${seller ? seller.telephone : product.sellerContact || 'N/A'}</span>
                        </div>
                        <div class="seller-detail-item">
                            <i class="fas fa-calendar"></i>
                            <span>Member since: ${seller ? new Date(seller.dateOfRegistration).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div class="seller-detail-item">
                            <i class="fas fa-tag"></i>
                            <span>${product.paymentStatus === 'free' ? 'Free Advert' : 'Paid Advert'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="chat-section">
                    <div class="chat-header">
                        <h3>💬 Chat with Seller</h3>
                        ${product.unreadChatCount > 0 ? 
                            `<span class="chat-notification">${product.unreadChatCount} new</span>` : ''}
                    </div>
                    
                    <div class="chat-messages" id="chatMessages">
                        ${product.chats && product.chats.length > 0 
                            ? product.chats.map(chat => {
                                const isOwn = chat.sender === auth.currentUser?.userId;
                                return `
                                    <div class="chat-message ${isOwn ? 'own-message' : 'other-message'}">
                                        <div class="message-sender">${chat.senderName || chat.sender}</div>
                                        <div>${chat.message}</div>
                                        <div class="message-time">${new Date(chat.timestamp).toLocaleString()}</div>
                                    </div>
                                `;
                            }).join('') 
                            : '<p style="text-align: center; color: #666;">No messages yet. Start a conversation!</p>'}
                    </div>
                    
                    ${auth.currentUser ? `
                        <div class="chat-input">
                            <textarea id="chatMessageInput" placeholder="Type your message..." rows="2"></textarea>
                            <button onclick="sendChatMessage('${product.sku}')">
                                <i class="fas fa-paper-plane"></i> Send
                            </button>
                        </div>
                    ` : `
                        <p style="text-align: center; color: #666;">
                            Please <a href="#" onclick="showAuthForm('signin')">sign in</a> to chat with the seller.
                        </p>
                    `}
                </div>
            </div>
        `;
        
        // Increment view count
        await api.updateProduct(sku, { viewCount: (product.viewCount || 0) + 1 });
        
        showSection('productDetailSection');
        
    } catch (error) {
        console.error('Error loading product detail:', error);
        alert('Error loading product details. Please try again.');
    }
}

// Enhanced expandImage function
function expandImage(src) {
    const modal = document.createElement('div');
    modal.className = 'image-expand-modal';
    modal.innerHTML = `
        <span class="close" onclick="this.parentElement.remove()">&times;</span>
        <img src="${src}" alt="Expanded view" onclick="this.style.transform = this.style.transform === 'scale(1.5)' ? 'scale(1)' : 'scale(1.5)'; this.style.transition = 'transform 0.3s ease';">
    `;
    document.body.appendChild(modal);
    
    // Close on click outside image
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}





// Updated sendChatMessage function with email alerts
async function sendChatMessage(sku) {
    const messageInput = document.getElementById('chatMessageInput');
    const message = messageInput.value.trim();
    
    if (!message || !auth.currentUser) return;
    
    try {
        // Get product details
        const products = await api.getAllProducts();
        const product = products.find(p => p.sku === sku);
        
        if (!product) {
            alert('Product not found');
            return;
        }
        
        // Prepare chat message
        const chatMessage = {
            sender: auth.currentUser.userId,
            senderName: `${auth.currentUser.firstName} ${auth.currentUser.lastName}`,
            message: message,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        // Add message to product chats
        if (!product.chats) product.chats = [];
        product.chats.push(chatMessage);
        
        // Update unread count
        if (auth.currentUser.userId !== product.sellerId) {
            product.unreadChatCount = (product.unreadChatCount || 0) + 1;
        }
        
        // Save to database
        await api.updateProduct(sku, { 
            chats: product.chats,
            unreadChatCount: product.unreadChatCount 
        });
        
        // Clear input
        messageInput.value = '';
        
        // Send email alert to seller if this is a buyer message
        if (auth.currentUser.userId !== product.sellerId) {
            console.log('📨 New message from buyer - preparing email alert...');
            
            const chatData = {
                sellerId: product.sellerId,
                buyerId: auth.currentUser.userId,
                buyerName: chatMessage.senderName,
                productSku: sku,
                productName: product.name,
                message: message,
                timestamp: chatMessage.timestamp
            };
            
            // Send email alert (don't await to not block the chat)
            sendChatAlertEmail(chatData).then(success => {
                if (success) {
                    console.log('📧 Email alert sent to seller');
                    // Optional: Show subtle notification
                    showNotification('Message sent and seller notified via email', 'success');
                } else {
                    console.log('Email alert could not be sent');
                }
            });
        }
        
        // Reload product detail to show new message
        loadProductDetail(sku);
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function showAuthForm(type) {
    const container = document.getElementById('authContainer');
    
    if (type === 'signin') {
        container.innerHTML = `
            <div class="form-container">
                <h2>Sign In</h2>
                <form id="signinForm">
                    <div class="form-group">
                        <label for="userId">User ID</label>
                        <input type="text" id="userId" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" required>
                    </div>
                    <button type="submit" class="btn">Sign In</button>
                </form>
                <p class="text-center mt-2">Don't have an account? <a href="#" onclick="showAuthForm('signup')">Sign Up</a></p>
            </div>
        `;
        
        document.getElementById('signinForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const userId = document.getElementById('userId').value;
                const password = document.getElementById('password').value;
                
                const user = await auth.login(userId, password);
                updateUIForUser(user);
                showSection('categoriesSection');
            } catch (error) {
                alert(error.message);
            }
        });
    } else {
        container.innerHTML = `
            <div class="form-container">
                <h2>Sign Up</h2>
                <form id="signupForm">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" required>
                    </div>
                    <div class="form-group">
                        <label for="userId">User ID</label>
                        <input type="text" id="userId" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" required>
                    </div>
                    <div class="form-group">
                        <label for="firstName">First Name</label>
                        <input type="text" id="firstName" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name</label>
                        <input type="text" id="lastName" required>
                    </div>
                    <div class="form-group">
                        <label for="telephone">Telephone</label>
                        <input type="tel" id="telephone" required>
                    </div>
                    <button type="submit" class="btn">Sign Up</button>
                </form>
                <p class="text-center mt-2">Already have an account? <a href="#" onclick="showAuthForm('signin')">Sign In</a></p>
            </div>
        `;
        
        document.getElementById('signupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const userData = {
                    email: document.getElementById('email').value,
                    userId: document.getElementById('userId').value,
                    password: document.getElementById('password').value,
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value,
                    telephone: document.getElementById('telephone').value
                };
                
                await auth.signup(userData);
                alert('Registration successful! Please sign in.');
                showAuthForm('signin');
            } catch (error) {
                alert(error.message);
            }
        });
    }
    
    showSection('authSection');
}



function updateUIForUser(user) {
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('displayName').textContent = user.firstName;
    document.getElementById('signinLink').style.display = 'none';
    document.getElementById('signupLink').style.display = 'none';
    
    // Show/hide New Ad menu based on user type
    const newAdLink = document.getElementById('newAdLink');
    if (newAdLink) {
        // Show New Ad for merchants (group 1), hide for admins (group 0)
        if (user.userGroup === 1) {
            newAdLink.style.display = 'inline-flex'; // Use inline-flex for proper alignment
        } else {
            newAdLink.style.display = 'none';
        }
    }
    
    // Show appropriate dashboard based on user type
    if (user.userGroup === 0) {
        loadAdminDashboard();
        showSection('adminDashboardSection');
    } else {
        loadUserDashboard();
        showSection('userDashboardSection');
    }
}

async function loadUserDashboard() {
    const dashboardContent = document.getElementById('dashboardContent');
    const products = await api.getProductsBySeller(auth.currentUser.userId);
    
 // In loadUserDashboard function, simplify the product display
dashboardContent.innerHTML = `
    <h3>My Products</h3>
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(product => `
                    <tr>
                        <td><img src="${product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/50'}" class="thumbnail"></td>
                        <td>${product.sku}</td>
                        <td>${product.name}</td>
                        <td>₦${product.price}</td>
                        <td>${product.activityStatus}</td>
                        <td>
                            <button onclick="editProduct('${product.sku}')" class="btn-small">Edit</button>
                            <button onclick="deleteProduct('${product.sku}')" class="btn-small" style="background: var(--primary-red);">Delete</button>
                            ${product.paymentStatus !== 'paid' && auth.currentUser.numberOfAdverts >= 2 ? 
                                `<button onclick="payForAdvert('${product.sku}')" class="btn-small" style="background: green;">Pay</button>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
`;
    // Add event listeners for dashboard menu
    document.querySelectorAll('.dashboard-menu li').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.dashboard-menu li').forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            
            const view = item.dataset.view;
            if (view === 'add-product') {
                showAddProductForm();
            } else if (view === 'products') {
                loadUserDashboard();
            } else if (view === 'payments') {
                loadUserPayments();
            } else if (view === 'profile') {
                showUserProfile();
            }
        });
    });
    
    
    
    // After loading products, check for incomplete ones
   // await checkIncompleteProducts();
}



// Updated collectImages function - returns the global uploaded files
async function collectImages() {
    if (uploadedImageFiles.length < 4) {
        alert(`Please upload at least 4 images. Currently have ${uploadedImageFiles.length}`);
        return null;
    }
    
    return uploadedImageFiles;
}

// Function to handle payment type selection
async function selectPaymentType(paymentType, amount) {
    closePaymentModal();
    
    if (!pendingProductData) {
        alert('Error: Product data not found. Please try again.');
        return;
    }
    
    try {
        // Initialize Paystack payment
        await paymentService.initializePayment(
            amount,
            auth.currentUser.email,
            paymentType,
            pendingProductData,
            async (response) => {
                // Payment success callback
                console.log('Payment successful:', response);
                
                // Create the product with paid status
                const product = await createProduct('paid', pendingProductData, paymentType);
                
                if (product) {
                    // Record the payment
                    await api.createPayment({
                        productSKU: product.sku,
                        userID: auth.currentUser.userId,
                        payAmount: amount,
                        reference: response.reference,
                        paymentType: paymentType
                    });
                    
                    alert('✅ Payment successful! Your product has been listed and will be active according to your selected duration.');
                    
                    // Clear pending data
                    pendingProductData = null;
                    
                    // Refresh dashboard
                    loadUserDashboard();
                }
            },
            (error) => {
                // Payment failure callback
                console.error('Payment failed:', error);
                alert('❌ Payment failed: ' + error.message);
                
                // Ask if user wants to try again
                if (confirm('Payment failed. Would you like to try again?')) {
                    showPaymentTypeSelection();
                } else {
                    pendingProductData = null;
                }
            }
        );
    } catch (error) {
        console.error('Error initializing payment:', error);
        alert('Error initializing payment: ' + error.message);
    }
}




// Function to show payment type selection
async function showPaymentTypeSelection() {
    // Get payment rates from admin
    const rates = await paymentService.getPaymentRates();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="closePaymentModal()">&times;</span>
            <h3>Select Advert Payment Plan</h3>
            <p>You have used your 2 free adverts. Please select a payment plan for your product:</p>
            
            <div class="payment-options" style="display: grid; gap: 15px; margin: 20px 0;">
                <div class="payment-option" style="border: 2px solid #ddd; padding: 15px; border-radius: 10px; cursor: pointer;" onclick="selectPaymentType('daily', ${rates.daily})">
                    <h4 style="color: var(--primary-purple);">Daily Advert</h4>
                    <p style="font-size: 1.5rem; font-weight: bold;">₦${rates.daily}</p>
                    <p>Valid for 1 day</p>
                </div>
                
                <div class="payment-option" style="border: 2px solid #ddd; padding: 15px; border-radius: 10px; cursor: pointer;" onclick="selectPaymentType('weekly', ${rates.weekly})">
                    <h4 style="color: var(--primary-purple);">Weekly Advert</h4>
                    <p style="font-size: 1.5rem; font-weight: bold;">₦${rates.weekly}</p>
                    <p>Valid for 7 days</p>
                </div>
                
                <div class="payment-option" style="border: 2px solid #ddd; padding: 15px; border-radius: 10px; cursor: pointer;" onclick="selectPaymentType('monthly', ${rates.monthly})">
                    <h4 style="color: var(--primary-purple);">Monthly Advert</h4>
                    <p style="font-size: 1.5rem; font-weight: bold;">₦${rates.monthly}</p>
                    <p>Valid for 30 days</p>
                </div>
            </div>
            
            <button onclick="closePaymentModal()" class="btn" style="background: #666;">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
}


function showAddProductForm() {
    const dashboardContent = document.getElementById('dashboardContent');
    
    // Reset uploaded images when opening the form
    resetUploadedImages();
    
    dashboardContent.innerHTML = `
        <h3>Add New Product</h3>
        <form id="addProductForm" class="form-container" style="max-width: none;">
            <div class="form-group">
                <label for="productName">Product Name</label>
                <input type="text" id="productName" required>
            </div>
            <div class="form-group">
                <label for="productCategory">Category</label>
                <select id="productCategory" required>
                    ${CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="productState">Location (Nigerian State) <span style="color: red;">*</span></label>
                <select id="productState" required>
                    <option value="">Select State</option>
                    ${NIGERIAN_STATES.map(state => `<option value="${state}">${state}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="productDescription">Description</label>
                <textarea id="productDescription" rows="4" required></textarea>
            </div>
            <div class="form-group">
                <label for="productPrice">Price (₦)</label>
                <input type="number" id="productPrice" required>
            </div>
            <div class="form-group">
                <label for="productImages">Product Images (minimum 4)</label>
                <input type="file" id="productImages" multiple accept="image/*" onchange="handleImageUpload(this)" style="display: none;">
                <div style="margin-bottom: 10px;">
                    <button type="button" onclick="document.getElementById('productImages').click()" class="btn-small" style="background: var(--primary-purple);">
                        <i class="fas fa-plus"></i> Select Images
                    </button>
                    <small style="margin-left: 10px; color: #666;">You can upload images one at a time</small>
                </div>
                <div id="imagePreview" class="product-images-grid" style="min-height: 120px; border: 2px dashed #ccc; padding: 10px; border-radius: 5px;"></div>
                <small id="imageCount" style="color: red; display: block; margin-top: 10px;">0 of 4 images selected</small>
                <small id="sizeWarning" style="color: orange; display: block; margin-top: 5px;"></small>
            </div>
            <button type="submit" class="btn" id="submitProductBtn" disabled>Add Product (Need 4 images)</button>
        </form>
    `;
    
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitProductBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        
        try {
            // Check if user is logged in
            if (!auth.currentUser) {
                alert('Please login first');
                return;
            }
            
            // Check image count
            if (uploadedImageFiles.length < 4) {
                alert(`Please upload at least 4 images. Currently have ${uploadedImageFiles.length}`);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Product';
                return;
            }
            
            // Validate state selection
            const selectedState = document.getElementById('productState').value;
            if (!selectedState) {
                alert('Please select a Nigerian state');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Product';
                return;
            }
            
            // Get user's existing products count
            const userProducts = await api.getProductsBySeller(auth.currentUser.userId);
            const userAdvertCount = userProducts.length;
            
            console.log(`User has ${userAdvertCount} existing products`);
            
            // Prepare product data with file objects
            const productData = {
                name: document.getElementById('productName').value,
                category: document.getElementById('productCategory').value,
                state: selectedState,
                description: document.getElementById('productDescription').value,
                price: document.getElementById('productPrice').value,
                images: uploadedImageFiles // Use the global array
            };
            
            if (userAdvertCount < 2) {
                // Free advert - first or second product
                console.log('Creating free product...');
                const product = await createProduct('free', productData);
                
                if (product) {
                    alert('✅ Product added successfully as free advert! It will be active for 14 days.');
                    resetUploadedImages(); // Clear uploaded images
                    loadUserDashboard();
                }
            } else {
                // Paid advert - third product onwards
                console.log('Free adverts used up (2/2), showing payment options...');
                
                // Store product data temporarily
                pendingProductData = productData;
                
                // Show payment type selection
                showPaymentTypeSelection();
            }
            
        } catch (error) {
            console.error('Error in form submission:', error);
            alert('Error: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Product';
        }
    });
}

function showPaymentOptionsWithProductData(productData) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3>Select Payment Type</h3>
            <p>You have used your 2 free adverts. Please select a payment plan for your ${userAdvertCount + 1}th product:</p>
            <div class="form-group">
                <label for="paymentType">Payment Duration</label>
                <select id="paymentType">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
            </div>
            <button onclick="processPaidProduct('${encodeURIComponent(JSON.stringify(productData))}')" class="btn">Proceed to Payment</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function processPaidProduct(productDataStr) {
    const productData = JSON.parse(decodeURIComponent(productDataStr));
    const paymentType = document.getElementById('paymentType').value;
    
    try {
        // First create the product with pending status
        const product = await createProduct('pending', productData);
        
        if (product) {
            // Then process payment
            await paymentService.processAdvertPayment(product.sku, paymentType);
            alert('Payment successful! Your ad is now active.');
            loadUserDashboard();
        }
    } catch (error) {
        alert('Payment failed: ' + error.message);
    }
    
    // Close modal
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
}


// Single-process createProduct function



// Updated createProduct function with Firebase Storage and state
async function createProduct(paymentStatus, productData = null, paymentType = null) {
    try {
        let imageFiles = [];
        let name, category, description, price, state;
        
        if (productData) {
            name = productData.name;
            category = productData.category;
            state = productData.state;
            description = productData.description;
            price = productData.price;
            imageFiles = productData.images || [];
        } else {
            imageFiles = await collectImages();
            if (!imageFiles || imageFiles.length < 4) {
                alert('Please upload at least 4 images');
                return null;
            }
            
            name = document.getElementById('productName').value;
            category = document.getElementById('productCategory').value;
            state = document.getElementById('productState').value;
            description = document.getElementById('productDescription').value;
            price = document.getElementById('productPrice').value;
        }
        
        // Validate inputs including state
        if (!name || !category || !state || !description || !price) {
            throw new Error('Missing required fields');
        }
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-spinner';
        loadingDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); z-index: 10000;';
        loadingDiv.innerHTML = 'Creating product...';
        document.body.appendChild(loadingDiv);
        
        // Generate SKU first (needed for Firebase path)
        const sku = 'SKU-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
        
        // Upload images to Firebase
        loadingDiv.innerHTML = `Uploading ${imageFiles.length} images to Firebase...`;
        let imageUrls = [];
        
        try {
            imageUrls = await firebaseService.uploadMultipleImages(imageFiles, sku);
            console.log('✅ Images uploaded to Firebase:', imageUrls);
        } catch (uploadError) {
            loadingDiv.remove();
            throw new Error('Failed to upload images: ' + uploadError.message);
        }
        
        // Prepare product data with image URLs only
        const completeProductData = {
            name: name,
            description: description,
            price: parseFloat(price),
            category: category,
            state: state, // NEW: Include state
            images: imageUrls,
            sellerId: auth.currentUser.userId,
            sellerName: `${auth.currentUser.firstName} ${auth.currentUser.lastName}`,
            sellerContact: auth.currentUser.telephone,
            paymentStatus: paymentStatus,
            paymentType: paymentType
        };
        
        // Calculate payload size (should be tiny now!)
        const finalSizeKB = JSON.stringify(completeProductData).length / 1024;
        console.log(`📦 Final payload: ${finalSizeKB.toFixed(2)}KB (with state)`);
        
        // This should always pass now since URLs are tiny
        if (finalSizeKB > 95) {
            loadingDiv.remove();
            // If somehow still too large, clean up uploaded images
            await firebaseService.deleteMultipleImages(imageUrls);
            throw new Error(`Payload too large (${finalSizeKB.toFixed(0)}KB). This shouldn't happen with URLs only.`);
        }
        
        // Create product in JSONBin.io
        loadingDiv.innerHTML = 'Saving product data...';
        const product = await api.createProduct(completeProductData);
        
        loadingDiv.remove();
        
        console.log('✅ Product created successfully with Firebase images and state:', product);
        showNotification('✅ Product created successfully!', 'success');
        
        return product;
        
    } catch (error) {
        console.error('❌ Error creating product:', error);
        
        const loadingDiv = document.querySelector('.loading-spinner');
        if (loadingDiv) loadingDiv.remove();
        
        showNotification('❌ Failed to create product: ' + error.message, 'error');
        throw error;
    }
}


function showPaymentOptions() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3>Select Payment Type</h3>
            <div class="form-group">
                <label for="paymentType">Payment Duration</label>
                <select id="paymentType">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
            </div>
            <button onclick="processPayment()" class="btn">Proceed to Payment</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function processPayment() {
    const paymentType = document.getElementById('paymentType').value;
    
    // Collect images first
    const images = await collectImages();
    if (!images) return;
    
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        description: document.getElementById('productDescription').value,
        price: document.getElementById('productPrice').value,
        images: images
    };
    
    try {
        // First create the product with pending status
        const product = await createProduct('pending', productData);
        
        if (product) {
            // Then process payment
            await paymentService.processAdvertPayment(product.sku, paymentType);
            alert('Payment successful! Your ad is now active.');
            loadUserDashboard();
        }
    } catch (error) {
        alert('Payment failed: ' + error.message);
    }
    
    document.querySelector('.modal').remove();
}


async function payForAdvert(sku) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3>Pay for Advert</h3>
            <div class="form-group">
                <label for="paymentType">Payment Duration</label>
                <select id="paymentType">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
            </div>
            <button onclick="processExistingPayment('${sku}')" class="btn">Pay Now</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function processExistingPayment(sku) {
    const paymentType = document.getElementById('paymentType').value;
    
    try {
        await paymentService.processAdvertPayment(sku, paymentType);
        alert('Payment successful! Your ad is now active.');
        loadUserDashboard();
    } catch (error) {
        alert('Payment failed: ' + error.message);
    }
    
    document.querySelector('.modal').remove();
}

async function editProduct(sku) {
    const products = await api.getAllProducts();
    const product = products.find(p => p.sku === sku);
    
    if (!product) return;
    
    const dashboardContent = document.getElementById('dashboardContent');
    
    dashboardContent.innerHTML = `
        <h3>Edit Product</h3>
        <form id="editProductForm" class="form-container" style="max-width: none;">
            <div class="form-group">
                <label for="productName">Product Name</label>
                <input type="text" id="productName" value="${product.name}" required>
            </div>
            <div class="form-group">
                <label for="productCategory">Category</label>
                <select id="productCategory" required>
                    ${CATEGORIES.map(cat => 
                        `<option value="${cat}" ${cat === product.category ? 'selected' : ''}>${cat}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="productDescription">Description</label>
                <textarea id="productDescription" rows="4" required>${product.description}</textarea>
            </div>
            <div class="form-group">
                <label for="productPrice">Price (₦)</label>
                <input type="number" id="productPrice" value="${product.price}" required>
            </div>
            <div class="form-group">
                <label>Current Images</label>
                <div class="product-images-grid">
                    ${product.images ? product.images.map(img => 
                        `<img src="${img}" style="width: 100px; height: 100px; object-fit: cover;">`
                    ).join('') : ''}
                </div>
            </div>
            <div class="form-group">
                <label for="productImages">Add New Images (optional)</label>
                <input type="file" id="productImages" multiple accept="image/*" onchange="handleImageUpload(this)">
                <div id="imagePreview" class="product-images-grid" style="margin-top: 1rem;"></div>
            </div>
            <button type="submit" class="btn">Update Product</button>
        </form>
    `;
    
    document.getElementById('editProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const images = [...product.images];
        const newPreviews = document.querySelectorAll('#imagePreview img');
        newPreviews.forEach(img => images.push(img.src));
        
        const updatedData = {
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            description: document.getElementById('productDescription').value,
            price: document.getElementById('productPrice').value,
            images: images
        };
        
        await api.updateProduct(sku, updatedData);
        alert('Product updated successfully!');
        loadUserDashboard();
    });
}

async function deleteProduct(sku) {
    if (confirm('Are you sure you want to delete this product?')) {
        await api.deleteProduct(sku);
        alert('Product deleted successfully!');
        loadUserDashboard();
    }
}



// Compress image to approximately 40% of original size
async function compressImage(base64String, targetReduction = 0.4) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64String;
        
        img.onload = () => {
            // Calculate original size
            const originalSizeKB = (base64String.length * 0.75) / 1024;
            const targetSizeKB = originalSizeKB * targetReduction; // 40% of original
            
            console.log(`📸 Original: ${originalSizeKB.toFixed(1)}KB, Target: ${targetSizeKB.toFixed(1)}KB (${Math.round(targetReduction*100)}% of original)`);
            
            // Start with reasonable dimensions
            let width = img.width;
            let height = img.height;
            let quality = 0.7; // Start with good quality
            let dimension = Math.max(width, height);
            
            // Progressive compression attempts
            const attempts = [
                { dim: Math.round(dimension * 0.9), qual: 0.65 },
                { dim: Math.round(dimension * 0.8), qual: 0.6 },
                { dim: Math.round(dimension * 0.7), qual: 0.55 },
                { dim: Math.round(dimension * 0.6), qual: 0.5 },
                { dim: Math.round(dimension * 0.5), qual: 0.45 },
                { dim: Math.round(dimension * 0.4), qual: 0.4 }
            ];
            
            let bestCompression = null;
            let bestSize = Infinity;
            let bestDiff = Infinity;
            
            // Try each compression level and find closest to target
            for (const attempt of attempts) {
                const canvas = document.createElement('canvas');
                let newWidth = width;
                let newHeight = height;
                
                // Resize maintaining aspect ratio
                if (newWidth > newHeight) {
                    newHeight = Math.round(newHeight * (attempt.dim / newWidth));
                    newWidth = attempt.dim;
                } else {
                    newWidth = Math.round(newWidth * (attempt.dim / newHeight));
                    newHeight = attempt.dim;
                }
                
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                
                const compressed = canvas.toDataURL('image/jpeg', attempt.qual);
                const sizeKB = (compressed.length * 0.75) / 1024;
                const diff = Math.abs(sizeKB - targetSizeKB);
                
                console.log(`  Attempt: ${newWidth}x${newHeight}, q=${attempt.qual}, size=${sizeKB.toFixed(1)}KB (diff=${diff.toFixed(1)}KB)`);
                
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestSize = sizeKB;
                    bestCompression = compressed;
                }
                
                // If we're close enough, stop trying
                if (sizeKB <= targetSizeKB * 1.1 && sizeKB >= targetSizeKB * 0.9) {
                    break;
                }
            }
            
            const reduction = ((originalSizeKB - bestSize) / originalSizeKB * 100).toFixed(0);
            console.log(`✅ Final: ${bestSize.toFixed(1)}KB (${reduction}% reduction, target was ${targetReduction*100}%)`);
            
            resolve(bestCompression);
        };
        
        img.onerror = (error) => {
            reject(error);
        };
    });
}





// Global array to store uploaded files
let uploadedImageFiles = [];

// Enhanced handleImageUpload - Supports incremental uploads
async function handleImageUpload(input) {
    const preview = document.getElementById('imagePreview');
    const imageCount = document.getElementById('imageCount');
    const submitBtn = document.getElementById('submitProductBtn');
    
    // Get newly selected files
    const newFiles = Array.from(input.files);
    
    // Add new files to global array (limit to 4 total)
    for (let i = 0; i < newFiles.length; i++) {
        if (uploadedImageFiles.length < 4) {
            uploadedImageFiles.push(newFiles[i]);
        } else {
            alert('Maximum 4 images allowed. Extra images were ignored.');
            break;
        }
    }
    
    // Clear the file input so it can be reused
    input.value = '';
    
    // Refresh the preview
    refreshImagePreview();
    
    // Update image count and submit button
    if (imageCount) {
        imageCount.textContent = `${uploadedImageFiles.length} of 4 images selected`;
        imageCount.style.color = uploadedImageFiles.length >= 4 ? 'green' : 'red';
    }
    
    // Enable/disable submit button based on image count
    if (submitBtn) {
        if (uploadedImageFiles.length >= 4) {
            submitBtn.disabled = false;
            submitBtn.title = '';
        } else {
            submitBtn.disabled = true;
            submitBtn.title = `Need ${4 - uploadedImageFiles.length} more image${4 - uploadedImageFiles.length === 1 ? '' : 's'}`;
        }
    }
    
    return uploadedImageFiles;
}

// Function to refresh the image preview
function refreshImagePreview() {
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    // Show existing images
    for (let i = 0; i < uploadedImageFiles.length; i++) {
        const file = uploadedImageFiles[i];
        const objectUrl = URL.createObjectURL(file);
        
        const img = document.createElement('img');
        img.src = objectUrl;
        img.style.width = '100px';
        img.style.height = '100px';
        img.style.objectFit = 'cover';
        img.style.margin = '5px';
        img.style.border = '2px solid #ddd';
        img.style.borderRadius = '5px';
        
        // File size info
        const sizeInfo = document.createElement('small');
        sizeInfo.style.cssText = 'display: block; color: #666; font-size: 10px;';
        sizeInfo.textContent = `${(file.size / 1024).toFixed(0)}KB`;
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '✕';
        removeBtn.style.cssText = `
            position: absolute;
            top: -5px;
            right: 0px;
            background: var(--primary-red);
            color: white;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        `;
        removeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeImage(i);
        };
        
        const container = document.createElement('div');
        container.style.cssText = 'display: inline-block; text-align: center; margin: 5px; position: relative;';
        container.appendChild(img);
        container.appendChild(sizeInfo);
        container.appendChild(removeBtn);
        
        preview.appendChild(container);
    }
    
    // Add "Add More" button if less than 4 images
    if (uploadedImageFiles.length < 4) {
        const addMoreContainer = document.createElement('div');
        addMoreContainer.style.cssText = 'display: inline-block; text-align: center; margin: 5px; vertical-align: top;';
        
        const addMoreBtn = document.createElement('div');
        addMoreBtn.innerHTML = '+';
        addMoreBtn.style.cssText = `
            width: 100px;
            height: 100px;
            background: #f0f0f0;
            border: 2px dashed #999;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            color: #999;
            cursor: pointer;
            margin-bottom: 5px;
            transition: all 0.3s;
        `;
        addMoreBtn.onmouseover = () => {
            addMoreBtn.style.borderColor = 'var(--primary-purple)';
            addMoreBtn.style.color = 'var(--primary-purple)';
            addMoreBtn.style.background = '#e8e8e8';
        };
        addMoreBtn.onmouseout = () => {
            addMoreBtn.style.borderColor = '#999';
            addMoreBtn.style.color = '#999';
            addMoreBtn.style.background = '#f0f0f0';
        };
        addMoreBtn.onclick = (e) => {
            e.preventDefault();
            // Trigger file input click
            document.getElementById('productImages').click();
        };
        
        const addMoreText = document.createElement('small');
        addMoreText.style.cssText = 'display: block; color: #666; font-size: 10px;';
        addMoreText.textContent = `Add more (${4 - uploadedImageFiles.length} left)`;
        
        addMoreContainer.appendChild(addMoreBtn);
        addMoreContainer.appendChild(addMoreText);
        preview.appendChild(addMoreContainer);
    }
}

// Function to remove an image
function removeImage(index) {
    // Remove from global array
    uploadedImageFiles.splice(index, 1);
    
    // Refresh preview
    refreshImagePreview();
    
    // Update image count and submit button
    const imageCount = document.getElementById('imageCount');
    const submitBtn = document.getElementById('submitProductBtn');
    
    if (imageCount) {
        imageCount.textContent = `${uploadedImageFiles.length} of 4 images selected`;
        imageCount.style.color = uploadedImageFiles.length >= 4 ? 'green' : 'red';
    }
    
    if (submitBtn) {
        if (uploadedImageFiles.length >= 4) {
            submitBtn.disabled = false;
            submitBtn.title = '';
        } else {
            submitBtn.disabled = true;
            submitBtn.title = `Need ${4 - uploadedImageFiles.length} more image${4 - uploadedImageFiles.length === 1 ? '' : 's'}`;
        }
    }
}

// Reset uploaded images (call this after successful product creation)
function resetUploadedImages() {
    uploadedImageFiles = [];
    refreshImagePreview();
    
    const imageCount = document.getElementById('imageCount');
    const submitBtn = document.getElementById('submitProductBtn');
    
    if (imageCount) {
        imageCount.textContent = '0 of 4 images selected';
        imageCount.style.color = 'red';
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = 'Need 4 more images';
    }
}


async function loadAdminDashboard() {
    const adminContent = document.getElementById('adminContent');
    const users = await api.getAllUsers();
    const products = await api.getAllProducts();
    const payments = await api.getAllPayments();
    
    adminContent.innerHTML = `
        <h3>User Management</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Telephone</th>
                        <th>Group</th>
                        <th>Status</th>
                        <th>Adverts</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.userId}</td>
                            <td>${user.firstName} ${user.lastName}</td>
                            <td>${user.email}</td>
                            <td>${user.telephone}</td>
                            <td>${user.userGroup === 0 ? 'Admin' : 'Merchant'}</td>
                            <td>${user.userActivityStatus === 1 ? 'Active' : 'Inactive'}</td>
                            <td>${user.numberOfAdverts || 0}</td>
                            <td>
                                <button onclick="adminEditUser('${user.userId}')" class="btn-small">Edit</button>
                                <button onclick="adminToggleUserStatus('${user.userId}')" class="btn-small" style="background: ${user.userActivityStatus === 1 ? 'orange' : 'green'}">
                                    ${user.userActivityStatus === 1 ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onclick="adminDeleteUser('${user.userId}')" class="btn-small" style="background: var(--primary-red);">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Add event listeners for admin dashboard menu
    document.querySelectorAll('.dashboard-menu li').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.dashboard-menu li').forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            
            const view = item.dataset.view;
            if (view === 'users') {
                loadAdminDashboard();
            } else if (view === 'all-products') {
                loadAllProductsAdmin();
            } else if (view === 'payments-report') {
                loadPaymentsReport();
            } else if (view === 'settings') {
                loadAdminSettings();
            }
        });
    });
}

async function loadAllProductsAdmin() {
    const adminContent = document.getElementById('adminContent');
    const products = await api.getAllProducts();
    
    adminContent.innerHTML = `
        <h3>All Products</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>SKU</th>
                        <th>Name</th>
                        <th>Seller</th>
                        <th>Price</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => `
                        <tr>
                            <td><img src="${product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/50'}" class="thumbnail"></td>
                            <td>${product.sku}</td>
                            <td>${product.name}</td>
                            <td>${product.sellerId}</td>
                            <td>₦${product.price}</td>
                            <td>${product.category}</td>
                            <td>${product.activityStatus}</td>
                            <td>${product.paymentStatus}</td>
                            <td>
                                <button onclick="adminToggleProductStatus('${product.sku}')" class="btn-small" style="background: ${product.activityStatus === 'Active' ? 'orange' : 'green'}">
                                    ${product.activityStatus === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onclick="adminDeleteProduct('${product.sku}')" class="btn-small" style="background: var(--primary-red);">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function loadPaymentsReport() {
    const adminContent = document.getElementById('adminContent');
    const payments = await api.getAllPayments();
    
    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + p.payAmount, 0);
    
    adminContent.innerHTML = `
        <h3>Payments Report</h3>
        <div class="summary-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="card" style="background: var(--light-gray); padding: 1rem; border-radius: 8px;">
                <h4>Total Payments</h4>
                <p style="font-size: 2rem; color: var(--primary-purple);">${payments.length}</p>
            </div>
            <div class="card" style="background: var(--light-gray); padding: 1rem; border-radius: 8px;">
                <h4>Total Amount</h4>
                <p style="font-size: 2rem; color: var(--primary-red);">₦${totalAmount.toLocaleString()}</p>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Product SKU</th>
                        <th>User ID</th>
                        <th>Amount</th>
                        <th>Payment Date</th>
                        <th>Reference</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(payment => `
                        <tr>
                            <td>${payment.productSKU}</td>
                            <td>${payment.userID}</td>
                            <td>₦${payment.payAmount}</td>
                            <td>${new Date(payment.paymentDate).toLocaleString()}</td>
                            <td>${payment.reference || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <button onclick="exportPaymentsReport()" class="btn" style="margin-top: 1rem;">
            <i class="fas fa-download"></i> Export Report
        </button>
    `;
}

function exportPaymentsReport() {
    // Implementation for exporting report (CSV)
    alert('Export functionality would be implemented here');
}

// Helper function to close modal
function closePaymentModal() {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
}
async function loadAdminSettings() {
    const adminContent = document.getElementById('adminContent');
    const admin = await api.getUserByUserId('admin01');
    
    adminContent.innerHTML = `
        <h3>System Settings</h3>
        <form id="settingsForm" class="form-container" style="max-width: none;">
            <h4>Payment Rates</h4>
            <div class="form-group">
                <label for="dailyRate">Daily Rate (₦)</label>
                <input type="number" id="dailyRate" value="${admin.dailyPayValue}" required>
            </div>
            <div class="form-group">
                <label for="weeklyRate">Weekly Rate (₦)</label>
                <input type="number" id="weeklyRate" value="${admin.weeklyPayValue}" required>
            </div>
            <div class="form-group">
                <label for="monthlyRate">Monthly Rate (₦)</label>
                <input type="number" id="monthlyRate" value="${admin.monthlyPayValue}" required>
            </div>
            
            <h4>Admin Password</h4>
            <div class="form-group">
                <label for="newPassword">New Password</label>
                <input type="password" id="newPassword">
            </div>
            <div class="form-group">
                <label for="confirmPassword">Confirm Password</label>
                <input type="password" id="confirmPassword">
            </div>
            
            <button type="submit" class="btn">Save Settings</button>
        </form>
    `;
    
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updates = {
            dailyPayValue: parseInt(document.getElementById('dailyRate').value),
            weeklyPayValue: parseInt(document.getElementById('weeklyRate').value),
            monthlyPayValue: parseInt(document.getElementById('monthlyRate').value)
        };
        
        const newPassword = document.getElementById('newPassword').value;
        if (newPassword) {
            const confirm = document.getElementById('confirmPassword').value;
            if (newPassword !== confirm) {
                alert('Passwords do not match');
                return;
            }
            updates.password = newPassword;
        }
        
        await api.updateUser('admin01', updates);
        alert('Settings updated successfully!');
    });
}

async function adminEditUser(userId) {
    const users = await api.getAllUsers();
    const user = users.find(u => u.userId === userId);
    
    if (!user) return;
    
    const adminContent = document.getElementById('adminContent');
    
    adminContent.innerHTML = `
        <h3>Edit User: ${user.userId}</h3>
        <form id="editUserForm" class="form-container" style="max-width: none;">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" value="${user.email}" required>
            </div>
            <div class="form-group">
                <label for="firstName">First Name</label>
                <input type="text" id="firstName" value="${user.firstName}" required>
            </div>
            <div class="form-group">
                <label for="lastName">Last Name</label>
                <input type="text" id="lastName" value="${user.lastName}" required>
            </div>
            <div class="form-group">
                <label for="telephone">Telephone</label>
                <input type="tel" id="telephone" value="${user.telephone}" required>
            </div>
            <div class="form-group">
                <label for="userGroup">User Group</label>
                <select id="userGroup">
                    <option value="0" ${user.userGroup === 0 ? 'selected' : ''}>Administrator</option>
                    <option value="1" ${user.userGroup === 1 ? 'selected' : ''}>Merchant/Seller</option>
                </select>
            </div>
            <div class="form-group">
                <label for="newPassword">New Password (leave blank to keep current)</label>
                <input type="password" id="newPassword">
            </div>
            <div class="form-group">
                <label for="dailyRate">Daily Rate (₦)</label>
                <input type="number" id="dailyRate" value="${user.dailyPayValue || 0}">
            </div>
            <div class="form-group">
                <label for="weeklyRate">Weekly Rate (₦)</label>
                <input type="number" id="weeklyRate" value="${user.weeklyPayValue || 0}">
            </div>
            <div class="form-group">
                <label for="monthlyRate">Monthly Rate (₦)</label>
                <input type="number" id="monthlyRate" value="${user.monthlyPayValue || 0}">
            </div>
            <button type="submit" class="btn">Update User</button>
        </form>
    `;
    
    document.getElementById('editUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updates = {
            email: document.getElementById('email').value,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            telephone: document.getElementById('telephone').value,
            userGroup: parseInt(document.getElementById('userGroup').value),
            dailyPayValue: parseInt(document.getElementById('dailyRate').value),
            weeklyPayValue: parseInt(document.getElementById('weeklyRate').value),
            monthlyPayValue: parseInt(document.getElementById('monthlyRate').value)
        };
        
        const newPassword = document.getElementById('newPassword').value;
        if (newPassword) {
            updates.password = newPassword;
        }
        
        await api.updateUser(userId, updates);
        alert('User updated successfully!');
        loadAdminDashboard();
    });
}

async function adminToggleUserStatus(userId) {
    const users = await api.getAllUsers();
    const user = users.find(u => u.userId === userId);
    
    if (user) {
        user.userActivityStatus = user.userActivityStatus === 1 ? 0 : 1;
        await api.updateUser(userId, { userActivityStatus: user.userActivityStatus });
        alert(`User ${user.userActivityStatus === 1 ? 'activated' : 'deactivated'} successfully!`);
        loadAdminDashboard();
    }
}

async function adminDeleteUser(userId) {
    if (userId === 'admin01') {
        alert('Cannot delete admin user!');
        return;
    }
    
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        await api.deleteUser(userId);
        alert('User deleted successfully!');
        loadAdminDashboard();
    }
}

async function adminToggleProductStatus(sku) {
    const products = await api.getAllProducts();
    const product = products.find(p => p.sku === sku);
    
    if (product) {
        product.activityStatus = product.activityStatus === 'Active' ? 'Inactive' : 'Active';
        await api.updateProduct(sku, { activityStatus: product.activityStatus });
        alert(`Product ${product.activityStatus === 'Active' ? 'activated' : 'deactivated'} successfully!`);
        loadAllProductsAdmin();
    }
}

async function adminDeleteProduct(sku) {
    if (confirm('Are you sure you want to delete this product?')) {
        await api.deleteProduct(sku);
        alert('Product deleted successfully!');
        loadAllProductsAdmin();
    }
}

function showAboutModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>About GiTeksol Market Hub</h2>
            <p>GiTeksol Market Hub is your premier online marketplace connecting buyers and sellers across various categories.</p>
            <p>Our mission is to give you the right visibility and facilitate smooth sales and purchases.</p>
            <h3>Contact Information</h3>
            <p><i class="fas fa-envelope"></i> geocorpsys@gmail.com</p>
            <p><i class="fas fa-phone"></i> 090 38 1975 86</p>
            <p><i class="fas fa-map-marker-alt"></i> Lagos, Nigeria</p>
        </div>
    `;
    document.body.appendChild(modal);
}


async function testPreflight() {
    try {
        const response = await fetch('https://api.jsonbin.io/v3/b/69b1d79bc3097a1dd5194d91', {
            method: 'OPTIONS',
            headers: {
                'Origin': window.location.origin,
                'Access-Control-Request-Method': 'PUT',
                'Access-Control-Request-Headers': 'content-type,x-master-key,x-access-key,x-bin-meta'
            }
        });
        console.log('Preflight response status:', response.status);
        console.log('Preflight response headers:', [...response.headers.entries()]);
    } catch (error) {
        console.error('Preflight failed:', error);
    }
}
// Call this function after your app initializes
// testPreflight(); 



// Make functions globally available
window.showAuthForm = showAuthForm;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.payForAdvert = payForAdvert;
window.processExistingPayment = processExistingPayment;
window.handleImageUpload = handleImageUpload;
window.sendChatMessage = sendChatMessage;
window.adminEditUser = adminEditUser;
window.adminToggleUserStatus = adminToggleUserStatus;
window.adminDeleteUser = adminDeleteUser;
window.adminToggleProductStatus = adminToggleProductStatus;
window.adminDeleteProduct = adminDeleteProduct;
window.exportPaymentsReport = exportPaymentsReport;

window.selectPaymentType = selectPaymentType;
window.closePaymentModal = closePaymentModal;

window.performSearch = performSearch;
window.clearSearch = clearSearch;

// Make closeMobileMenu globally available
window.closeMobileMenu = closeMobileMenu;

window.goToHome = goToHome;
window.createNewAd = createNewAd;

// Make image upload functions globally available
window.removeImage = removeImage;
window.resetUploadedImages = resetUploadedImages;
