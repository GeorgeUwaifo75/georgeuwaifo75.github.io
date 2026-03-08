// app.js
let pendingProductData = null; // Store product data while processing payment

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
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    
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


/*
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
        
         // Initialize EmailJS (add this line)
        initializeEmailJS();
        
        // Initialize admin user
        await api.initializeAdmin();
        
        
        // ADD THIS: Hide New Ad menu initially (will be shown if user is merchant)
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
        initializeAuthForms(); // Now this exists
        
        
        // ADD THIS: Initialize search
        initializeSearch();
        addSearchStyles();
        
        // Load categories
        loadCategories();

        // Hamburger menu toggle
        const hamburger = document.getElementById('hamburger');
        if (hamburger) {
            hamburger.addEventListener('click', () => {
                document.getElementById('navMenu').classList.toggle('active');
            });
        }
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Error initializing application. Please check the console for details.');
    }
});
*/

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
    
    // Sample category images (updated with new category name)
    const categoryImages = {
        'All Business types': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/supermarket.png', // Using same image
        'Computing and Electronics': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/computer%20electronics.png',
        'Computer Services': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/A%20computer%20services.png',
        'Household Products': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/household%20products.png',
        'Wholesale food commodities': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/food%20commodities.png',
        'Printing and Publishing': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/printing%20and%20publishing.png',
        'Automobiles': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/automobiles.png',
        'Food services': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/food%20services.png',
        'Furniture and others': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/furniture%20business.png',
        'Rentals and Properties': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/props%20and%20real%20estate.png' 
    };

    CATEGORIES.forEach(category => {
        // Add to grid
        const card = document.createElement('div');
        card.className = 'category-card';
        
        // Create a safe ID by replacing spaces and special characters
        const safeCategoryId = category.replace(/[&\s]+/g, '-').toLowerCase();
        
        card.innerHTML = `
            <img src="${categoryImages[category]}" alt="${category}" class="category-image">
            <div class="category-info">
                <div class="category-name">${category}</div>
                <div class="category-count" id="count-${safeCategoryId}">Loading...</div>
                <span class="notification-badge" id="notif-${safeCategoryId}" style="display: none;">0</span>
            </div>
        `;
        card.addEventListener('click', () => loadProductsByCategory(category));
        categoriesGrid.appendChild(card);

        // Add to dropdown
        const li = document.createElement('li');
        li.innerHTML = `<a href="#" class="dropdown-item" data-category="${category}">${category}</a>`;
        li.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            loadProductsByCategory(category);
        });
        dropdown.appendChild(li);
    });

    // Load category counts
    updateCategoryCounts();
}



/*
async function updateCategoryCounts() {
    const products = await api.getAllProducts();
    
    CATEGORIES.forEach(category => {
        const count = products.filter(p => p.category === category && p.activityStatus === 'Active').length;
        
        // Create a safe ID by replacing spaces and special characters
        const safeCategoryId = category.replace(/[&\s]+/g, '-');
        const countElement = document.getElementById(`count-${safeCategoryId}`);
        
        if (countElement) {
            countElement.textContent = `${count} ads`;
        }
    });
}*/

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

async function loadProductsByCategory(category) {
    const products = await api.getProductsByCategory(category);
    const productsGrid = document.getElementById('productsGrid');
    const categoryTitle = document.getElementById('currentCategoryTitle');
    
    categoryTitle.textContent = category;
    productsGrid.innerHTML = '';
    
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="text-center">No products in this category yet.</p>';
    } else {
        products.sort((a, b) => new Date(b.dateAdvertised) - new Date(a.dateAdvertised));
        
        products.forEach(product => {
            const card = createProductCard(product);
            productsGrid.appendChild(card);
        });
    }
    
    showSection('productsSection');
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

/*
function updateUIForUser(user) {
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('displayName').textContent = user.firstName;
    document.getElementById('signinLink').style.display = 'none';
    document.getElementById('signupLink').style.display = 'none';
    
    // ADD THIS: Show/hide New Ad menu based on user type
    const newAdLink = document.getElementById('newAdLink');
    if (newAdLink) {
        // Show New Ad for merchants (group 1), hide for admins (group 0)
        newAdLink.style.display = user.userGroup === 1 ? 'inline-block' : 'none';
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
 */

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
                            <td>₦${product.price}</td>
                            <td>${product.activityStatus}</td>
                            <td>${product.paymentStatus}</td>
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
}


