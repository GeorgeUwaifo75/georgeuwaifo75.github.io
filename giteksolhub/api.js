// api.js - Using JSONBin.io for storage
class ApiService {
    constructor() {
        this.apiKey = CONFIG.JSONBIN_API_KEY;
        this.baseUrl = 'https://api.jsonbin.io/v3';
        this.mainBinId = CONFIG.JSONBIN_MAIN_BIN_ID;
        
        // State management
        this.localCache = {
            allusers: null,
            allproducts: null,
            allpayments: null
        };
        this.lastFetchTime = {
            allusers: 0,
            allproducts: 0,
            allpayments: 0
        };
        this.CACHE_DURATION = 30000; // 30 seconds cache
        
        // Queue for offline operations
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        // Rate limit tracking
        this.rateLimitRemaining = 10;
        this.rateLimitReset = Date.now() + 60000;
        this.retryCount = 0;
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY = 2000; // 2 seconds
    }

    // Headers for JSONBin.io requests
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            //'X-Master-Key': this.apiKey,
            'X-Access-Key': this.apiKey,
            'X-Bin-Meta': 'false' // Don't include metadata in response
        };
    }

    // Main fetch method with retry logic
    async fetchWithRetry(url, options = {}, retries = this.MAX_RETRIES) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: this.getHeaders()
            });
            
            // Check rate limit headers
            const remaining = response.headers.get('X-RateLimit-Remaining');
            const reset = response.headers.get('X-RateLimit-Reset');
            
            if (remaining) {
                this.rateLimitRemaining = parseInt(remaining);
                if (reset) {
                    this.rateLimitReset = parseInt(reset) * 1000;
                }
                this.saveRateLimitInfo();
            }
            
            if (!response.ok) {
                if (response.status === 429 && retries > 0) {
                    // Rate limit exceeded
                    const retryAfter = response.headers.get('Retry-After') || this.RETRY_DELAY / 1000;
                    console.log(`⏳ Rate limit reached. Waiting ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    return this.fetchWithRetry(url, options, retries - 1);
                }
                if (response.status === 404 && retries > 0) {
                    // Bin not found - might need creation
                    return response;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            if (retries > 0) {
                console.log(`🔄 Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // Get bin data with caching
    async getBin(binName) {
        // Return cached data if available and not expired
        if (this.localCache[binName] && 
            (Date.now() - this.lastFetchTime[binName]) < this.CACHE_DURATION) {
            console.log(`📦 Using cached ${binName} data`);
            return this.localCache[binName];
        }

        try {
            console.log(`📡 Fetching ${binName} from JSONBin.io...`);
            
            // For JSONBin.io, the entire bin contains all data
            const response = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}/latest`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Bin doesn't exist, create it
                    await this.createInitialBin();
                    return this.localCache[binName] || [];
                }
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            
            const data = await response.json();
            
            // JSONBin.io returns the data directly (with X-Bin-Meta: false)
            // The data should be an object with properties: allusers, allproducts, allpayments
            const binData = data[binName] || [];
            
            // Update cache
            this.localCache[binName] = binData;
            this.lastFetchTime[binName] = Date.now();
            
            console.log(`✅ Fetched ${binData.length} ${binName} records`);
            return binData;
            
        } catch (error) {
            console.error(`Error fetching ${binName}:`, error);
            // Return cached data if available, even if expired
            if (this.localCache[binName]) {
                console.log(`⚠️ Using cached ${binName} data due to error`);
                return this.localCache[binName];
            }
            return [];
        }
    }

    // Get the entire data structure from JSONBin.io
    async getFullData() {
        try {
            const response = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}/latest`);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching full data:', error);
            return {
                allusers: [],
                allproducts: [],
                allpayments: []
            };
        }
    }

    // Update bin data on JSONBin.io
    async updateBin(binName, data) {
        // Update cache immediately
        this.localCache[binName] = data;
        
        try {
            // Get current full data
            const fullData = await this.getFullData();
            
            // Update the specific bin
            fullData[binName] = data;
            
            // Save back to JSONBin.io using PUT
            const updateResponse = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}`, {
                method: 'PUT',
                body: JSON.stringify(fullData)
            });
            
            if (updateResponse.ok) {
                this.lastFetchTime[binName] = Date.now();
                console.log(`✅ Successfully updated ${binName} on JSONBin.io`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`Error updating ${binName}:`, error);
            // Queue the operation for later
            this.queueOperation(binName, data);
            return true; // Return true to indicate local save succeeded
        }
    }

    // Create initial bin if it doesn't exist
    async createInitialBin() {
        const initialData = {
            allusers: [],
            allproducts: [],
            allpayments: []
        };
        
        try {
            // For JSONBin.io, we need to create a new bin first
            const response = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    //'X-Master-Key': this.apiKey
                    'X-Access-Key': this.apiKey
                },
                body: JSON.stringify(initialData)
            });
            
            if (response.ok) {
                const newBin = await response.json();
                this.mainBinId = newBin.metadata.id;
                console.log('✅ Created new JSONBin.io bin with ID:', this.mainBinId);
                
                // Update config with new bin ID
                CONFIG.JSONBIN_MAIN_BIN_ID = this.mainBinId;
                
                // Show notification
                this.showBinUpdateNotification(this.mainBinId);
                return true;
            }
        } catch (error) {
            console.error('Error creating bin:', error);
        }
        return false;
    }

    showBinUpdateNotification(newBinId) {
        // Create notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 9999;
            max-width: 350px;
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <strong>✅ New JSONBin.io Bin Created!</strong>
            <p style="margin: 5px 0 0; font-size: 0.9rem;">
                <strong>Bin ID:</strong> ${newBinId}<br>
                <small>Update your config.js with this new ID.</small>
            </p>
            <button onclick="this.parentElement.remove()" style="
                background: white;
                color: #4CAF50;
                border: none;
                padding: 5px 10px;
                border-radius: 5px;
                margin-top: 10px;
                cursor: pointer;
            ">Got it</button>
        `;
        document.body.appendChild(notification);
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 15000);
    }

    // Queue offline operations
    queueOperation(binName, data) {
        this.requestQueue.push({
            binName,
            data: JSON.parse(JSON.stringify(data)), // Deep copy
            timestamp: Date.now()
        });
        
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    // Process queued operations
    async processQueue() {
        if (this.requestQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }
        
        this.isProcessingQueue = true;
        
        while (this.requestQueue.length > 0) {
            const operation = this.requestQueue.shift();
            
            try {
                // Get current full data
                const fullData = await this.getFullData();
                
                // Update the specific bin
                fullData[operation.binName] = operation.data;
                
                // Save back to JSONBin.io
                const updateResponse = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}`, {
                    method: 'PUT',
                    body: JSON.stringify(fullData)
                });
                
                if (updateResponse.ok) {
                    console.log(`✅ Synced ${operation.binName} from queue`);
                    this.lastFetchTime[operation.binName] = Date.now();
                } else {
                    // Put back in queue
                    this.requestQueue.unshift(operation);
                    break;
                }
            } catch (error) {
                console.error('Queue processing error:', error);
                this.requestQueue.unshift(operation);
                break;
            }
            
            // Wait between operations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.isProcessingQueue = false;
        
        if (this.requestQueue.length > 0) {
            // Try again in 30 seconds
            setTimeout(() => this.processQueue(), 30000);
        }
    }

    // Save rate limit info to localStorage
    saveRateLimitInfo() {
        try {
            localStorage.setItem('rateLimitInfo', JSON.stringify({
                remaining: this.rateLimitRemaining,
                reset: this.rateLimitReset
            }));
        } catch (e) {
            console.error('Error saving rate limit info:', e);
        }
    }

    // User methods
    async getAllUsers() {
        return await this.getBin(CONFIG.BINS.ALLUSERS);
    }

    async getUserByUserId(userId) {
        const users = await this.getAllUsers();
        return users.find(u => u.userId === userId);
    }

    async getUserByEmail(email) {
        const users = await this.getAllUsers();
        return users.find(u => u.email === email);
    }

    async createUser(userData) {
        const users = await this.getAllUsers();
        
        const existingUser = users.find(u => u.email === userData.email || u.userId === userData.userId);
        if (existingUser) {
            throw new Error('User already exists');
        }
        
        users.push(userData);
        await this.updateBin(CONFIG.BINS.ALLUSERS, users);
        return userData;
    }

    async updateUser(userId, updatedData) {
        const users = await this.getAllUsers();
        const index = users.findIndex(u => u.userId === userId);
        if (index !== -1) {
            users[index] = { ...users[index], ...updatedData };
            await this.updateBin(CONFIG.BINS.ALLUSERS, users);
            return users[index];
        }
        throw new Error('User not found');
    }

    async deleteUser(userId) {
        const users = await this.getAllUsers();
        const filtered = users.filter(u => u.userId !== userId);
        await this.updateBin(CONFIG.BINS.ALLUSERS, filtered);
    }

    // Product methods
    async getAllProducts() {
        return await this.getBin(CONFIG.BINS.ALLPRODUCTS);
    }

    async getActiveProducts() {
        const products = await this.getAllProducts();
        const now = new Date();
        
        return products.filter(p => {
            if (p.activityStatus !== 'Active') return false;
            
            if (p.endDate) {
                const endDate = new Date(p.endDate);
                if (endDate < now) {
                    this.deactivateExpiredProduct(p.sku);
                    return false;
                }
            }
            return true;
        });
    }

    async getProductsBySeller(userId) {
        const products = await this.getAllProducts();
        return products.filter(p => p.sellerId === userId);
    }

    async getProductsByCategory(category) {
        const products = await this.getAllProducts();
        return products.filter(p => p.category === category && p.activityStatus === 'Active');
    }

    async getProductBySku(sku) {
        const products = await this.getAllProducts();
        return products.find(p => p.sku === sku);
    }

    async createProduct(productData) {
        try {
            const products = await this.getAllProducts();
            
            const sku = 'SKU-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            
            const now = new Date();
            let endDate = new Date();
            
            if (productData.paymentStatus === 'free') {
                endDate.setDate(endDate.getDate() + 14);
            } else {
                endDate = null;
            }
            
            const newProduct = {
                sku: sku,
                name: productData.name,
                description: productData.description,
                price: parseFloat(productData.price),
                category: productData.category,
                images: productData.images || [],
                sellerId: productData.sellerId,
                sellerName: productData.sellerName || '',
                sellerContact: productData.sellerContact || '',
                activityStatus: productData.paymentStatus === 'free' ? 'Active' : 'Inactive',
                paymentStatus: productData.paymentStatus || 'free',
                paymentType: productData.paymentType || null,
                dateAdvertised: now.toISOString(),
                endDate: endDate ? endDate.toISOString() : null,
                chats: [],
                unreadChatCount: 0,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                viewCount: 0
            };
            
            products.push(newProduct);
            await this.updateBin(CONFIG.BINS.ALLPRODUCTS, products);
            
            // Update user's advert count
            const users = await this.getAllUsers();
            const userIndex = users.findIndex(u => u.userId === productData.sellerId);
            if (userIndex !== -1) {
                users[userIndex].numberOfAdverts = (users[userIndex].numberOfAdverts || 0) + 1;
                await this.updateBin(CONFIG.BINS.ALLUSERS, users);
            }
            
            return newProduct;
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    }

    async updateProduct(sku, updatedData) {
        const products = await this.getAllProducts();
        const index = products.findIndex(p => p.sku === sku);
        
        if (index !== -1) {
            products[index] = {
                ...products[index],
                ...updatedData,
                updatedAt: new Date().toISOString()
            };
            
            await this.updateBin(CONFIG.BINS.ALLPRODUCTS, products);
            return products[index];
        }
        throw new Error('Product not found');
    }

    async deleteProduct(sku) {
        const products = await this.getAllProducts();
        const filtered = products.filter(p => p.sku !== sku);
        await this.updateBin(CONFIG.BINS.ALLPRODUCTS, filtered);
    }

    async deactivateExpiredProduct(sku) {
        const products = await this.getAllProducts();
        const product = products.find(p => p.sku === sku);
        
        if (product && product.activityStatus === 'Active') {
            product.activityStatus = 'Inactive';
            await this.updateProduct(sku, { activityStatus: 'Inactive' });
        }
    }

    // Chat methods
    async addChatMessage(sku, message, senderId, senderName) {
        const products = await this.getAllProducts();
        const product = products.find(p => p.sku === sku);
        
        if (product) {
            if (!product.chats) product.chats = [];
            
            const chatMessage = {
                id: 'chat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                sender: senderId,
                senderName: senderName,
                message: message,
                timestamp: new Date().toISOString(),
                read: false
            };
            
            product.chats.push(chatMessage);
            
            if (senderId !== product.sellerId) {
                product.unreadChatCount = (product.unreadChatCount || 0) + 1;
            }
            
            await this.updateProduct(sku, { 
                chats: product.chats,
                unreadChatCount: product.unreadChatCount 
            });
            
            return chatMessage;
        }
        throw new Error('Product not found');
    }

    async markChatAsRead(sku, userId) {
        const products = await this.getAllProducts();
        const product = products.find(p => p.sku === sku);
        
        if (product && product.chats) {
            product.chats.forEach(chat => {
                if (chat.sender !== userId) {
                    chat.read = true;
                }
            });
            
            if (userId === product.sellerId) {
                product.unreadChatCount = 0;
            }
            
            await this.updateProduct(sku, { 
                chats: product.chats,
                unreadChatCount: product.unreadChatCount 
            });
        }
    }

    // Payment methods
    async getAllPayments() {
        return await this.getBin(CONFIG.BINS.ALLPAYMENTS);
    }

    async createPayment(paymentData) {
        const payments = await this.getAllPayments();
        payments.push({
            productSKU: paymentData.productSKU,
            userID: paymentData.userID,
            payAmount: paymentData.payAmount,
            paymentDate: new Date().toISOString(),
            reference: paymentData.reference
        });
        await this.updateBin(CONFIG.BINS.ALLPAYMENTS, payments);
        return paymentData;
    }

    // Initialize admin user
    async initializeAdmin() {
        try {
            const users = await this.getAllUsers();
            const adminExists = users.find(u => u.userId === 'admin01');
            
            if (!adminExists) {
                const adminUser = {
                    userId: 'admin01',
                    password: '12345@',
                    email: 'admin@giteksol.com',
                    firstName: 'Admin',
                    lastName: 'User',
                    telephone: '09038197586',
                    userGroup: 0,
                    dateOfRegistration: new Date().toISOString(),
                    userActivityStatus: 1,
                    numberOfAdverts: 0,
                    dailyPayValue: 300,
                    weeklyPayValue: 1000,
                    monthlyPayValue: 2800
                };
                
                users.push(adminUser);
                await this.updateBin(CONFIG.BINS.ALLUSERS, users);
                console.log('✅ Admin user created');
            }
        } catch (error) {
            console.error('Error initializing admin:', error);
        }
    }

    // Load from localStorage on startup (backup only)
    loadFromLocalStorage() {
        try {
            const users = localStorage.getItem('backup_allusers');
            if (users) {
                this.localCache.allusers = JSON.parse(users);
            }
            
            const products = localStorage.getItem('backup_allproducts');
            if (products) {
                this.localCache.allproducts = JSON.parse(products);
            }
            
            const payments = localStorage.getItem('backup_allpayments');
            if (payments) {
                this.localCache.allpayments = JSON.parse(payments);
            }
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }
}

const api = new ApiService();

// Load from localStorage on startup
api.loadFromLocalStorage();
