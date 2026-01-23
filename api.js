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
// In updateProductQuantity() method in api.js, add user tracking:
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
        products[productIndex].lastModifiedBy = userID;  // Track who modified
        
        // Save updated inventory
        inventory.products = products;
        inventory.lastUpdated = new Date().toISOString();
        inventory.lastModifiedBy = userID;

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
    /*
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
*/

async getData() {
    try {
        console.log('Fetching data from JSONBin...');
        const response = await fetch(`${this.baseURL}/${this.mainBinId}/latest`, {
            headers: {
                'X-Master-Key': this.apiKey
            },
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            console.warn('JSONBin fetch failed, trying localStorage');
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Data fetched successfully from JSONBin');
        return data.record || { users: [] };
        
    } catch (error) {
        console.error('Error fetching data from JSONBin:', error);
        console.log('Falling back to localStorage...');
        
        // Fallback to localStorage
        const localData = this.getLocalData();
        console.log('Local data retrieved:', localData ? 'Yes' : 'No');
        return localData || { users: [] };
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
   // In api.js, update getUserInventory() method:
async getUserInventory(userID) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.inventoryBinId) {
            return { products: [], categories: [], userID: userID, shared: false };
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
        const inventoryData = data.record;
        
        // Add sharing information if this is a shared inventory
        const sharingInfo = {
            shared: user.sharesInventory || false,
            sharedFrom: user.parentUserID || null,
            isSharedInventory: user.sharesInventory || false
        };
        
        return { ...inventoryData, ...sharingInfo };
        
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return { products: [], categories: [], userID: userID, shared: false };
    }
}
    // Get user's sales data
  // In api.js, update getUserSales() method:
// In api.js, update getUserSales() method:
async getUserSales(userID, filterByUser = true, isAdmin = false) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.salesBinId) {
            return { transactions: [], totalSales: 0, userID: userID, shared: false };
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
        const salesData = data.record;

        // Add sharing information
        const sharingInfo = {
            shared: user.sharedSales || false,
            sharedFrom: user.parentUserID || null,
            isSharedSales: user.sharedSales || false,
            totalTransactions: salesData.transactions ? salesData.transactions.length : 0
        };

        let filteredTransactions = salesData.transactions || [];
        let userTotalSales = 0;

        // If user has shared database OR admin viewing shared database
        if (user.sharedSales || (isAdmin && user.sharedSales)) {
            // For admin users (group 2 or 3) - show ALL transactions without filtering
            if (isAdmin) {
                // Admin sees everything - no filtering needed
                filteredTransactions = filteredTransactions;
                userTotalSales = salesData.totalSales || 0;
            } else {
                // Non-admin users in shared database - filter by their userID
                filteredTransactions = filteredTransactions.filter(transaction =>
                    transaction.performedBy === userID || transaction.userID === userID
                );
                userTotalSales = filteredTransactions.reduce((sum, transaction) => {
                    return sum + (parseFloat(transaction.amount) || 0);
                }, 0);
            }
        } else {
            // Regular user with own database - show all their transactions
            userTotalSales = salesData.totalSales || 0;
        }

        return {
            ...salesData,
            ...sharingInfo,
            transactions: filteredTransactions,
            userTotalSales: userTotalSales,
            allTransactions: salesData.transactions || [] // Keep all for admin view
        };
    } catch (error) {
        console.error('Error fetching sales:', error);
        return { transactions: [], totalSales: 0, userID: userID, shared: false };
    }
}



    // Get user's purchases data
  // In api.js, update getUserPurchases() method:
async getUserPurchases(userID, filterByUser = true, isAdmin = false) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.purchasesBinId) {
            return { transactions: [], totalPurchases: 0, userID: userID, shared: false };
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
        const purchasesData = data.record;

        // Add sharing information
        const sharingInfo = {
            shared: user.sharedPurchases || false,
            sharedFrom: user.parentUserID || null,
            isSharedPurchases: user.sharedPurchases || false,
            totalTransactions: purchasesData.transactions ? purchasesData.transactions.length : 0
        };

        let filteredTransactions = purchasesData.transactions || [];
        let userTotalPurchases = 0;

        // If user has shared database OR admin viewing shared database
        if (user.sharedPurchases || (isAdmin && user.sharedPurchases)) {
            // For admin users (group 2 or 3) - show ALL transactions without filtering
            if (isAdmin) {
                // Admin sees everything - no filtering needed
                filteredTransactions = filteredTransactions;
                userTotalPurchases = purchasesData.totalPurchases || 0;
            } else {
                // Non-admin users in shared database - filter by their userID
                filteredTransactions = filteredTransactions.filter(transaction =>
                    transaction.performedBy === userID || transaction.userID === userID
                );
                userTotalPurchases = filteredTransactions.reduce((sum, transaction) => {
                    return sum + (parseFloat(transaction.amount) || 0);
                }, 0);
            }
        } else {
            // Regular user with own database - show all their transactions
            userTotalPurchases = purchasesData.totalPurchases || 0;
        }

        return {
            ...purchasesData,
            ...sharingInfo,
            transactions: filteredTransactions,
            userTotalPurchases: userTotalPurchases,
            allTransactions: purchasesData.transactions || [] // Keep all for admin view
        };
    } catch (error) {
        console.error('Error fetching purchases:', error);
        return { transactions: [], totalPurchases: 0, userID: userID, shared: false };
    }
}
    
    
   
    // Add product to user's inventory
