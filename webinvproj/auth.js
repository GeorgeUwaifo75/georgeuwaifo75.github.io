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
    errorMessage.innerHTML = '';
    
    // Clear any previous signup button
    const existingSignupBtn = document.getElementById('signupButton');
    if (existingSignupBtn) {
        existingSignupBtn.remove();
    }
    
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
            // Login failed - determine the reason
            let errorType = '';
            let errorDetails = '';
            
            if (!userID) {
                errorType = 'empty_userid';
                errorDetails = 'Please enter your User ID';
            } else if (!password) {
                errorType = 'empty_password';
                errorDetails = 'Please enter your password';
            } else if (!user) {
                errorType = 'user_not_found';
                errorDetails = `User ID "${userID}" not found`;
            } else {
                errorType = 'wrong_password';
                errorDetails = 'Incorrect password';
            }
            
            // Show error message with signup option
            this.showLoginError(errorType, errorDetails, userID);
            return;
        }
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Show generic error
        this.showLoginError('general_error', 'Login failed. Please try again.', userID);
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
    const errorMessage = document.getElementById('errorMessage');
    
    // Hide login form
    loginBox.style.display = 'none';
    
    // Hide error message
    if (errorMessage) {
        errorMessage.style.display = 'none';
        errorMessage.innerHTML = '';
    }
    
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
            errorElement.textContent = `Creating new account for: ${userID}`;
            errorElement.style.display = 'block';
            errorElement.style.backgroundColor = '#e3f2fd';
            errorElement.style.color = '#1565c0';
            errorElement.style.border = '1px solid #bbdefb';
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
    
    
// Add this method to AuthManager class in auth.js:
showLoginError(errorType, errorMessage, userID = '') {
    const errorElement = document.getElementById('errorMessage');
    if (!errorElement) return;
    
    let errorTitle = 'Login Failed';
    let errorDetails = errorMessage;
    let showSignupButton = false;
    
    // Customize based on error type
    switch(errorType) {
        case 'user_not_found':
            errorTitle = 'Account Not Found';
            errorDetails = `No account found with User ID: "${userID}"`;
            showSignupButton = true;
            break;
            
        case 'wrong_password':
            errorTitle = 'Incorrect Password';
            errorDetails = 'The password you entered is incorrect. Please try again.';
            break;
            
        case 'empty_userid':
            errorTitle = 'User ID Required';
            errorDetails = 'Please enter your User ID to continue.';
            break;
            
        case 'empty_password':
            errorTitle = 'Password Required';
            errorDetails = 'Please enter your password to continue.';
            break;
            
        case 'general_error':
            errorTitle = 'Login Error';
            errorDetails = errorMessage;
            break;
    }
    
    // Create error HTML
    errorElement.innerHTML = `
        <div class="login-error-container">
            <div class="error-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                <div class="error-icon" style="background: #e74c3c; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                    !
                </div>
                <h3 style="color: #e74c3c; margin: 0; font-size: 1.1em;">${errorTitle}</h3>
            </div>
            
            <div class="error-details" style="color: #7f8c8d; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #e74c3c;">
                ${errorDetails}
            </div>
            
            ${showSignupButton ? `
                <div class="error-actions" style="display: flex; gap: 10px; align-items: center;">
                    <button type="button" class="btn-secondary" onclick="auth.retryLogin()" style="flex: 1; padding: 12px;">
                        <span style="margin-right: 5px;">↻</span> Try Again
                    </button>
                    <button type="button" class="btn-primary" id="signupButton" onclick="auth.showRegistrationForm('${userID}')" style="flex: 1; padding: 12px;">
                        <span style="margin-right: 5px;">👤</span> Sign Up Instead
                    </button>
                </div>
            ` : `
                <div class="error-actions" style="display: flex; gap: 10px;">
                    <button type="button" class="btn-primary" onclick="auth.retryLogin()" style="flex: 1; padding: 12px;">
                        <span style="margin-right: 5px;">↻</span> Try Again
                    </button>
                </div>
            `}
        </div>
    `;
    
    errorElement.style.display = 'block';
    
    // Focus on the appropriate field
    setTimeout(() => {
        if (errorType === 'empty_userid' || errorType === 'user_not_found') {
            document.getElementById('userID').focus();
        } else if (errorType === 'empty_password' || errorType === 'wrong_password') {
            document.getElementById('password').focus();
        }
    }, 100);
}    


// Add this method to AuthManager class in auth.js:
retryLogin() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.style.display = 'none';
        errorMessage.innerHTML = '';
    }
    
    // Clear any signup button
    const existingSignupBtn = document.getElementById('signupButton');
    if (existingSignupBtn) {
        existingSignupBtn.remove();
    }
    
    // Clear only the password field for retry
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
}
    
}

// Create global Auth instance
const auth = new AuthManager();
