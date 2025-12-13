//JSONBin.io API Configuration
class JSONBinAPI {
    constructor() {
        // Replace with your actual JSONBin.io credentials
        this.apiKey = '$2a$10$GY26W.StiN7bdlaoYuva3.GCGhyglj8ne8v0aaIJ895NLv9o61bqy'; // Your JSONBin.io API key
        this.binId = '693b1ac443b1c97be9e786b2'; // Your JSONBin.io bin ID
        this.baseURL = 'https://api.jsonbin.io/v3/b';
    }

    // Initialize default data structure
    async initializeData() {
        const defaultData = {
            users: [
                {
                    userID: 'tmp101',
                    password: '12345',
                    fullName: 'Demo Test User',
                    wallet: 5000.00,
                    contacts: [],
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                }
            ],
            contacts: []
        };

        try {
            const response = await fetch(`${this.baseURL}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey,
                    'X-Bin-Versioning': 'false'
                },
                body: JSON.stringify(defaultData)
            });

            return await response.json();
        } catch (error) {
            console.error('Error initializing data:', error);
            // Fallback to localStorage if API fails
            this.useLocalStorage();
            return this.getLocalData();
        }
    }

    // Get all data
    async getData() {
        try {
            const response = await fetch(`${this.baseURL}/${this.binId}/latest`, {
                headers: {
                    'X-Master-Key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }

            const data = await response.json();
            return data.record;
        } catch (error) {
            console.error('Error fetching data:', error);
            // Fallback to localStorage
            return this.getLocalData();
        }
    }

    // Update data
    async updateData(newData) {
        try {
            const response = await fetch(`${this.baseURL}/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                body: JSON.stringify(newData)
            });

            const result = await response.json();
            
            // Also update localStorage
            this.setLocalData(newData);
            
            return result;
        } catch (error) {
            console.error('Error updating data:', error);
            // Fallback to localStorage
            this.setLocalData(newData);
            return { success: true, message: 'Updated locally' };
        }
    }

    // Local storage fallback methods
    useLocalStorage() {
        this.storage = localStorage;
    }

    getLocalData() {
        const data = localStorage.getItem('webstarng_data');
        if (!data) {
            return this.initializeLocalData();
        }
        return JSON.parse(data);
    }

    setLocalData(data) {
        localStorage.setItem('webstarng_data', JSON.stringify(data));
    }

    initializeLocalData() {
        const defaultData = {
            users: [
                {
                    userID: 'tmp101',
                    password: '12345',
                    fullName: 'Demo Test User',
                    wallet: 5000.00,
                    contacts: [],
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                }
            ],
            contacts: []
        };
        this.setLocalData(defaultData);
        return defaultData;
    }

    // User methods
    async getUser(userID) {
        const data = await this.getData();
        return data.users.find(user => user.userID === userID);
    }

    // Check if user exists
    async userExists(userID) {
        const user = await this.getUser(userID);
        return user !== undefined;
    }

    // Create new user
    async createUser(userData) {
        const data = await this.getData();
        
        // Check if user already exists
        const existingUser = data.users.find(u => u.userID === userData.userID);
        if (existingUser) {
            throw new Error('User ID already exists');
        }
        
        // Add user with metadata
        const newUser = {
            ...userData,
            contacts: [],
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        
        data.users.push(newUser);
        
        // Update data
        await this.updateData(data);
        
        return newUser;
    }

    async updateUser(userID, updates) {
        const data = await this.getData();
        const userIndex = data.users.findIndex(user => user.userID === userID);
        
        if (userIndex !== -1) {
            data.users[userIndex] = { ...data.users[userIndex], ...updates };
            await this.updateData(data);
            return data.users[userIndex];
        }
        
        return null;
    }

    // Contact methods
    async addContact(userID, contact) {
        const data = await this.getData();
        const user = data.users.find(u => u.userID === userID);
        
        if (user) {
            user.contacts.push(contact);
            await this.updateData(data);
            return contact;
        }
        
        return null;
    }

    async getContacts(userID) {
        const data = await this.getData();
        const user = data.users.find(u => u.userID === userID);
        return user ? user.contacts : [];
    }
}

// Create global API instance
const api = new JSONBinAPI();

// Initialize data on first load
doc
ument.addEventListener('DOMContentLoaded', async () => {
    const data = await api.getData();
    if (!data || !data.users) {
        await api.initializeData();
    }
});