// In api.js, update addProductToInventory() method:
async addProductToInventory(userID, productData) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.inventoryBinId) {
            throw new Error('User inventory bin not found');
        }
        
        const inventory = await this.getUserInventory(userID);
        
        // For shared inventory, check for duplicates across all users
        if (user.sharesInventory && productData.barcode) {
            const duplicateBarcode = inventory.products?.find(p => p.barcode === productData.barcode);
            if (duplicateBarcode) {
                throw new Error(`Barcode "${productData.barcode}" already exists in shared inventory for product: "${duplicateBarcode.name}"`);
            }
        }
        
        const newProduct = {
            ...productData,
            id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            barcode: productData.barcode || `BC${Date.now().toString().slice(-10)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Track which user added this product
            addedBy: userID,
            lastModifiedBy: userID
        };
        
        inventory.products = inventory.products || [];
        inventory.products.push(newProduct);
        inventory.lastUpdated = new Date().toISOString();
        inventory.lastModifiedBy = userID;
        
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
   // In api.js, update addSalesTransaction() method:
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
            // Add user info for shared database
            performedBy: userID,
            userID: userID,  // Include user ID in transaction
            // Add server timestamp
            serverTimestamp: new Date().toISOString(),
            // Add client info
            clientInfo: {
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                performedBy: userID
            }
        };

        sales.transactions.push(newTransaction);
        sales.totalSales = (sales.totalSales || 0) + (transactionData.amount || 0);
        sales.lastUpdated = new Date().toISOString();
        sales.lastModifiedBy = userID;

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
    // In api.js, update addPurchaseTransaction() method:
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
            timestamp: new Date().toISOString(),
            // Add user info for shared database
            performedBy: userID,
            userID: userID,  // Include user ID in transaction
            // Add client info
            clientInfo: {
                performedBy: userID,
                timestamp: new Date().toISOString()
            }
        };

        purchases.transactions.push(newTransaction);
        purchases.totalPurchases = (purchases.totalPurchases || 0) + (transactionData.amount || 0);
        purchases.lastUpdated = new Date().toISOString();
        purchases.lastModifiedBy = userID;

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
// In api.js, update the createUser() method:
async createUser(userData, creatingUser = null) {
    const data = await this.getData();
    
    // Check if user already exists
    const existingUser = data.users.find(u => u.userID === userData.userID);
    if (existingUser) {
        throw new Error('User ID already exists');
    }
    
    // If creatingUser is provided, share ALL bins
    if (creatingUser) {
        // SHARE ALL BINS - SAME DATABASE
        const newUser = {
            ...userData,
            wallet: 0.00,
            contacts: [],
            createdAt: new Date().toISOString(),
            lastLogin: null,
            
            // SHARE ALL BINS (SAME DATABASE)
            inventoryBinId: creatingUser.inventoryBinId,      // Same inventory
            salesBinId: creatingUser.salesBinId,              // Same sales
            purchasesBinId: creatingUser.purchasesBinId,      // Same purchases
            
            // INHERIT BUSINESS INFORMATION
            userGroup: userData.userGroup || creatingUser.userGroup || 0,
            businessName: creatingUser.businessName || 'Company name',
            addressLine1: creatingUser.addressLine1 || 'Address line 1',
            addressLine2: creatingUser.addressLine2 || 'Address line 2',
            telephone: creatingUser.telephone || '070 56 7356 63',
            email: creatingUser.email || 'xemail@xmail.com',
            
            // Tracking fields
            createdBy: creatingUser.userID,
            parentUserID: creatingUser.userID,
            isBranchAccount: true,
            sharesAllBins: true,               // Flag to indicate fully shared
            sharedInventory: true,
            sharedSales: true,
            sharedPurchases: true
        };
        
        // NO NEED TO CREATE SEPARATE BINS - USING SHARED BINS
        
        data.users.push(newUser);
        await this.updateData(data);
        return newUser;
        
    } else {
        // Original logic for standalone users
        const bins = await this.createUserBins(userData.userID);
        
        const newUser = {
            ...userData,
            wallet: 0.00,
            contacts: [],
            createdAt: new Date().toISOString(),
            lastLogin: null,
            inventoryBinId: bins.inventoryBinId,
            salesBinId: bins.salesBinId,
            purchasesBinId: bins.purchasesBinId,
            userGroup: userData.userGroup || 0,
            businessName: userData.businessName || 'Company name',
            addressLine1: userData.addressLine1 || 'Address line 1',
            addressLine2: userData.addressLine2 || 'Address line 2',
            telephone: userData.telephone || '070 56 7356 63',
            email: userData.email || 'xemail@xmail.com',
            createdBy: 'self',
            parentUserID: null,
            isBranchAccount: false,
            sharesAllBins: false
        };
        
        data.users.push(newUser);
        await this.updateData(data);
        return newUser;
    }
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


// Add this method to JSONBinAPI class in api.js:
async inheritUserBins(parentUserID, newUserID) {
    try {
        const parentUser = await this.getUser(parentUserID);
        if (!parentUser) {
            throw new Error('Parent user not found');
        }
        
        // Check if parent user has bins
        if (!parentUser.inventoryBinId || !parentUser.salesBinId || !parentUser.purchasesBinId) {
            throw new Error('Parent user does not have required bins');
        }
        
        // For inventory: Create a copy of parent's inventory structure
        const parentInventory = await this.getUserInventory(parentUserID);
        const newInventory = {
            userID: newUserID,
            products: [], // Start with empty products array
            categories: parentInventory.categories || [],
            createdAt: new Date().toISOString(),
            lastUpdated: null,
            inheritedFrom: parentUserID,
            isSharedInventory: true
        };
        
        // Create new inventory bin with inherited structure
        const inventoryResponse = await fetch(this.baseURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey,
                'X-Bin-Name': `inventory_${newUserID}_inherit_${Date.now()}`
            },
            body: JSON.stringify(newInventory)
        });
        
        const inventoryResult = await inventoryResponse.json();
        const inventoryBinId = inventoryResult.metadata.id;
        
        // For sales: Create empty sales bin
        const salesData = {
            userID: newUserID,
            transactions: [],
            totalSales: 0,
            createdAt: new Date().toISOString(),
            lastUpdated: null,
            inheritedFrom: parentUserID
        };
        
        const salesResponse = await fetch(this.baseURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey,
                'X-Bin-Name': `sales_${newUserID}_inherit_${Date.now()}`
            },
            body: JSON.stringify(salesData)
        });
        
        const salesResult = await salesResponse.json();
        const salesBinId = salesResult.metadata.id;
        
        // For purchases: Create empty purchases bin
        const purchasesData = {
            userID: newUserID,
            transactions: [],
            totalPurchases: 0,
            createdAt: new Date().toISOString(),
            lastUpdated: null,
            inheritedFrom: parentUserID
        };
        
        const purchasesResponse = await fetch(this.baseURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey,
                'X-Bin-Name': `purchases_${newUserID}_inherit_${Date.now()}`
            },
            body: JSON.stringify(purchasesData)
        });
        
        const purchasesResult = await purchasesResponse.json();
        const purchasesBinId = purchasesResult.metadata.id;
        
        return {
            inventoryBinId,
            salesBinId,
            purchasesBinId,
            success: true,
            inheritedFrom: parentUserID
        };
        
    } catch (error) {
        console.error('Error inheriting user bins:', error);
        return {
            inventoryBinId: `inventory_${newUserID}_local`,
            salesBinId: `sales_${newUserID}_local`,
            purchasesBinId: `purchases_${newUserID}_local`,
            success: false,
            error: error.message
        };
    }
}
 
// Add this method to JSONBinAPI class in api.js:
async updateUserSalesBin(userID, salesData) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.salesBinId) {
            throw new Error('User sales bin not found');
        }

        // Single API call to update entire sales bin
        const response = await fetch(`${this.baseURL}/${user.salesBinId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey
            },
            body: JSON.stringify(salesData)
        });

        return await response.json();
    } catch (error) {
        console.error('Error updating sales bin:', error);
        throw error;
    }
} 
 

