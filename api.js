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
