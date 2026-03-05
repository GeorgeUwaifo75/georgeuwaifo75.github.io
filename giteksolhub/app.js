// app.js

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
        
        // Initialize admin user
        await api.initializeAdmin();
        
        // Check for existing session
        const user = auth.checkSession();
        if (user) {
            updateUIForUser(user);
        }

        // Initialize UI components
        initializeNavigation();
        initializeCategories();
        initializeAuthForms(); // Now this exists
        
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

function initializeCategories() {
    const categoriesGrid = document.getElementById('categoriesGrid');
    const dropdown = document.getElementById('categoriesDropdown');
    
    // Sample category images (you can replace with actual images)
    const categoryImages = {
        'Supermarkets': 'https://uploads.onecompiler.io/42trk4zn7/44f6rhm72/supermarket.png',
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
        card.innerHTML = `
            <img src="${categoryImages[category]}" alt="${category}" class="category-image">
            <div class="category-info">
                <div class="category-name">${category}</div>
                <div class="category-count" id="count-${category}">Loading...</div>
                <span class="notification-badge" id="notif-${category}" style="display: none;">0</span>
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




async function updateCategoryCounts() {
    const products = await api.getAllProducts();
    
    CATEGORIES.forEach(category => {
        const count = products.filter(p => p.category === category && p.activityStatus === 'Active').length;
        document.getElementById(`count-${category}`).textContent = `${count} ads`;
        
        // Show notification if there are new products (you can implement this logic)
        if (count > 0) {
            const notif = document.getElementById(`notif-${category}`);
            // notif.style.display = 'flex';
            // notif.textContent = Math.floor(Math.random() * 5); // Random for demo
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
    const products = await api.getAllProducts();
    const product = products.find(p => p.sku === sku);
    
    if (!product) return;
    
    const seller = await api.getUserByUserId(product.sellerId);
    const detailContainer = document.getElementById('productDetail');
    
    detailContainer.innerHTML = `
        <div class="product-detail-container">
            <h2>${product.name}</h2>
            <p class="product-sku">SKU: ${product.sku}</p>
            
            <div class="product-images-grid">
                ${product.images ? product.images.map(img => 
                    `<img src="${img}" alt="${product.name}" loading="lazy">`
                ).join('') : '<p>No images available</p>'}
            </div>
            
            <div class="product-description">
                <h3>Description</h3>
                <p>${product.description}</p>
            </div>
            
            <div class="product-price-large">
                <h3>Price</h3>
                <p class="price">₦${product.price}</p>
            </div>
            
            <div class="seller-info">
                <h3>Seller Information</h3>
                <p><strong>Name:</strong> ${seller ? seller.firstName + ' ' + seller.lastName : 'Unknown'}</p>
                <p><strong>Contact:</strong> ${seller ? seller.telephone : 'N/A'}</p>
            </div>
            
            <div class="chat-section">
                <h3>Chat with Seller</h3>
                <div class="chat-messages" id="chatMessages">
                    ${product.chats ? product.chats.map(chat => `
                        <div class="chat-message ${chat.sender === auth.currentUser?.userId ? 'own-message' : ''}">
                            <span class="sender">${chat.sender}</span>
                            <span class="time">${new Date(chat.timestamp).toLocaleString()}</span>
                            <p>${chat.message}</p>
                        </div>
                    `).join('') : '<p>No messages yet</p>'}
                </div>
                
                ${auth.currentUser ? `
                    <div class="chat-input">
                        <textarea id="chatMessageInput" placeholder="Type your message..." rows="2"></textarea>
                        <button onclick="sendChatMessage('${product.sku}')">Send</button>
                    </div>
                ` : '<p>Please <a href="#" onclick="showAuthForm(\'signin\')">sign in</a> to chat with the seller.</p>'}
            </div>
        </div>
    `;
    
    showSection('productDetailSection');
}

async function sendChatMessage(sku) {
    const messageInput = document.getElementById('chatMessageInput');
    const message = messageInput.value.trim();
    
    if (!message || !auth.currentUser) return;
    
    const products = await api.getAllProducts();
    const product = products.find(p => p.sku === sku);
    
    if (product) {
        if (!product.chats) product.chats = [];
        
        product.chats.push({
            sender: auth.currentUser.userId,
            message: message,
            timestamp: new Date().toISOString(),
            read: false
        });
        
        await api.updateProduct(sku, product);
        messageInput.value = '';
        loadProductDetail(sku); // Reload to show new message
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
                <label for="productImages">Images (at least 4, will be compressed automatically)</label>
                <input type="file" id="productImages" multiple accept="image/*" onchange="handleImageUpload(this)">
                <small style="display: block; margin-top: 5px; color: #666;">
                    Images will be compressed to reduce size. Max total size: 8MB after compression.
                </small>
                <div id="imagePreview" class="product-images-grid" style="margin-top: 1rem; min-height: 120px; border: 2px dashed #ccc; padding: 10px; border-radius: 5px;"></div>
                <div id="imageCount" style="margin-top: 5px; font-weight: bold; color: red;">0 of 4 images uploaded</div>
                <div id="sizeWarning" style="margin-top: 5px; color: orange; display: none;"></div>
            </div>
            <button type="submit" class="btn" id="submitProductBtn">Add Product</button>
        </form>
    `;
    
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitProductBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        
        try {
            if (!auth.currentUser) {
                alert('Please login first');
                return;
            }
            
            const previews = document.querySelectorAll('#imagePreview div');
            if (previews.length < 4) {
                alert(`Please upload at least 4 images. Currently have ${previews.length}`);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Product';
                return;
            }
            
            // Get user's product count
            const userProducts = await api.getProductsBySeller(auth.currentUser.userId);
            const userAdvertCount = userProducts.length;
            
            console.log(`User has ${userAdvertCount} products`);
            
            if (userAdvertCount < 2) {
                // Free advert
                console.log('Creating free product...');
                const product = await createProduct('free');
                if (product) {
                    alert('Product added successfully as free advert!');
                    loadUserDashboard();
                }
            } else {
                // Paid advert
                console.log('Showing payment options...');
                const images = await collectImages();
                if (images) {
                    const productData = {
                        name: document.getElementById('productName').value,
                        category: document.getElementById('productCategory').value,
                        description: document.getElementById('productDescription').value,
                        price: document.getElementById('productPrice').value,
                        images: images
                    };
                    showPaymentOptionsWithProductData(productData);
                }
            }
        } catch (error) {
            console.error('Error:', error);
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


// Update createProduct function to validate total payload size
async function createProduct(paymentStatus, productData = null) {
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
        
        // Validate total payload size
        const totalSize = images.reduce((sum, img) => sum + img.length, 0);
        const totalSizeMB = (totalSize * 0.75) / 1024 / 1024; // Approximate MB
        
        console.log(`Total payload size: ~${totalSizeMB.toFixed(2)}MB`);
        
        if (totalSizeMB > 8) { // Leave some margin under 10MB limit
            alert(`Total image size (${totalSizeMB.toFixed(2)}MB) is too large. Please use smaller images or lower compression.`);
            return null;
        }
        
        const productDataObj = {
            name: name,
            description: description,
            price: parseFloat(price),
            category: category,
            images: images,
            sellerId: auth.currentUser.userId,
            sellerName: `${auth.currentUser.firstName} ${auth.currentUser.lastName}`,
            sellerContact: auth.currentUser.telephone,
            paymentStatus: paymentStatus
        };
        
        console.log('Sending product data to API...');
        const createdProduct = await api.createProduct(productDataObj);
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