// Add this method to JSONBinAPI class in api.js:
async updateUserInventoryBatch(userID, inventoryData) {
    try {
        const user = await this.getUser(userID);
        if (!user || !user.inventoryBinId) {
            throw new Error('User inventory bin not found');
        }

        // Single API call to update entire inventory
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
        console.error('Error updating inventory batch:', error);
        throw error;
    }
}
  
  
// Backup Methods
async createBackup(userID, backupName = '') {
    try {
        // Get all data from the main bin
        const mainData = await this.getData();
        
        // Find the current user
        const currentUser = mainData.users.find(user => user.userID === userID);
        if (!currentUser) {
            throw new Error('User not found');
        }
        
        // Get user's specific data
        const [inventoryData, salesData, purchasesData] = await Promise.all([
            this.getUserInventory(userID),
            this.getUserSales(userID),
            this.getUserPurchases(userID)
        ]);
        
        // Create backup structure
        const backupData = {
            metadata: {
                backupId: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                backupName: backupName || `Backup_${new Date().toISOString().split('T')[0]}`,
                createdBy: userID,
                timestamp: new Date().toISOString(),
                version: '1.0',
                system: 'WebStarNg'
            },
            mainData: mainData,
            userData: {
                inventory: inventoryData,
                sales: salesData,
                purchases: purchasesData,
                userInfo: currentUser
            }
        };
        
        // Create a new bin for this backup
        const backupResponse = await fetch(this.baseURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey,
                'X-Bin-Name': `backup_${userID}_${Date.now()}_${backupName.replace(/\s+/g, '_')}`
            },
            body: JSON.stringify(backupData)
        });
        
        if (!backupResponse.ok) {
            throw new Error('Failed to create backup bin');
        }
        
        const backupResult = await backupResponse.json();
        const backupBinId = backupResult.metadata.id;
        
        // Add backup record to user's data
        const backupRecord = {
            backupId: backupBinId,
            backupName: backupName || `Backup_${new Date().toLocaleString()}`,
            timestamp: new Date().toISOString(),
            size: JSON.stringify(backupData).length,
            userCount: mainData.users.length,
            productCount: inventoryData.products?.length || 0,
            salesCount: salesData.transactions?.length || 0,
            purchasesCount: purchasesData.transactions?.length || 0
        };
        
        // Update user with backup record
        await this.updateUser(userID, {
            backups: currentUser.backups ? [...currentUser.backups, backupRecord] : [backupRecord],
            lastBackup: new Date().toISOString()
        });
        
        return {
            success: true,
            backupBinId: backupBinId,
            backupRecord: backupRecord,
            message: 'Backup created successfully'
        };
        
    } catch (error) {
        console.error('Error creating backup:', error);
        throw error;
    }
}

async getUserBackups(userID) {
    try {
        const user = await this.getUser(userID);
        return user?.backups || [];
    } catch (error) {
        console.error('Error fetching user backups:', error);
        return [];
    }
}

