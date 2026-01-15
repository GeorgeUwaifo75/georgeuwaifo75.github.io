// JSONBin.io API Configuration
class JSONBinAPI {
   
constructor() {
        // Use config from window object
        this.apiKey = window.APP_CONFIG.JSONBIN_API_KEY;
        this.mainBinId = window.APP_CONFIG.JSONBIN_MAIN_BIN_ID;
        this.baseURL = 'https://api.jsonbin.io/v3/b';
    }
      
     


// Add this method to JSONBinAPI class in api.js
async addPurchaseToUserBin(userID, purchaseData) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.purchasesBinId) {
            throw new Error('User purchases bin not found');
        }

        // Get current purchases data
        const purchases = await this.getUserPurchases(userID);
        
        // Create new transaction
        const newTransaction = {
            ...purchaseData,
            id: `purch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
        };

        // Add to transactions array
        purchases.transactions = purchases.transactions || [];
        purchases.transactions.push(newTransaction);
        
        // Update total purchases (optional, can be calculated)
        purchases.totalPurchases = (purchases.totalPurchases || 0) + (purchaseData.amount || 0);
        purchases.lastUpdated = new Date().toISOString();

        // Update the purchases bin directly
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


// Add this method to JSONBinAPI class in api.js
async updateProductQuantity(userID, productId, newQuantity) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.inventoryBinId) {
            throw new Error('User inventory bin not found');
        }

        const inventory = await this.getUserInventory(userID);
        const products = inventory.products || [];
        
        // Find the product
        const productIndex = products.findIndex(p => p.id === productId);
        if (productIndex === -1) {
            throw new Error('Product not found in inventory');
        }
        
        // Update quantity
        const currentQuantity = parseInt(products[productIndex].quantity) || 0;
        products[productIndex].quantity = currentQuantity + newQuantity;
        products[productIndex].updatedAt = new Date().toISOString();
        
        // Save updated inventory
        inventory.products = products;
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
        console.error('Error updating product quantity:', error);
        throw error;
    }
}



    // Initialize default data structure
   // Update the defaultData structure in initializeData() method
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
                inventoryBinId: 'inventory_tmp101',
                salesBinId: 'sales_tmp101',
                purchasesBinId: 'purchases_tmp101',
                // NEW FIELDS:
                userGroup: 1, // 0 = basic 1 for user..testing sales report
                businessName: 'Company name',
                addressLine1: 'Address line 1',
                addressLine2: 'Address line 2',
                telephone: '070 56 7356 63',
                email: 'xemail@xmail.com'
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

//New addition
   async updateUserInventory(userID, inventoryData) {
     try {
        const user = await this.getUser(userID);
        if (!user || !user.inventoryBinId) {
            throw new Error('User inventory bin not found');
        }

        const response = await fetch(`${this.baseURL}/${user.inventoryBinId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey
            },
            body: JSON.stringify(inventoryData)
        });

        return await response.json();
    } catch (error) {
        console.error('Error updating inventory:', error);
        throw error;
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
 // In api.js, update the addProductToInventory method:
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
            // Generate barcode if not provided
            barcode: productData.barcode || `BC${Date.now().toString().slice(-10)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Check for duplicate barcode
        if (inventory.products) {
            const duplicateBarcode = inventory.products.find(p => p.barcode === newProduct.barcode);
            if (duplicateBarcode) {
                // Generate unique barcode if duplicate found
                newProduct.barcode = `BC${Date.now()}${Math.floor(Math.random() * 1000)}`;
            }
        }

        inventory.products = inventory.products || [];
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
            timestamp: new Date().toISOString(),
            // Add server timestamp that can't be manipulated by client
            serverTimestamp: new Date().toISOString(),
            // Add user agent and IP fingerprint (simplified)
            clientInfo: {
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            }
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
                purchasesBinId: 'purchases_tmp101_local',
                // NEW FIELDS:
                userGroup: 0, // 0 = basic user
                businessName: 'Company name',
                addressLine1: 'Address line 1',
                addressLine2: 'Address line 2',
                telephone: '070 56 7356 63',
                email: 'xemail@xmail.com'
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
    const user = data.users.find(user => user.userID === userID);
    
    // For demo user, ensure transaction limits are enforced
    if (user && user.userID === 'tmp101') {
        const today = new Date().toISOString().split('T')[0];
        const lastTransactionDate = user.lastTransactionDate || '';
        
        // Reset counter if it's a new day
        if (lastTransactionDate !== today) {
            user.demoTransactionsToday = 0;
            user.lastTransactionDate = today;
            // Update the database
            await this.updateUser(userID, {
                demoTransactionsToday: 0,
                lastTransactionDate: today
            });
        }
    }
    
    return user;
}

    // Check if user exists
    async userExists(userID) {
        const user = await this.getUser(userID);
        return user !== undefined;
    }

    // Create new user with bins
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
 
    // Add user with metadata, bin IDs, and default business info
    const newUser = {
        ...userData,
        wallet: 0.00, // NEW: Default wallet value set to 0
        contacts: [],
        createdAt: new Date().toISOString(),
        lastLogin: null,
        inventoryBinId: bins.inventoryBinId,
        salesBinId: bins.salesBinId,
        purchasesBinId: bins.purchasesBinId,
        // NEW FIELDS WITH DEFAULTS:
        userGroup: 0, // Default to basic user (0)
        businessName: 'Company name',
        addressLine1: 'Address line 1',
        addressLine2: 'Address line 2',
        telephone: '070 56 7356 63',
        email: 'xemail@xmail.com'
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