// New helper function to collect images
/*
async function collectImages() {
    const previewContainers = document.querySelectorAll('#imagePreview div');
    const images = [];
    
    for (const container of previewContainers) {
        const img = container.querySelector('img');
        if (img) {
            images.push(img.src);
        }
    }
    
    if (images.length < 4) {
        alert(`Please upload at least 4 images. Currently have ${images.length}`);
        return null;
    }
    
    return images;
}*/

async function collectImages() {
    const previewContainers = document.querySelectorAll('#imagePreview div');
    const images = [];
    let totalSize = 0;
    
    for (const container of previewContainers) {
        const img = container.querySelector('img');
        if (img) {
            images.push(img.src);
            // Approximate size calculation
            totalSize += (img.src.length * 0.75) / 1024 / 1024;
        }
    }
    
    if (images.length < 4) {
        alert(`Please upload at least 4 images. Currently have ${images.length}`);
        return null;
    }
    
    // Check total payload size (JSONBin.io limit is ~10MB, leave margin)
    if (totalSize > 9) {
        alert(`Total image size (${totalSize.toFixed(1)}MB) exceeds the limit. Please use smaller images or lower quality.`);
        return null;
    }
    
    console.log(`Total payload size: ${totalSize.toFixed(2)}MB`);
    return images;
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
                <label for="productDescription">Description</label>
                <textarea id="productDescription" rows="4" required></textarea>
            </div>
            <div class="form-group">
                <label for="productPrice">Price (₦)</label>
                <input type="number" id="productPrice" required>
            </div>
            <div class="form-group">
                <label for="productImages">Images (at least 4)</label>
                <input type="file" id="productImages" multiple accept="image/*" onchange="handleImageUpload(this)">
                <div id="imagePreview" class="product-images-grid" style="margin-top: 1rem;"></div>
                <small id="imageCount" style="color: red;">0 of 4 images uploaded</small>
                <!-- ADD THIS: Size warning element -->
                <div id="sizeWarning" style="color: orange; margin-top: 5px; font-size: 0.85rem; display: none;"></div>
                
                
            </div>
            <button type="submit" class="btn" id="submitProductBtn">Add Product</button>
        </form>
    `;
    
    // Update image count
    document.getElementById('productImages').addEventListener('change', function() {
        const count = this.files.length;
        const imageCount = document.getElementById('imageCount');
        imageCount.textContent = `${count} of 4 images uploaded`;
        imageCount.style.color = count >= 4 ? 'green' : 'red';
    });
    
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
            const previews = document.querySelectorAll('#imagePreview img');
            if (previews.length < 4) {
                alert(`Please upload at least 4 images. Currently have ${previews.length}`);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Product';
                return;
            }
            
            // Get user's existing products count
            const userProducts = await api.getProductsBySeller(auth.currentUser.userId);
            const userAdvertCount = userProducts.length;
            
            console.log(`User has ${userAdvertCount} existing products`);
            
            // Collect images
            const images = [];
            previews.forEach(img => images.push(img.src));
            
            // Prepare product data
            const productData = {
                name: document.getElementById('productName').value,
                category: document.getElementById('productCategory').value,
                description: document.getElementById('productDescription').value,
                price: document.getElementById('productPrice').value,
                images: images
            };
            
            if (userAdvertCount < 2) {
                // Free advert - first or second product
                console.log('Creating free product...');
                const product = await createProduct('free', productData);
                
                if (product) {
                    alert('✅ Product added successfully as free advert! It will be active for 14 days.');
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
            alert('Error creating product: ' + error.message);
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


// Fixed createProduct function with complete data structure
async function createProduct(paymentStatus, productData = null, paymentType = null) {
    try {
        let images = [];
        let name, category, description, price;
        
        if (productData) {
            // Use provided product data
            name = productData.name;
            category = productData.category;
            description = productData.description;
            price = productData.price;
            images = productData.images;
        } else {
            // Collect from form
            images = await collectImages();
            if (!images) return null;
            
            name = document.getElementById('productName').value;
            category = document.getElementById('productCategory').value;
            description = document.getElementById('productDescription').value;
            price = document.getElementById('productPrice').value;
        }
        
        // Validate inputs
        if (!name || !category || !description || !price || images.length < 4) {
            throw new Error('Missing required fields or insufficient images');
        }
        
        const now = new Date();
        let endDate = null;
        
        // Calculate end date based on payment status and type
        if (paymentStatus === 'free') {
            endDate = new Date();
            endDate.setDate(endDate.getDate() + 14); // 2 weeks for free products
        } else if (paymentStatus === 'paid' && paymentType) {
            endDate = new Date();
            switch(paymentType) {
                case 'daily':
                    endDate.setDate(endDate.getDate() + 1);
                    break;
                case 'weekly':
                    endDate.setDate(endDate.getDate() + 7);
                    break;
                case 'monthly':
                    endDate.setMonth(endDate.getMonth() + 1);
                    break;
                default:
                    endDate.setDate(endDate.getDate() + 7); // Default to 1 week
            }
        }
        
        // Prepare product data with complete structure
        const productDataObj = {
            name: name,
            description: description,
            price: parseFloat(price),
            category: category,
            images: images,
            sellerId: auth.currentUser.userId,
            sellerName: `${auth.currentUser.firstName} ${auth.currentUser.lastName}`,
            sellerContact: auth.currentUser.telephone,
            paymentStatus: paymentStatus,
            paymentType: paymentType,
            activityStatus: (paymentStatus === 'free' || paymentStatus === 'paid') ? 'Active' : 'Inactive',
            endDate: endDate ? endDate.toISOString() : null
        };
        
        console.log('Creating product with data:', productDataObj);
        
        // Save to database
        const createdProduct = await api.createProduct(productDataObj);
        
        console.log('Product created successfully:', createdProduct);
        return createdProduct;
        
    } catch (error) {
        console.error('Error in createProduct:', error);
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

/*
async function compressImage(base64String, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64String;
        
        img.onload = () => {
            // Create canvas for resizing
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round(width * (maxHeight / height));
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw resized image
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to compressed JPEG
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
        
        img.onerror = (error) => {
            reject(error);
        };
    });
}*/
// Enhanced image compression with better defaults
async function compressImage(base64String, maxWidth = 800, maxHeight = 800, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64String;
        
        img.onload = () => {
            // Create canvas for resizing
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // More aggressive resizing for large images
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round(width * (maxHeight / height));
                    height = maxHeight;
                }
            }
            
            // Further reduce if image is still large (over 1MP)
            const megaPixels = (width * height) / 1000000;
            if (megaPixels > 0.5) { // If over 0.5 megapixels
                const scale = Math.sqrt(0.5 / megaPixels);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw resized image
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to compressed JPEG with quality based on size
            let finalQuality = quality;
            if (megaPixels > 1) finalQuality = 0.5;
            if (megaPixels > 2) finalQuality = 0.4;
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', finalQuality);
            resolve(compressedBase64);
        };
        
        img.onerror = (error) => {
            reject(error);
        };
    });
}

// Enhanced image upload handler with size monitoring
async function handleImageUpload(input) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    const files = Array.from(input.files);
    
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-spinner';
    loadingDiv.style.cssText = 'text-align: center; padding: 20px;';
    loadingDiv.innerHTML = 'Compressing images...';
    preview.appendChild(loadingDiv);
    
    const compressedImages = [];
    let totalSize = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size first (warn if too large)
        if (file.size > 5 * 1024 * 1024) { // 5MB
            console.log(`Image ${file.name} is large (${(file.size/1024/1024).toFixed(1)}MB). Will compress aggressively.`);
        }
        
        // Read file as base64
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
        
        try {
            // Calculate original size
            const originalSize = (base64.length * 0.75) / 1024 / 1024; // Approximate MB
            
            // Compress image with dynamic settings based on size
            let compressed;
            if (originalSize > 2) {
                compressed = await compressImage(base64, 600, 600, 0.4); // More compression for large images
            } else if (originalSize > 1) {
                compressed = await compressImage(base64, 700, 700, 0.5);
            } else {
                compressed = await compressImage(base64, 800, 800, 0.6);
            }
            
            compressedImages.push(compressed);
            
            // Calculate compressed size
            const newSize = (compressed.length * 0.75) / 1024 / 1024;
            totalSize += newSize;
            
            // Show preview with size info
            const img = document.createElement('img');
            img.src = compressed;
            img.style.width = '100px';
            img.style.height = '100px';
            img.style.objectFit = 'cover';
            img.style.margin = '5px';
            img.style.border = '2px solid #ddd';
            img.style.borderRadius = '5px';
            
            // Show file size info with color coding
            const sizeInfo = document.createElement('small');
            sizeInfo.style.cssText = 'display: block; color: #666; font-size: 10px;';
            sizeInfo.textContent = `${originalSize.toFixed(1)}MB → ${newSize.toFixed(1)}MB`;
            
            const container = document.createElement('div');
            container.style.cssText = 'display: inline-block; text-align: center; margin: 5px;';
            container.appendChild(img);
            container.appendChild(sizeInfo);
            
            preview.appendChild(container);
            
        } catch (error) {
            console.error('Error compressing image:', error);
            alert(`Error compressing image ${file.name}. Please try another image.`);
        }
    }
    
    // Remove loading indicator
    if (loadingDiv.parentNode) {
        loadingDiv.remove();
    }
    
    // Update image count and show total size
    const imageCount = document.getElementById('imageCount');
    if (imageCount) {
        imageCount.textContent = `${compressedImages.length} of 4 images uploaded (Total: ${totalSize.toFixed(1)}MB)`;
        imageCount.style.color = compressedImages.length >= 4 ? 'green' : 'red';
        
        // Show warning if total size is still large
        if (totalSize > 8) {
            const sizeWarning = document.getElementById('sizeWarning') || document.createElement('div');
            sizeWarning.id = 'sizeWarning';
            sizeWarning.style.cssText = 'color: orange; margin-top: 5px; font-size: 0.85rem;';
            sizeWarning.innerHTML = `⚠️ Total size (${totalSize.toFixed(1)}MB) is approaching the limit. Consider using smaller images.`;
            preview.appendChild(sizeWarning);
        }
    }
    
    return compressedImages;
}


async function handleImageUpload(input) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    const files = Array.from(input.files);
    
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-spinner';
    loadingDiv.style.cssText = 'text-align: center; padding: 20px;';
    loadingDiv.innerHTML = 'Compressing images...';
    preview.appendChild(loadingDiv);
    
    const compressedImages = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size first (warn if too large)
        if (file.size > 5 * 1024 * 1024) { // 5MB
            alert(`Image ${file.name} is larger than 5MB. It will be compressed.`);
        }
        
        // Read file as base64
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
        
        try {
            // Compress image
            const compressed = await compressImage(base64, 600, 600, 0.6);
            compressedImages.push(compressed);
            
            // Show preview
            const img = document.createElement('img');
            img.src = compressed;
            img.style.width = '100px';
            img.style.height = '100px';
            img.style.objectFit = 'cover';
            img.style.margin = '5px';
            img.style.border = '2px solid #ddd';
            img.style.borderRadius = '5px';
            
            // Show file size info
            const originalSize = (base64.length * 0.75) / 1024 / 1024; // Approximate MB
            const newSize = (compressed.length * 0.75) / 1024 / 1024;
            const sizeInfo = document.createElement('small');
            sizeInfo.style.cssText = 'display: block; color: #666; font-size: 10px;';
            sizeInfo.textContent = `${originalSize.toFixed(1)}MB → ${newSize.toFixed(1)}MB`;
            
            const container = document.createElement('div');
            container.style.cssText = 'display: inline-block; text-align: center; margin: 5px;';
            container.appendChild(img);
            container.appendChild(sizeInfo);
            
            preview.appendChild(container);
        } catch (error) {
            console.error('Error compressing image:', error);
            alert(`Error compressing image ${file.name}. Please try another image.`);
        }
    }
    
    // Remove loading indicator
    if (loadingDiv.parentNode) {
        loadingDiv.remove();
    }
    
    // Update image count
    const imageCount = document.getElementById('imageCount');
    if (imageCount) {
        imageCount.textContent = `${compressedImages.length} of 4 images uploaded (compressed)`;
        imageCount.style.color = compressedImages.length >= 4 ? 'green' : 'red';
    }
    
    return compressedImages;
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