async restoreFromBackup(userID, backupBinId) {
    try {
        // Get the backup data
        const response = await fetch(`${this.baseURL}/${backupBinId}/latest`, {
            headers: {
                'X-Master-Key': this.apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error('Backup not found or inaccessible');
        }
        
        const data = await response.json();
        const backupData = data.record;
        
        // Validate backup data
        if (!backupData.metadata || !backupData.mainData) {
            throw new Error('Invalid backup format');
        }
        
        // For admin users, restore everything
        const currentUser = await this.getUser(userID);
        const isAdmin = currentUser.userGroup >= 3;
        
        if (isAdmin) {
            // Restore main data
            await this.updateData(backupData.mainData);
            
            // Log the restoration
            await this.updateUser(userID, {
                lastRestore: new Date().toISOString(),
                restoredBackup: backupBinId,
                restoreNotes: `Full system restore from backup: ${backupData.metadata.backupName}`
            });
            
            return {
                success: true,
                type: 'full',
                message: 'Full system restore completed successfully'
            };
        } else {
            // For non-admin users, restore only their data
            const userBackupData = backupData.userData;
            
            if (!userBackupData) {
                throw new Error('User data not found in backup');
            }
            
            // Restore inventory
            if (userBackupData.inventory) {
                await this.updateUserInventory(userID, userBackupData.inventory);
            }
            
            // Restore sales
            if (userBackupData.sales) {
                await this.updateUserSalesBin(userID, userBackupData.sales);
            }
            
            // Restore purchases
            if (userBackupData.purchases) {
                const purchasesBin = await this.getUserPurchases(userID);
                purchasesBin.transactions = userBackupData.purchases.transactions || [];
                purchasesBin.totalPurchases = userBackupData.purchases.totalPurchases || 0;
                await api.updateUserInventoryBatch(userID, purchasesBin); // Using inventory batch for purchases
            }
            
            // Log the restoration
            await this.updateUser(userID, {
                lastRestore: new Date().toISOString(),
                restoredBackup: backupBinId,
                restoreNotes: `User data restore from backup: ${backupData.metadata.backupName}`
            });
            
            return {
                success: true,
                type: 'user',
                message: 'User data restore completed successfully'
            };
        }
        
    } catch (error) {
        console.error('Error restoring from backup:', error);
        throw error;
    }
}

async deleteBackup(userID, backupBinId) {
    try {
        // Check if user owns this backup
        const user = await this.getUser(userID);
        const backupExists = user?.backups?.find(b => b.backupId === backupBinId);
        
        if (!backupExists) {
            throw new Error('Backup not found or access denied');
        }
        
        // Delete the backup bin
        const response = await fetch(`${this.baseURL}/${backupBinId}`, {
            method: 'DELETE',
            headers: {
                'X-Master-Key': this.apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete backup bin');
        }
        
        // Remove backup record from user
        const updatedBackups = user.backups.filter(b => b.backupId !== backupBinId);
        await this.updateUser(userID, {
            backups: updatedBackups
        });
        
        return {
            success: true,
            message: 'Backup deleted successfully'
        };
        
    } catch (error) {
        console.error('Error deleting backup:', error);
        throw error;
    }
}

async downloadBackupFile(backupBinId) {
    try {
        const response = await fetch(`${this.baseURL}/${backupBinId}/latest`, {
            headers: {
                'X-Master-Key': this.apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error('Backup not found');
        }
        
        const data = await response.json();
        return data.record;
        
    } catch (error) {
        console.error('Error downloading backup:', error);
        throw error;
    }
}  


// Wallet Administration Methods
async getAllUsers() {
    try {
        const data = await this.getData();
        return data.users || [];
    } catch (error) {
        console.error('Error fetching all users:', error);
        return [];
    }
}

// In JSONBinAPI class, update the searchUsers method:
async searchUsers(searchTerm = '') {
    try {
        const data = await this.getData();
        
        // DEBUG: Log the structure of data
        console.log('Data structure from getData():', {
            hasUsers: !!data.users,
            usersType: typeof data.users,
            usersLength: data.users ? data.users.length : 0,
            dataKeys: Object.keys(data)
        });
        
        // Ensure users array exists
        const users = Array.isArray(data.users) ? data.users : [];
        
        console.log(`Found ${users.length} users in database`);
        
        // If no search term, return all valid users
        if (!searchTerm || searchTerm.trim() === '') {
            return users.filter(user => 
                user && 
                user.userID && 
                typeof user.userID === 'string'
            );
        }
        
        // Search logic for non-empty search term
        const searchLower = searchTerm.toLowerCase().trim();
        
        return users.filter(user => {
            if (!user || !user.userID) return false;
            
            return (
                (user.userID && user.userID.toLowerCase().includes(searchLower)) ||
                (user.fullName && user.fullName.toLowerCase().includes(searchLower)) ||
                (user.email && user.email.toLowerCase().includes(searchLower)) ||
                (user.businessName && user.businessName.toLowerCase().includes(searchLower))
            );
        });
        
    } catch (error) {
        console.error('Error in searchUsers:', error);
        // Return empty array to prevent UI errors
        return [];
    }
}

async adjustUserWallet(userID, adjustmentData) {
    try {
        const user = await this.getUser(userID);
        if (!user) {
            throw new Error(`User ${userID} not found`);
        }
        
        const currentBalance = parseFloat(user.wallet) || 0;
        let newBalance = currentBalance;
        const action = adjustmentData.action;
        const amount = parseFloat(adjustmentData.amount) || 0;
        
        // Perform wallet adjustment based on action
        switch(action) {
            case 'add':
                newBalance = currentBalance + amount;
                break;
                
            case 'deduct':
                if (currentBalance < amount) {
                    throw new Error(`Insufficient balance. Current: ₦${currentBalance.toFixed(2)}, Attempted: ₦${amount.toFixed(2)}`);
                }
                newBalance = currentBalance - amount;
                break;
                
            case 'set':
                newBalance = amount;
                break;
                
            case 'reset':
                newBalance = 0;
                break;
                
            default:
                throw new Error(`Invalid action: ${action}`);
        }
        
        // Record the adjustment
        const adjustmentRecord = {
            id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userID: userID,
            action: action,
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            reason: adjustmentData.reason || '',
            performedBy: adjustmentData.performedBy,
            timestamp: new Date().toISOString(),
            notes: adjustmentData.notes || ''
        };
        
        // Update user wallet
        await this.updateUser(userID, { 
            wallet: newBalance,
            walletAdjustments: user.walletAdjustments ? [...user.walletAdjustments, adjustmentRecord] : [adjustmentRecord],
            lastWalletAdjustment: new Date().toISOString(),
            lastWalletAdjustmentBy: adjustmentData.performedBy
        });
        
        // Also log in admin's adjustment history
        if (adjustmentData.performedBy && adjustmentData.performedBy !== userID) {
            await this.logAdminAdjustment(adjustmentData.performedBy, adjustmentRecord);
        }
        
        return {
            success: true,
            userID: userID,
            action: action,
            previousBalance: currentBalance,
            newBalance: newBalance,
            adjustmentRecord: adjustmentRecord,
            message: `Wallet ${action} successful. New balance: ₦${newBalance.toFixed(2)}`
        };
        
    } catch (error) {
        console.error('Error adjusting user wallet:', error);
        throw error;
    }
}

async logAdminAdjustment(adminUserID, adjustmentRecord) {
    try {
        const adminUser = await this.getUser(adminUserID);
        if (!adminUser) return;
        
        const adminAdjustment = {
            ...adjustmentRecord,
            isAdminAction: true,
            adminUserID: adminUserID
        };
        
        await this.updateUser(adminUserID, {
            adminWalletAdjustments: adminUser.adminWalletAdjustments ? 
                [...adminUser.adminWalletAdjustments, adminAdjustment] : [adminAdjustment],
            lastAdminAction: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error logging admin adjustment:', error);
        // Don't throw - this is secondary logging
    }
}

async getWalletAdjustments(userID, adminView = false) {
    try {
        const user = await this.getUser(userID);
        if (!user) return [];
        
        if (adminView) {
            // Return admin's adjustment history (adjustments they made to others)
            return user.adminWalletAdjustments || [];
        } else {
            // Return adjustments made to this user
            return user.walletAdjustments || [];
        }
    } catch (error) {
        console.error('Error fetching wallet adjustments:', error);
        return [];
    }
}

async batchAdjustWallets(adjustments) {
    try {
        const results = [];
        const errors = [];
        
        for (const adjustment of adjustments) {
            try {
                const result = await this.adjustUserWallet(adjustment.userID, adjustment);
                results.push(result);
            } catch (error) {
                errors.push({
                    userID: adjustment.userID,
                    error: error.message
                });
            }
        }
        
        return {
            success: errors.length === 0,
            results: results,
            errors: errors,
            totalProcessed: adjustments.length,
            successful: results.length,
            failed: errors.length
        };
        
    } catch (error) {
        console.error('Error in batch wallet adjustment:', error);
        throw error;
    }
}

async exportWalletHistory(userID, format = 'csv') {
    try {
        const user = await this.getUser(userID);
        if (!user) {
            throw new Error('User not found');
        }
        
        const adjustments = user.walletAdjustments || [];
        
        if (format === 'csv') {
            return this.generateWalletCSV(adjustments, user);
        } else if (format === 'excel') {
            return this.generateWalletExcel(adjustments, user);
        } else {
            throw new Error(`Unsupported format: ${format}`);
        }
        
    } catch (error) {
        console.error('Error exporting wallet history:', error);
        throw error;
    }
}

async generateWalletCSV(adjustments, user) {
    let csvContent = "Date,Time,Action,Amount (₦),Previous Balance (₦),New Balance (₦),Reason,Performed By,Notes\n";
    
    adjustments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    adjustments.forEach(adj => {
        const date = new Date(adj.timestamp);
        const row = [
            date.toISOString().split('T')[0],
            date.toLocaleTimeString(),
            adj.action.toUpperCase(),
            adj.amount.toFixed(2),
            adj.previousBalance.toFixed(2),
            adj.newBalance.toFixed(2),
            `"${adj.reason || ''}"`,
            adj.performedBy || 'System',
            `"${adj.notes || ''}"`
        ];
        csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
}

async generateWalletExcel(adjustments, user) {
    // HTML format that Excel can open
    let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <title>Wallet History - ${user.userID}</title>
            <style>
                table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
                th { background: #2c3e50; color: white; padding: 12px; text-align: left; }
                td { padding: 8px; border: 1px solid #ddd; }
                .positive { color: #27ae60; font-weight: bold; }
                .negative { color: #e74c3c; font-weight: bold; }
                .header { font-size: 18px; margin-bottom: 10px; color: #2c3e50; }
                .summary { margin: 20px 0; padding: 15px; background: #f8f9fa; }
            </style>
        </head>
        <body>
            <div class="header">Wallet History - ${user.userID}</div>
            <div>User: ${user.fullName || user.userID}</div>
            <div>Current Balance: ₦${user.wallet ? parseFloat(user.wallet).toFixed(2) : '0.00'}</div>
            <div>Report Generated: ${new Date().toLocaleString()}</div>
            
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Amount (₦)</th>
                        <th>Previous Balance (₦)</th>
                        <th>New Balance (₦)</th>
                        <th>Reason</th>
                        <th>Performed By</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    adjustments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    adjustments.forEach(adj => {
        const date = new Date(adj.timestamp);
        const amountClass = adj.action === 'add' ? 'positive' : 
                           adj.action === 'deduct' ? 'negative' : '';
        
        htmlContent += `
            <tr>
                <td>${date.toISOString().split('T')[0]}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${adj.action.toUpperCase()}</td>
                <td class="${amountClass}">${adj.amount.toFixed(2)}</td>
                <td>${adj.previousBalance.toFixed(2)}</td>
                <td>${adj.newBalance.toFixed(2)}</td>
                <td>${adj.reason || ''}</td>
                <td>${adj.performedBy || 'System'}</td>
            </tr>
        `;
    });
    
    // Calculate totals
    const totalAdditions = adjustments
        .filter(adj => adj.action === 'add')
        .reduce((sum, adj) => sum + adj.amount, 0);
    
    const totalDeductions = adjustments
        .filter(adj => adj.action === 'deduct')
        .reduce((sum, adj) => sum + adj.amount, 0);
    
    htmlContent += `
                </tbody>
            </table>
            
            <div class="summary">
                <strong>Summary:</strong><br>
                Total Additions: ₦${totalAdditions.toFixed(2)}<br>
                Total Deductions: ₦${totalDeductions.toFixed(2)}<br>
                Net Change: ₦${(totalAdditions - totalDeductions).toFixed(2)}<br>
                Total Adjustments: ${adjustments.length}
            </div>
        </body>
        </html>
    `;
    
    return htmlContent;
}  
  
  
// Wallet Administration Methods
selectedUserForWalletAdmin = null;

async searchUsers() {
    try {
        const searchInput = document.getElementById('userSearch');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        usersList.innerHTML = `
            <div class="loading-state">
                <span class="spinner"></span>
                <p>Searching users...</p>
            </div>
        `;
        
        const users = await api.searchUsers(searchTerm);
        
        if (users.length === 0) {
            usersList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">👤</span>
                    <p>No users found</p>
                    ${searchTerm ? `<p class="hint">No results for "${searchTerm}"</p>` : ''}
                </div>
            `;
            return;
        }
        
        // Sort users: admins first, then by userID
        users.sort((a, b) => {
            if (a.userGroup !== b.userGroup) {
                return (b.userGroup || 0) - (a.userGroup || 0); // Higher group first
            }
            return (a.userID || '').localeCompare(b.userID || '');
        });
        
        usersList.innerHTML = users.map(user => {
            const isCurrentUser = user.userID === JSON.parse(localStorage.getItem('webstarng_user'))?.userID;
            const isSelected = this.selectedUserForWalletAdmin?.userID === user.userID;
            const userGroupLabel = this.getUserGroupLabel(user.userGroup || 0);
            const userGroupClass = `group-${user.userGroup || 0}`;
            
            return `
                <div class="user-item ${isSelected ? 'selected' : ''} ${isCurrentUser ? 'current-user' : ''}" 
                     onclick="app.selectUserForWalletAdmin('${user.userID}')">
                    <div class="user-header">
                        <div class="user-id">${user.userID}</div>
                        ${isCurrentUser ? '<span class="current-badge">(You)</span>' : ''}
                        <span class="user-group-badge ${userGroupClass}">${userGroupLabel}</span>
                    </div>
                    <div class="user-details">
                        <div class="user-name">${user.fullName || 'No name'}</div>
                        <div class="user-wallet">
                            <span class="wallet-label">Wallet:</span>
                            <span class="wallet-amount">₦${(user.wallet || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="user-meta">
                        ${user.businessName ? `<span class="meta-item">🏢 ${user.businessName}</span>` : ''}
                        ${user.email ? `<span class="meta-item">📧 ${user.email}</span>` : ''}
                        ${user.lastLogin ? `
                            <span class="meta-item" title="Last login">
                                ⏰ ${new Date(user.lastLogin).toLocaleDateString()}
                            </span>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error searching users:', error);
        const usersList = document.getElementById('usersList');
        if (usersList) {
            usersList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">❌</span>
                    <p>Error loading users</p>
                    <button class="btn-small" onclick="app.searchUsers()">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

async selectUserForWalletAdmin(userID) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) return;
        
        const user = await api.getUser(userID);
        if (!user) {
            alert(`User ${userID} not found`);
            return;
        }
        
        this.selectedUserForWalletAdmin = user;
        
        // Update UI
        const selectedUserInfo = document.getElementById('selectedUserInfo');
        const selectedUserName = document.getElementById('selectedUserName');
        const selectedUserBalance = document.getElementById('selectedUserBalance');
        const selectedUserGroup = document.getElementById('selectedUserGroup');
        const executeWalletBtn = document.getElementById('executeWalletAction');
        
        if (selectedUserInfo) selectedUserInfo.style.display = 'block';
        if (selectedUserName) selectedUserName.textContent = `${user.userID} (${user.fullName || 'No name'})`;
        if (selectedUserBalance) selectedUserBalance.textContent = `₦${(user.wallet || 0).toFixed(2)}`;
        if (selectedUserGroup) {
            selectedUserGroup.textContent = this.getUserGroupLabel(user.userGroup || 0);
            selectedUserGroup.className = `user-group-badge group-${user.userGroup || 0}`;
        }
        
        // Enable execute button if form is valid
        if (executeWalletBtn) {
            this.validateWalletForm();
        }
        
        // Update selected state in users list
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`.user-item[onclick*="${userID}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // Load user's adjustment history
        this.loadUserAdjustments(userID);
        
    } catch (error) {
        console.error('Error selecting user:', error);
        alert(`Error loading user: ${error.message}`);
    }
}

validateWalletForm() {
    const walletAction = document.getElementById('walletAction');
    const walletAmount = document.getElementById('walletAmount');
    const executeWalletBtn = document.getElementById('executeWalletAction');
    
    if (!walletAction || !walletAmount || !executeWalletBtn) return;
    
    const action = walletAction.value;
    const amount = parseFloat(walletAmount.value);
    const isValid = this.selectedUserForWalletAdmin && (
        action === 'reset' || 
        (!isNaN(amount) && amount >= 0 && (action === 'add' || action === 'deduct' || action === 'set'))
    );
    
    executeWalletBtn.disabled = !isValid;
    return isValid;
}

async executeWalletAction() {
    if (!this.selectedUserForWalletAdmin) {
        alert('Please select a user first');
        return;
    }
    
    const walletAction = document.getElementById('walletAction');
    const walletAmount = document.getElementById('walletAmount');
    const walletReason = document.getElementById('walletReason');
    
    if (!walletAction) return;
    
    const action = walletAction.value;
    const amount = action !== 'reset' ? parseFloat(walletAmount.value) : 0;
    const reason = walletReason ? walletReason.value.trim() : '';
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    
    // Validate
    if (action !== 'reset' && (isNaN(amount) || amount < 0)) {
        alert('Please enter a valid amount');
        return;
    }
    
    // Show confirmation
    let confirmMessage = '';
    const userName = this.selectedUserForWalletAdmin.userID;
    const currentBalance = parseFloat(this.selectedUserForWalletAdmin.wallet) || 0;
    
    switch(action) {
        case 'add':
            confirmMessage = `
                💰 ADD FUNDS CONFIRMATION
                
                User: ${userName}
                Current Balance: ₦${currentBalance.toFixed(2)}
                Amount to Add: ₦${amount.toFixed(2)}
                New Balance: ₦${(currentBalance + amount).toFixed(2)}
                
                Reason: ${reason || 'No reason provided'}
                
                Type "ADD" to confirm:
            `;
            break;
            
        case 'deduct':
            if (currentBalance < amount) {
                alert(`Insufficient balance. Current: ₦${currentBalance.toFixed(2)}`);
                return;
            }
            confirmMessage = `
                💸 DEDUCT FUNDS CONFIRMATION
                
                User: ${userName}
                Current Balance: ₦${currentBalance.toFixed(2)}
                Amount to Deduct: ₦${amount.toFixed(2)}
                New Balance: ₦${(currentBalance - amount).toFixed(2)}
                
                Reason: ${reason || 'No reason provided'}
                
                Type "DEDUCT" to confirm:
            `;
            break;
            
        case 'set':
            confirmMessage = `
                🔄 SET BALANCE CONFIRMATION
                
                User: ${userName}
                Current Balance: ₦${currentBalance.toFixed(2)}
                Set to: ₦${amount.toFixed(2)}
                Change: ₦${(amount - currentBalance).toFixed(2)}
                
                Reason: ${reason || 'No reason provided'}
                
                Type "SET" to confirm:
            `;
            break;
            
        case 'reset':
            confirmMessage = `
                🚨 RESET TO ZERO CONFIRMATION
                
                User: ${userName}
                Current Balance: ₦${currentBalance.toFixed(2)}
                Will be set to: ₦0.00
                
                Reason: ${reason || 'No reason provided'}
                
                Type "RESET" to confirm:
            `;
            break;
    }
    
    const userConfirmation = prompt(confirmMessage);
    const expectedConfirmation = action.toUpperCase();
    
    if (userConfirmation !== expectedConfirmation) {
        alert('Action cancelled');
        return;
    }
    
    try {
        // Disable button during processing
        const executeBtn = document.getElementById('executeWalletAction');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.innerHTML = '<span class="spinner"></span> Processing...';
        }
        
        // Perform wallet adjustment
        const result = await api.adjustUserWallet(this.selectedUserForWalletAdmin.userID, {
            action: action,
            amount: amount,
            reason: reason,
            performedBy: currentUser.userID,
            notes: `Admin action by ${currentUser.userID}`
        });
        
        if (result.success) {
            // Show success message
            this.showWalletActionStatus(`
                <div class="success-message">
                    <div class="success-icon">✅</div>
                    <div class="success-content">
                        <h4>Wallet Action Successful!</h4>
                        <div class="adjustment-details">
                            <p><strong>User:</strong> ${this.selectedUserForWalletAdmin.userID}</p>
                            <p><strong>Action:</strong> ${action.toUpperCase()}</p>
                            <p><strong>Amount:</strong> ₦${amount.toFixed(2)}</p>
                            <p><strong>Previous Balance:</strong> ₦${result.previousBalance.toFixed(2)}</p>
                            <p><strong>New Balance:</strong> ₦${result.newBalance.toFixed(2)}</p>
                            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                        </div>
                        <div class="action-actions">
                            <button class="btn-small" onclick="app.printReceiptForAdjustment(${JSON.stringify(result.adjustmentRecord).replace(/"/g, '&quot;')})">
                                🖨️ Print Receipt
                            </button>
                            <button class="btn-small" onclick="app.downloadAdjustmentReceipt(${JSON.stringify(result.adjustmentRecord).replace(/"/g, '&quot;')})">
                                📥 Download
                            </button>
                        </div>
                    </div>
                </div>
            `, 'success');
            
            // Refresh user selection with new balance
            await this.selectUserForWalletAdmin(this.selectedUserForWalletAdmin.userID);
            
            // Refresh adjustments list
            this.loadAdjustmentsList();
            
            // Clear form
            this.clearWalletForm();
            
        } else {
            throw new Error(result.message || 'Action failed');
        }
        
    } catch (error) {
        console.error('Error executing wallet action:', error);
        this.showWalletActionStatus(`
            <div class="error-message">
                <div class="error-icon">❌</div>
                <div class="error-content">
                    <h4>Action Failed</h4>
                    <p>${error.message}</p>
                </div>
            </div>
        `, 'error');
    } finally {
        // Re-enable button
        const executeBtn = document.getElementById('executeWalletAction');
        if (executeBtn) {
            executeBtn.disabled = false;
            executeBtn.innerHTML = '<span class="menu-icon">✅</span> Execute Action';
        }
    }
}

showWalletActionStatus(message, type = 'info') {
    const statusElement = document.getElementById('walletActionStatus');
    if (!statusElement) return;
    
    statusElement.innerHTML = message;
    statusElement.style.display = 'block';
    statusElement.className = `wallet-status ${type}`;
}

clearWalletForm() {
    const walletAmount = document.getElementById('walletAmount');
    const walletReason = document.getElementById('walletReason');
    const statusElement = document.getElementById('walletActionStatus');
    
    if (walletAmount) walletAmount.value = '';
    if (walletReason) walletReason.value = '';
    if (statusElement) {
        statusElement.style.display = 'none';
        statusElement.innerHTML = '';
    }
    
    // Reset validation
    this.validateWalletForm();
}

async loadAdjustmentsList() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) return;
        
        const adjustmentsList = document.getElementById('adjustmentsList');
        if (!adjustmentsList) return;
        
        // Get admin's adjustment history
        const adjustments = await api.getWalletAdjustments(currentUser.userID, true);
        
        if (adjustments.length === 0) {
            adjustmentsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">💰</span>
                    <p>No adjustments made yet</p>
                </div>
            `;
            return;
        }
        
        // Sort by timestamp (newest first)
        adjustments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        adjustmentsList.innerHTML = `
            <div class="adjustments-table">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>Amount (₦)</th>
                            <th>Previous (₦)</th>
                            <th>New (₦)</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${adjustments.map(adj => {
                            const date = new Date(adj.timestamp);
                            const isAdd = adj.action === 'add';
                            const isDeduct = adj.action === 'deduct';
                            const amountClass = isAdd ? 'positive' : isDeduct ? 'negative' : '';
                            
                            return `
                                <tr class="adjustment-item" data-adj-id="${adj.id}">
                                    <td>
                                        <div class="adjustment-date">${date.toLocaleDateString()}</div>
                                        <div class="adjustment-time">${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </td>
                                    <td>
                                        <div class="adjustment-user">${adj.userID}</div>
                                        ${adj.userName ? `<div class="adjustment-user-name">${adj.userName}</div>` : ''}
                                    </td>
                                    <td>
                                        <span class="action-badge ${adj.action}">${adj.action.toUpperCase()}</span>
                                    </td>
                                    <td class="${amountClass}">
                                        ${adj.amount ? `₦${adj.amount.toFixed(2)}` : '-'}
                                    </td>
                                    <td>₦${adj.previousBalance ? adj.previousBalance.toFixed(2) : '0.00'}</td>
                                    <td>₦${adj.newBalance ? adj.newBalance.toFixed(2) : '0.00'}</td>
                                    <td>
                                        <div class="adjustment-reason">${adj.reason || 'No reason'}</div>
                                        ${adj.notes ? `<div class="adjustment-notes">${adj.notes}</div>` : ''}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="adjustments-summary">
                Total Admin Adjustments: ${adjustments.length}
                <button class="btn-small" onclick="app.exportAdminAdjustments()">
                    📥 Export
                </button>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading adjustments:', error);
        const adjustmentsList = document.getElementById('adjustmentsList');
        if (adjustmentsList) {
            adjustmentsList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">❌</span>
                    <p>Error loading adjustments</p>
                    <button class="btn-small" onclick="app.loadAdjustmentsList()">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

async loadUserAdjustments(userID) {
    try {
        const adjustments = await api.getWalletAdjustments(userID, false);
        
        // You could display this in a separate section if needed
        console.log(`Loaded ${adjustments.length} adjustments for ${userID}`);
        
    } catch (error) {
        console.error('Error loading user adjustments:', error);
    }
}

refreshAdjustments() {
    this.loadAdjustmentsList();
}

printReceiptForAdjustment(adjustmentRecord) {
    try {
        const receiptContent = this.generateAdjustmentReceipt(adjustmentRecord);
        
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>Wallet Adjustment Receipt</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .receipt { max-width: 400px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .details { margin: 15px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin: 5px 0; }
                    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px dashed #000; text-align: center; font-size: 12px; }
                    .amount { font-size: 18px; font-weight: bold; }
                    .positive { color: #27ae60; }
                    .negative { color: #e74c3c; }
                </style>
            </head>
            <body>
                ${receiptContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        
    } catch (error) {
        console.error('Error printing receipt:', error);
        alert('Error printing receipt. Please try downloading instead.');
    }
}

generateAdjustmentReceipt(adjustment) {
    const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
    const businessName = currentUser?.businessName || 'WebStarNg';
    
    return `
        <div class="receipt">
            <div class="header">
                <h2>${businessName}</h2>
                <h3>Wallet Adjustment Receipt</h3>
                <p>Receipt ID: ${adjustment.id}</p>
            </div>
            
            <div class="details">
                <div class="detail-row">
                    <span>Date:</span>
                    <span>${new Date(adjustment.timestamp).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span>User ID:</span>
                    <span>${adjustment.userID}</span>
                </div>
                <div class="detail-row">
                    <span>Action:</span>
                    <span><strong>${adjustment.action.toUpperCase()}</strong></span>
                </div>
                <div class="detail-row">
                    <span>Amount:</span>
                    <span class="amount ${adjustment.action === 'add' ? 'positive' : 'negative'}">
                        ₦${adjustment.amount ? adjustment.amount.toFixed(2) : '0.00'}
                    </span>
                </div>
                <div class="detail-row">
                    <span>Previous Balance:</span>
                    <span>₦${adjustment.previousBalance ? adjustment.previousBalance.toFixed(2) : '0.00'}</span>
                </div>
                <div class="detail-row">
                    <span>New Balance:</span>
                    <span><strong>₦${adjustment.newBalance ? adjustment.newBalance.toFixed(2) : '0.00'}</strong></span>
                </div>
                ${adjustment.reason ? `
                <div class="detail-row">
                    <span>Reason:</span>
                    <span>${adjustment.reason}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span>Processed By:</span>
                    <span>${adjustment.performedBy || 'System'}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>This is an official record of wallet adjustment</p>
                <p>Generated by WebStarNg System</p>
                <p>${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
}

downloadAdjustmentReceipt(adjustmentRecord) {
    try {
        const receiptContent = this.generateAdjustmentReceipt(adjustmentRecord);
        const blob = new Blob([receiptContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `wallet_adjustment_${adjustmentRecord.id}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error downloading receipt:', error);
        alert('Error downloading receipt. Please try printing instead.');
    }
}

async exportAdminAdjustments() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) return;
        
        // Get admin's adjustments
        const adjustments = await api.getWalletAdjustments(currentUser.userID, true);
        
        if (adjustments.length === 0) {
            alert('No adjustments to export');
            return;
        }
        
        // Create CSV content
        let csvContent = "Date,Time,User ID,User Name,Action,Amount (₦),Previous Balance (₦),New Balance (₦),Reason,Notes\n";
        
        adjustments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        adjustments.forEach(adj => {
            const date = new Date(adj.timestamp);
            const row = [
                date.toISOString().split('T')[0],
                date.toLocaleTimeString(),
                `"${adj.userID}"`,
                `"${adj.userName || ''}"`,
                adj.action.toUpperCase(),
                adj.amount ? adj.amount.toFixed(2) : '0.00',
                adj.previousBalance ? adj.previousBalance.toFixed(2) : '0.00',
                adj.newBalance ? adj.newBalance.toFixed(2) : '0.00',
                `"${adj.reason || ''}"`,
                `"${adj.notes || ''}"`
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `admin_wallet_adjustments_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        alert(`✅ Admin adjustments exported! ${adjustments.length} records downloaded.`);
        
    } catch (error) {
        console.error('Error exporting admin adjustments:', error);
        alert('Error exporting adjustments: ' + error.message);
    }
}

// Initialize wallet admin when page loads
/*
 initWalletAdmin() {
    // Load users list
    await this.searchUsers();
    
    // Load adjustments list
    await this.loadAdjustmentsList();
    
    // Set up form validation
    this.setupWalletFormValidation();
}
*/

async initWalletAdmin() {
    try {
        console.log('Initializing Wallet Admin...');
        
        // First, verify we have a logged in user
        const currentUser = JSON.parse(localStorage.getItem('webstarng_user'));
        if (!currentUser) {
            console.error('No user logged in');
            return;
        }
        
        // Verify user is admin (group 3)
        if (currentUser.userGroup !== 3) {
            console.error('User is not admin (group 3)');
            this.showAccessDenied('Wallet Administration');
            return;
        }
        
        console.log(`Wallet Admin initialized for: ${currentUser.userID}`);
        
        // Load users list with empty search (all users)
        await this.searchUsers();
        
        // Load adjustments list
        await this.loadAdjustmentsList();
        
        // Set up form validation
        this.setupWalletFormValidation();
        
        // Focus on search input
        setTimeout(() => {
            const searchInput = document.getElementById('userSearch');
            if (searchInput) {
                searchInput.focus();
            }
        }, 500);
        
    } catch (error) {
        console.error('Error initializing wallet admin:', error);
        
        // Show error in UI
        const usersList = document.getElementById('usersList');
        if (usersList) {
            usersList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">⚠️</span>
                    <p>Initialization failed</p>
                    <p class="hint">${error.message || 'Unknown error'}</p>
                </div>
            `;
        }
    }
}

setupWalletFormValidation() {
    const walletAction = document.getElementById('walletAction');
    const walletAmount = document.getElementById('walletAmount');
    
    if (walletAction && walletAmount) {
        walletAction.addEventListener('change', () => {
            const action = walletAction.value;
            walletAmount.disabled = action === 'reset';
            walletAmount.required = action !== 'reset';
            
            if (action === 'reset') {
                walletAmount.value = '';
            }
            
            this.validateWalletForm();
        });
        
        walletAmount.addEventListener('input', () => {
            this.validateWalletForm();
        });
    }
}

/*
getUserGroupLabel(userGroup) {
    switch(parseInt(userGroup)) {
        case 0: return 'Basic';
        case 1: return 'Standard';
        case 2: return 'Manager';
        case 3: return 'Admin';
        default: return 'Unknown';
    }
}  */

getUserGroupLabel(userGroup) {
    const group = parseInt(userGroup) || 0;
    switch(group) {
        case 0: return 'Basic';
        case 1: return 'Standard';
        case 2: return 'Manager';
        case 3: return 'Admin';
        default: return `Group ${group}`;
    }
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
