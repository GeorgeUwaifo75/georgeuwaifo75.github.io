// Authentication Module
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const registrationForm = document.getElementById('registrationForm');
        if (registrationForm) {
            registrationForm.addEventListener('submit', (e) => this.handleRegistration(e));
        }

        const backToLoginBtn = document.getElementById('backToLogin');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => this.showLoginForm());
        }

        // Check if user is already logged in
        this.checkSession();
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const userID = document.getElementById('userID').value.trim();
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');

        // Clear previous errors
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';

        try {
            // Get all users
            const data = await api.getData();
            const user = data.users.find(u => u.userID === userID);

            // Check credentials
            if (user && user.password === password) {
                // Successful login - update last login time
                await api.updateUser(userID, { lastLogin: new Date().toISOString() });
                
                // Set session
                this.setSession(user);
                window.location.href = 'dashboard.html';
            } else if (userID === 'tmp101' && password === '12345') {
                // Demo user login
                const demoUser = {
                    userID: 'tmp101',
                    fullName: 'Demo Test User',
                    wallet: 5000.00,
                    inventoryBinId: 'inventory_tmp101',
                    salesBinId: 'sales_tmp101',
                    purchasesBinId: 'purchases_tmp101'
                };
                this.setSession(demoUser);
                window.location.href = 'dashboard.html';
            } else {
                // Check if user exists
                if (user) {
                    // User exists but wrong password
                    throw new Error('Invalid password');
                } else {
                    // User doesn't exist - show registration form
                    this.showRegistrationForm(userID);
                    return;
                }
            }
        } catch (error) {
            if (error.message === 'User ID already exists') {
                this.showRegistrationForm(userID, true);
            } else {
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            }
        }
    }

  async handleRegistration(event) {
    event.preventDefault();
 
    const newUserID = document.getElementById('newUserID').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const fullName = document.getElementById('fullName').value.trim();
    // REMOVED: const initialBalance = parseFloat(document.getElementById('initialBalance').value) || 0;
 
    const errorElement = document.getElementById('registrationError');
    const successElement = document.getElementById('registrationSuccess');
 
    // Clear previous messages
    errorElement.style.display = 'none';
    errorElement.textContent = '';
    successElement.style.display = 'none';
    successElement.innerHTML = '';
 
    // Validate form
    if (!newUserID || !newPassword || !fullName) {
        errorElement.textContent = 'Please fill in all required fields';
        errorElement.style.display = 'block';
        return;
    }
 
    if (newPassword !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        errorElement.style.display = 'block';
        return;
    }
 
    if (newPassword.length < 4) {
        errorElement.textContent = 'Password must be at least 4 characters long';
        errorElement.textContent = 'Password must be at least 4 characters long';
        errorElement.style.display = 'block';
        return;
    }
 
    try {
        // Check if user already exists
        const userExists = await api.userExists(newUserID);
        if (userExists) {
            errorElement.textContent = 'User ID already exists. Please choose a different one.';
            errorElement.style.display = 'block';
            return;
        }
 
        // Create new user object
        const newUser = {
            userID: newUserID,
            password: newPassword,
            fullName: fullName,
            // REMOVED: wallet: initialBalance - Now defaults to 0 in createUser()
        };
 
        // Save user to JSONBin.io (this will also create bins)
        const createdUser = await api.createUser(newUser);
     
        // Show success message with bin information
         successElement.innerHTML = `
            <div class="registration-success">
                <h3>🎉 Account Created Successfully!</h3>
                <p>Your account has been created with unique storage bins.</p>
                <div class="user-created-info">
                    <p><strong>User ID:</strong> ${createdUser.userID}</p>
                    <p><strong>Full Name:</strong> ${createdUser.fullName}</p>
                    <p><strong>Initial Wallet Balance:</strong> ₦${createdUser.wallet.toFixed(2)}</p>
                    <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px;">
                        <p><strong>⚠️ Next Step:</strong> Complete your business information after login.</p>
                        <p>You'll be redirected to update your business details.</p>
                    </div>
                </div>
            </div>
        `;

        successElement.style.display = 'block';
 
        // Clear form
        document.getElementById('registrationForm').reset();
 
        // Auto-login the new user after 3 seconds
        setTimeout(() => {
            this.setSession(createdUser);
            window.location.href = 'dashboard.html';
        }, 3000);
 
    } catch (error) {
        console.error('Registration error:', error);
        errorElement.textContent = 'Error creating account: ' + error.message;
        errorElement.style.display = 'block';
    }
}

    showRegistrationForm(userID = '', userExists = false) {
        const loginBox = document.getElementById('loginBox');
        const registrationBox = document.getElementById('registrationBox');
        
        // Hide login form
        loginBox.style.display = 'none';
        
        // Show registration form
        registrationBox.style.display = 'block';
        
        // Pre-fill user ID if provided
        if (userID) {
            document.getElementById('newUserID').value = userID;
            
            // If user exists, show appropriate message
            if (userExists) {
                const errorElement = document.getElementById('registrationError');
                errorElement.textContent = 'This user ID already exists. Please choose a different one or login with the correct password.';
                errorElement.style.display = 'block';
            } else {
                const errorElement = document.getElementById('registrationError');
                errorElement.textContent = 'User not found. Please create a new account with unique storage bins.';
                errorElement.style.display = 'block';
            }
        }
    }

    showLoginForm() {
        const loginBox = document.getElementById('loginBox');
        const registrationBox = document.getElementById('registrationBox');
        
        // Hide registration form
        registrationBox.style.display = 'none';
        
        // Show login form
        loginBox.style.display = 'block';
        
        // Clear any messages
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('registrationError').style.display = 'none';
        document.getElementById('registrationSuccess').style.display = 'none';
        
        // Clear login form
        document.getElementById('loginForm').reset();
    }

    setSession(user) {
        this.currentUser = user;
        localStorage.setItem('webstarng_user', JSON.stringify(user));
        localStorage.setItem('webstarng_token', 'auth_token_' + Date.now());
    }

    checkSession() {
        const token = localStorage.getItem('webstarng_token');
        const user = localStorage.getItem('webstarng_user');
        
        if (token && user) {
            this.currentUser = JSON.parse(user);
            
            // If on login page but already logged in, redirect to dashboard
            if (window.location.pathname.includes('index.html') || 
                window.location.pathname === '/') {
                window.location.href = 'dashboard.html';
            }
        } else if (window.location.pathname.includes('dashboard.html')) {
            // If on dashboard but not logged in, redirect to login
            window.location.href = 'index.html';
        }
    }

    logout() {
        localStorage.removeItem('webstarng_user');
        localStorage.removeItem('webstarng_token');
        this.currentUser = null;
        window.location.href = 'index.html';
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Create global Auth instance
const auth = new AuthManager();
