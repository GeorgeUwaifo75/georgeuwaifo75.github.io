// Main Application Module
class WebStarNgApp {
    constructor() {
        this.init();
    }

    async init() {
        this.checkAuth();
        this.loadUserData();
        this.setupEventListeners();
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
        // Update all user information elements
        const elements = {
            'currentUser': user.userID,
            'userFullName': user.fullName,
            'userIdDisplay': user.userID,
            'walletBalance': user.wallet.toFixed(2)
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

    logout() {
        auth.logout();
    }
}

// Modal Functions
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
        const newBalance = user.wallet + amount;
        
        // Update user data
        await api.updateUser(user.userID, { wallet: newBalance });
        
        // Update local session
        user.wallet = newBalance;
        localStorage.setItem('webstarng_user', JSON.stringify(user));
        
        // Update UI
        document.getElementById('walletBalance').textContent = newBalance.toFixed(2);
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

        const newBalance = user.wallet - amount;
        
        // Update user data
        await api.updateUser(user.userID, { wallet: newBalance });
        
        // Update local session
        user.wallet = newBalance;
        localStorage.setItem('webstarng_user', JSON.stringify(user));
        
        // Update UI
        document.getElementById('walletBalance').textContent = newBalance.toFixed(2);
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
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        new WebStarNgApp();
    }
});
