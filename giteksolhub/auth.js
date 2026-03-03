// auth.js
class AuthService {
    constructor() {
        this.currentUser = null;
    }

    async login(userId, password) {
        const users = await api.getAllUsers();
        const user = users.find(u => u.userId === userId && u.password === password);
        
        if (user && user.userActivityStatus === 1) {
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            return user;
        }
        throw new Error('Invalid credentials or inactive account');
    }

    async signup(userData) {
        // Check if user exists
        const users = await api.getAllUsers();
        const existingUser = users.find(u => u.email === userData.email || u.userId === userData.userId);
        
        if (existingUser) {
            throw new Error('User already exists');
        }

        const newUser = {
            ...userData,
            userGroup: 1, // Default to merchant
            dateOfRegistration: new Date().toISOString(),
            userActivityStatus: 1,
            numberOfAdverts: 0,
            dailyPayValue: 0,
            weeklyPayValue: 0,
            monthlyPayValue: 0
        };

        await api.createUser(newUser);
        return newUser;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    checkSession() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            return this.currentUser;
        }
        return null;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.userGroup === 0;
    }

    isMerchant() {
        return this.currentUser && this.currentUser.userGroup === 1;
    }
}

const auth = new AuthService();
