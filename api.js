// JSONBin.io API Configuration
class JSONBinAPI {
    constructor() {
        // Replace with your actual JSONBin.io credentials
        this.apiKey = '$2a$10$GY26W.StiN7bdlaoYuva3.GCGhyglj8ne8v0aaIJ895NLv9o61bqy'; // Your JSONBin.io API key
        this.mainBinId = '693b1ac443b1c97be9e786b2'; // Your JSONBin.io main bin ID for users
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
                    lastLogin: null,
                    inventoryBinId: 'inventory_tmp101', // Default inventory bin for demo user
                    salesBinId: 'sales_tmp101', // Default sales bin for demo user
                    purchasesBinId: 'purchases_tmp101' // Default purchases bin for demo user
                }
            ],
            contacts: []
        };

        try {
            const response = await fetch(`${this.baseURL}/${this.mainBinId}`, {
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

    // Create new bins for a user
    async createUserBins(userID) {
        const timestamp = Date.now();
        const inventoryData = {
            userID: userID,
            products: [],
            categories: [],
            createdAt: new Date().toISOString(),
            lastUpdated: null
        };

        const salesData = {
            userID: userID,
            transactions: [],
            totalSales: 0,
            createdAt: new Date().toISOString(),
            lastUpdated: null
        };

        const purchasesData = {
            userID: userID,
            transactions: [],
            totalPurchases: 0,
            createdAt: new Date().toISOString(),
            lastUpdated: null
        };

        try {
            // Create Inventory Bin
            const inventoryResponse = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey,
                    'X-Bin-Name': `inventory_${userID}_${timestamp}`
                },
                body: JSON.stringify(inventoryData)
            });
            const inventoryResult = await inventoryResponse.json();
            const inventoryBinId = inventoryResult.metadata.id;

            // Create Sales Bin
            const salesResponse = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey,
                    'X-Bin-Name': `sales_${userID}_${timestamp}`
                },
                body: JSON.stringify(salesData)
            });
            const salesResult = await salesResponse.json();
            const salesBinId = salesResult.metadata.id;

            // Create Purchases Bin
            const purchasesResponse = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey,
                    'X-Bin-Name': `purchases_${userID}_${timestamp}`
                },
                body: JSON.stringify(purchasesData)
            });
            const purchasesResult = await purchasesResponse.json();
            const purchasesBinId = purchasesResult.metadata.id;

            return {
                inventoryBinId,
                salesBinId,
                purchasesBinId,
                success: true
            };

        } catch (error) {
            console.error('Error creating user bins:', error);
            // Return fallback bin IDs
            return {
                inventoryBinId: `inventory_${userID}_local`,
                salesBinId: `sales_${userID}_local`,
                purchasesBinId: `purchases_${userID}_local`,
                success: false,
                error: error.message
            };
        }
    }

    // Get all data
    async getData() {
        try {
            const response = await fetch(`${this.baseURL}/${this.mainBinId}/latest`, {
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
            const response = await fetch(`${this.baseURL}/${this.mainBinId}`, {
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

    // Get user's inventory data
    async getUserInventory(userID) {
        try {
            const user = await this.getUser(userID);
            if (!user || !user.inventoryBinId) {
                return { products: [], categories: [], userID: userID };
            }

            const response = await fetch(`${this.baseURL}/${user.inventoryBinId}/latest`, {
                headers: {
                    'X-Master-Key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch inventory data');
            }

            const data = await response.json();
            return data.record;
        } catch (error) {
            console.error('Error fetching inventory:', error);
            return { products: [], categories: [], userID: userID };
        }
    }

    // Get user's sales data
    async getUserSales(userID) {
        try {
            const user = await this.getUser(userID);
            if (!user || !user.salesBinId) {
                return { transactions: [], totalSales: 0, userID: userID };
            }

            const response = await fetch(`${this.baseURL}/${user.salesBinId}/latest`, {
                headers: {
                    'X-Master-Key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch sales data');
            }

            const data = await response.json();
            return data.record;
        } catch (error) {
            console.error('Error fetching sales:', error);
            return { transactions: [], totalSales: 0, userID: userID };
        }
    }

    // Get user's purchases data
    async getUserPurchases(userID) {
        try {
            const user = await this.getUser(userID);
            if (!user || !user.purchasesBinId) {
                return { transactions: [], totalPurchases: 0, userID: userID };
            }

            const response = await fetch(`${this.baseURL}/${user.purchasesBinId}/latest`, {
                headers: {
                    'X-Master-Key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch purchases data');
            }

            const data = await response.json();
            return data.record;
        } catch (error) {
            console.error('Error fetching purchases:', error);
            return { transactions: [], totalPurchases: 0, userID: userID };
        }
    }

    // Add product to user's inventory
    async addProductToInventory(userID, productData) {
        try {
            const user = await this.getUser(userID);
            if (!user || !user.inventoryBinId) {
                throw new Error('User inventory bin not found');
            }

            const inventory = await this.getUserInventory(userID);
            const newProduct = {
                ...productData,
                id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            inventory.products.push(newProduct);
            inventory.lastUpdated = new Date().toISOString();

            const response = await fetch(`${this.baseURL}/${user.inventoryBinId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                body: JSON.stringify(inventory)
            });

            return await response.json();
        } catch (error) {
            console.error('Error adding product:', error);
            throw error;
        }
    }

    // Add sales transaction
    async addSalesTransaction(userID, transactionData) {
        try {
            const user = await this.getUser(userID);
            if (!user || !user.salesBinId) {
                throw new Error('User sales bin not found');
            }

            const sales = await this.getUserSales(userID);
            const newTransaction = {
                ...transactionData,
                id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString()
            };

            sales.transactions.push(newTransaction);
            sales.totalSales = (sales.totalSales || 0) + (transactionData.amount || 0);
            sales.lastUpdated = new Date().toISOString();

            const response = await fetch(`${this.baseURL}/${user.salesBinId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                body: JSON.stringify(sales)
            });

            return await response.json();
        } catch (error) {
            console.error('Error adding sales transaction:', error);
            throw error;
        }
    }

    // Add purchase transaction
    async addPurchaseTransaction(userID, transactionData) {
        try {
            const user = await this.getUser(userID);
            if (!user || !user.purchasesBinId) {
                throw new Error('User purchases bin not found');
            }

            const purchases = await this.getUserPurchases(userID);
            const newTransaction = {
                ...transactionData,
                id: `purch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString()
            };

            purchases.transactions.push(newTransaction);
            purchases.totalPurchases = (purchases.totalPurchases || 0) + (transactionData.amount || 0);
            purchases.lastUpdated = new Date().toISOString();

            const response = await fetch(`${this.baseURL}/${user.purchasesBinId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                body: JSON.stringify(purchases)
            });

            return await response.json();
        } catch (error) {
            console.error('Error adding purchase transaction:', error);
            throw error;
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
                    lastLogin: null,
                    inventoryBinId: 'inventory_tmp101_local',
                    salesBinId: 'sales_tmp101_local',
                    purchasesBinId: 'purchases_tmp101_local'
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

    // Create new user with bins
    async createUser(userData) {
        const data = await this.getData();
        
        // Check if user already exists
        const existingUser = data.users.find(u => u.userID === userData.userID);
        if (existingUser) {
            throw new Error('User ID already exists');
        }
        
        // Create bins for the new user
        const bins = await this.createUserBins(userData.userID);
        
        // Add user with metadata and bin IDs
        const newUser = {
            ...userData,
            contacts: [],
            createdAt: new Date().toISOString(),
            lastLogin: null,
            inventoryBinId: bins.inventoryBinId,
            salesBinId: bins.salesBinId,
            purchasesBinId: bins.purchasesBinId
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

    // Add funds to wallet
    async addFunds(userID, amount) {
        const user = await this.getUser(userID);
        if (!user) throw new Error('User not found');
        
        const newBalance = user.wallet + amount;
        await this.updateUser(userID, { wallet: newBalance });
        
        return newBalance;
    }

    // Withdraw funds from wallet
    async withdrawFunds(userID, amount) {
        const user = await this.getUser(userID);
        if (!user) throw new Error('User not found');
        
        if (amount > user.wallet) {
            throw new Error('Insufficient funds');
        }
        
        const newBalance = user.wallet - amount;
        await this.updateUser(userID, { wallet: newBalance });
        
        return newBalance;
    }
}

// Create global API instance
const api = new JSONBinAPI();

// Initialize data on first load
document.addEventListener('DOMContentLoaded', async () => {
    const data = await api.getData();
    if (!data || !data.users) {
        await api.initializeData();
    }
});
