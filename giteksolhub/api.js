// api.js - Using JSONBin.io for storage with data integrity safeguards
class ApiService {
    constructor() {
        this.m_apiKey = CONFIG.JSONBIN_M_API_KEY;
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
        
        // Write queue for sequential processing
        this.writeQueue = [];
        this.isProcessingWrites = false;
        
        // Rate limit tracking
        this.rateLimitRemaining = 10;
        this.rateLimitReset = Date.now() + 60000;
        this.retryCount = 0;
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY = 2000; // 2 seconds
        
        // Version tracking for optimistic concurrency control
        this.binVersions = {
            allusers: 0,
            allproducts: 0,
            allpayments: 0
        };
        
        // Load pending operations from localStorage
        this.loadPendingOperations();
        this.loadVersionInfo();
        
        // Process queue every 30 seconds
        setInterval(() => {
            if (this.requestQueue.length > 0 && !this.isProcessingQueue) {
                this.processQueue();
            }
        }, 30000);
        
        // Process write queue every second
        setInterval(() => {
            if (this.writeQueue.length > 0 && !this.isProcessingWrites) {
                this.processWriteQueue();
            }
        }, 1000);
        
        // List of CORS proxies
        this.proxyUrls = [
            'https://cors-anywhere.herokuapp.com/',
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?'
        ];
        this.currentProxyIndex = 0;
        
        // Track proxy usage
        this.proxyUsage = {
            'https://cors-anywhere.herokuapp.com/': { used: 0, lastReset: Date.now() },
            'https://api.allorigins.win/raw?url=': { used: 0, lastReset: Date.now() },
            'https://corsproxy.io/?': { used: 0, lastReset: Date.now() }
        };
        
        // Rotate proxies every minute
        setInterval(() => this.rotateProxy(), 60000);
    }

    // Headers for JSONBin.io requests
    getHeaders(includeMeta = false) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Master-Key': this.m_apiKey,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };
        
        if (!includeMeta) {
            headers['X-Bin-Meta'] = 'false';
        }
        
        return headers;
    }

    // Version tracking methods
    saveVersionInfo() {
        try {
            localStorage.setItem('binVersions', JSON.stringify({
                versions: this.binVersions,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Error saving version info:', e);
        }
    }

    loadVersionInfo() {
        try {
            const saved = localStorage.getItem('binVersions');
            if (saved) {
                const data = JSON.parse(saved);
                // Only use if less than 1 hour old
                if (Date.now() - data.timestamp < 3600000) {
                    this.binVersions = data.versions;
                }
            }
        } catch (e) {
            console.error('Error loading version info:', e);
        }
    }

    // Proxy management
    rotateProxy() {
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyUrls.length;
        console.log(`🔄 Switched to proxy: ${this.proxyUrls[this.currentProxyIndex]}`);
    }

    getProxyUrl() {
        const proxy = this.proxyUrls[this.currentProxyIndex];
        const now = Date.now();
        
        if (now - this.proxyUsage[proxy].lastReset > 60000) {
            this.proxyUsage[proxy].used = 0;
            this.proxyUsage[proxy].lastReset = now;
        }
        
        if (this.proxyUsage[proxy].used > 30) {
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyUrls.length;
            return this.getProxyUrl();
        }
        
        this.proxyUsage[proxy].used++;
        return proxy;
    }

    // Main fetch method with cache busting
    async fetchWithRetry(url, options = {}, retries = this.MAX_RETRIES) {
        // Add cache-busting timestamp to URL for GET requests
        let requestUrl = url;
        if (!options.method || options.method === 'GET') {
            const separator = url.includes('?') ? '&' : '?';
            requestUrl = `${url}${separator}_t=${Date.now()}`;
        }

        const isGitHubPages = window.location.hostname.includes('github.io');
        const proxyUrl = isGitHubPages ? this.getProxyUrl() : '';
        const finalUrl = proxyUrl + requestUrl;
        
        console.log(`📡 Request via ${proxyUrl ? 'proxy' : 'direct'}: ${url.substring(0, 50)}...`);
        
        try {
            const response = await fetch(finalUrl, {
                ...options,
                headers: this.getHeaders(options.headers?.includeMeta),
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (response.status === 429) {
                console.log('⚠️ Rate limit hit, switching proxy...');
                this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyUrls.length;
                if (retries > 0) {
                    return this.fetchWithRetry(url, options, retries - 1);
                }
            }
            
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
                    const retryAfter = response.headers.get('Retry-After') || this.RETRY_DELAY / 1000;
                    console.log(`⏳ Rate limit reached. Waiting ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    return this.fetchWithRetry(url, options, retries - 1);
                }
                if (response.status === 404 && retries > 0) {
                    return response;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            console.error(`Fetch error with proxy ${proxyUrl}:`, error);
            
            if (isGitHubPages && retries > 0) {
                console.log('🔄 Proxy failed, trying next...');
                this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyUrls.length;
                return this.fetchWithRetry(url, options, retries - 1);
            }
            
            if (retries > 0) {
                console.log(`🔄 Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // Get bin data with caching
    async getBin(binName, forceRefresh = false) {
        if (!forceRefresh && this.localCache[binName] && 
            (Date.now() - this.lastFetchTime[binName]) < this.CACHE_DURATION) {
            console.log(`📦 Using cached ${binName} data`);
            return this.localCache[binName];
        }

        try {
            console.log(`📡 Fetching ${binName} from JSONBin.io...`);
            const response = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}/latest`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    await this.createInitialBin();
                    return this.localCache[binName] || [];
                }
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            
            const data = await response.json();
            const binData = data[binName] || [];
            
            this.localCache[binName] = binData;
            this.lastFetchTime[binName] = Date.now();
            
            console.log(`✅ Fetched ${binData.length} ${binName} records`);
            return binData;
            
        } catch (error) {
            console.error(`Error fetching ${binName}:`, error);
            if (this.localCache[binName]) {
                console.log(`⚠️ Using cached ${binName} data due to error`);
                return this.localCache[binName];
            }
            return [];
        }
    }

    // Get full data with version info
    async getFullDataWithVersion() {
        try {
            const response = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}/latest`, {
                headers: { includeMeta: true }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            
            const data = await response.json();
            return {
                record: data.record,
                version: data.metadata.version
            };
        } catch (error) {
            console.error('Error fetching full data:', error);
            return {
                record: {
                    allusers: [],
                    allproducts: [],
                    allpayments: []
                },
                version: 0
            };
        }
    }

    // Queue write operations to prevent race conditions
    queueWriteOperation(binName, data, metadata = {}) {
        return new Promise((resolve, reject) => {
            const operation = {
                id: 'write-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                binName,
                data: JSON.parse(JSON.stringify(data)),
                timestamp: Date.now(),
                metadata,
                resolve,
                reject,
                attempts: 0,
                maxAttempts: 3
            };
            
            this.writeQueue.push(operation);
            console.log(`📝 Queued write operation ${operation.id} for ${binName}`);
            
            if (!this.isProcessingWrites) {
                this.processWriteQueue();
            }
        });
    }

    // Process write queue sequentially
    async processWriteQueue() {
        if (this.writeQueue.length === 0 || this.isProcessingWrites) {
            return;
        }
        
        this.isProcessingWrites = true;
        
        while (this.writeQueue.length > 0) {
            const operation = this.writeQueue[0];
            
            try {
                console.log(`🔄 Processing write operation ${operation.id} for ${operation.binName}...`);
                
                // Get current full data with version info
                const { record: fullData, version: currentVersion } = await this.getFullDataWithVersion();
                
                // Check version mismatch
                if (this.binVersions[operation.binName] && 
                    this.binVersions[operation.binName] !== currentVersion) {
                    console.warn(`⚠️ Version mismatch for ${operation.binName}. Local: ${this.binVersions[operation.binName]}, Remote: ${currentVersion}`);
                    
                    // Intelligent merge based on bin type
                    const mergedData = this.mergeData(fullData[operation.binName] || [], operation.data, operation.binName);
                    fullData[operation.binName] = mergedData;
                } else {
                    fullData[operation.binName] = operation.data;
                }
                
                // Save back to JSONBin.io
                const updateResponse = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}`, {
                    method: 'PUT',
                    headers: { includeMeta: false },
                    body: JSON.stringify(fullData)
                });
                
                if (updateResponse.ok) {
                    this.binVersions[operation.binName] = currentVersion + 1;
                    this.lastFetchTime[operation.binName] = Date.now();
                    this.saveVersionInfo();
                    
                    console.log(`✅ Successfully processed write operation ${operation.id}`);
                    
                    this.writeQueue.shift();
                    operation.resolve(true);
                    
                    this.checkAndClearPendingForBin(operation.binName);
                } else {
                    throw new Error(`HTTP error: ${updateResponse.status}`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing write operation ${operation.id}:`, error);
                
                operation.attempts++;
                
                if (operation.attempts >= operation.maxAttempts) {
                    console.error(`⚠️ Operation ${operation.id} failed after ${operation.attempts} attempts`);
                    this.writeQueue.shift();
                    operation.reject(error);
                } else {
                    this.writeQueue.shift();
                    this.writeQueue.push(operation);
                    console.log(`⏳ Operation ${operation.id} will retry later (attempt ${operation.attempts}/${operation.maxAttempts})`);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        this.isProcessingWrites = false;
        console.log('✅ Write queue processing complete');
    }

    // Intelligent data merging
    mergeData(existingData, newData, binName) {
        if (binName === 'allusers') {
            return this.mergeUserData(existingData, newData);
        } else if (binName === 'allproducts') {
            return this.mergeProductData(existingData, newData);
        } else if (binName === 'allpayments') {
            return this.mergePaymentData(existingData, newData);
        }
        return newData;
    }

    mergeUserData(existing, incoming) {
        const userMap = new Map();
        existing.forEach(user => userMap.set(user.userId, user));
        
        incoming.forEach(user => {
            if (userMap.has(user.userId)) {
                const existingUser = userMap.get(user.userId);
                userMap.set(user.userId, {
                    ...existingUser,
                    ...user,
                    updatedAt: new Date().toISOString()
                });
            } else {
                userMap.set(user.userId, user);
            }
        });
        
        return Array.from(userMap.values());
    }

    mergeProductData(existing, incoming) {
        const productMap = new Map();
        existing.forEach(product => productMap.set(product.sku, product));
        
        incoming.forEach(product => {
            if (productMap.has(product.sku)) {
                const existingProduct = productMap.get(product.sku);
                productMap.set(product.sku, {
                    ...existingProduct,
                    ...product,
                    updatedAt: new Date().toISOString()
                });
            } else {
                productMap.set(product.sku, product);
            }
        });
        
        return Array.from(productMap.values());
    }

    mergePaymentData(existing, incoming) {
        const paymentMap = new Map();
        existing.forEach(payment => paymentMap.set(payment.reference || `${payment.productSKU}-${payment.userID}`, payment));
        
        incoming.forEach(payment => {
            const key = payment.reference || `${payment.productSKU}-${payment.userID}`;
            paymentMap.set(key, payment);
        });
        
        return Array.from(paymentMap.values());
    }

    // Validate data before write
    validateData(binName, data) {
        if (binName === 'allusers') {
            return data.every(user => 
                user.userId && 
                user.email && 
                typeof user.userGroup === 'number'
            );
        }
        
        if (binName === 'allproducts') {
            return data.every(product => 
                product.sku && 
                product.name && 
                product.price &&
                Array.isArray(product.images)
            );
        }
        
        return true;
    }

    // Update bin with queuing
    async updateBin(binName, data, metadata = {}) {
        if (!this.validateData(binName, data)) {
            console.error(`❌ Data validation failed for ${binName}`);
            throw new Error(`Invalid data structure for ${binName}`);
        }
        
        this.localCache[binName] = data;
        return this.queueWriteOperation(binName, data, metadata);
    }

    // Create initial bin
    async createInitialBin() {
        const initialData = {
            allusers: [],
            allproducts: [],
            allpayments: []
        };
        
        try {
            const response = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.m_apiKey,
                    'X-Bin-Meta': 'false'
                },
                body: JSON.stringify(initialData)
            });
            
            if (response.ok) {
                const newBin = await response.json();
                this.mainBinId = newBin.metadata.id;
                console.log('✅ Created new JSONBin.io bin with ID:', this.mainBinId);
                CONFIG.JSONBIN_MAIN_BIN_ID = this.mainBinId;
                this.showBinUpdateNotification(this.mainBinId);
                return true;
            }
        } catch (error) {
            console.error('Error creating bin:', error);
        }
        return false;
    }

    showBinUpdateNotification(newBinId) {
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
        
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 15000);
    }

    // Queue offline operations
    queueOperation(binName, data) {
        this.requestQueue.push({
            binName,
            data: JSON.parse(JSON.stringify(data)),
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
                const fullData = await this.getFullData();
                fullData[operation.binName] = operation.data;
                
                const updateResponse = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}`, {
                    method: 'PUT',
                    body: JSON.stringify(fullData)
                });
                
                if (updateResponse.ok) {
                    console.log(`✅ Synced ${operation.binName} from queue`);
                    this.lastFetchTime[operation.binName] = Date.now();
                } else {
                    this.requestQueue.unshift(operation);
                    break;
                }
            } catch (error) {
                console.error('Queue processing error:', error);
                this.requestQueue.unshift(operation);
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.isProcessingQueue = false;
        
        if (this.requestQueue.length > 0) {
            setTimeout(() => this.processQueue(), 30000);
        }
    }

    // Save rate limit info
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

    // Get full data
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

    // User methods
    async getAllUsers(forceRefresh = false) {
        return await this.getBin(CONFIG.BINS.ALLUSERS, forceRefresh);
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
        const users = await this.getAllUsers(true);
        
        const existingUser = users.find(u => u.email === userData.email || u.userId === userData.userId);
        if (existingUser) {
            throw new Error('User already exists');
        }
        
        users.push(userData);
        await this.updateBin(CONFIG.BINS.ALLUSERS, users);
        return userData;
    }

    async updateUser(userId, updatedData) {
        const users = await this.getAllUsers(true);
        const index = users.findIndex(u => u.userId === userId);
        if (index !== -1) {
            users[index] = { ...users[index], ...updatedData };
            await this.updateBin(CONFIG.BINS.ALLUSERS, users);
            return users[index];
        }
        throw new Error('User not found');
    }

    async deleteUser(userId) {
        const users = await this.getAllUsers(true);
        const filtered = users.filter(u => u.userId !== userId);
        await this.updateBin(CONFIG.BINS.ALLUSERS, filtered);
    }

    // Product methods
    async getAllProducts(forceRefresh = false) {
        return await this.getBin(CONFIG.BINS.ALLPRODUCTS, forceRefresh);
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
        try {
            const products = await this.getAllProducts();
            const now = new Date();
            
            const filtered = products.filter(p => {
                if (p.category !== category) return false;
                if (p.activityStatus !== 'Active') return false;
                if (p.endDate) {
                    const endDate = new Date(p.endDate);
                    if (endDate < now) return false;
                }
                return true;
            });
            
            console.log(`getProductsByCategory(${category}): found ${filtered.length} products`);
            return filtered;
            
        } catch (error) {
            console.error('Error in getProductsByCategory:', error);
            return [];
        }
    }

    async getProductBySku(sku) {
        const products = await this.getAllProducts();
        return products.find(p => p.sku === sku);
    }

    async createProduct(productData) {
        const products = await this.getAllProducts(true);
        
        const sku = 'SKU-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
        const now = new Date();
        let endDate = new Date();
        
        if (productData.paymentStatus === 'free') {
            endDate.setDate(endDate.getDate() + 14);
        } else {
            endDate = null;
        }
        
        const testPayload = {
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
        
        const payloadSize = JSON.stringify(testPayload).length;
        const payloadSizeMB = payloadSize / (1024 * 1024);
        
        console.log(`📦 Payload size: ${payloadSizeMB.toFixed(2)}MB`);
        
        if (payloadSizeMB > 9) {
            throw new Error(`413: Payload too large (${payloadSizeMB.toFixed(2)}MB). Please use smaller images.`);
        }
        
        const newProduct = testPayload;
        products.push(newProduct);
        
        // Update both product and user count in a coordinated way
        await this.updateBin(CONFIG.BINS.ALLPRODUCTS, products);
        
        const users = await this.getAllUsers(true);
        const userIndex = users.findIndex(u => u.userId === productData.sellerId);
        if (userIndex !== -1) {
            users[userIndex].numberOfAdverts = (users[userIndex].numberOfAdverts || 0) + 1;
            await this.updateBin(CONFIG.BINS.ALLUSERS, users);
        }
        
        console.log('✅ Product created:', newProduct);
        return newProduct;
    }

    async updateProduct(sku, updatedData) {
        const products = await this.getAllProducts(true);
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
        const products = await this.getAllProducts(true);
        const filtered = products.filter(p => p.sku !== sku);
        await this.updateBin(CONFIG.BINS.ALLPRODUCTS, filtered);
    }

    async deactivateExpiredProduct(sku) {
        const products = await this.getAllProducts(true);
        const product = products.find(p => p.sku === sku);
        
        if (product && product.activityStatus === 'Active') {
            product.activityStatus = 'Inactive';
            await this.updateProduct(sku, { activityStatus: 'Inactive' });
        }
    }

    // Chat methods
    async addChatMessage(sku, message, senderId, senderName) {
        const products = await this.getAllProducts(true);
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
        const products = await this.getAllProducts(true);
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
    async getAllPayments(forceRefresh = false) {
        return await this.getBin(CONFIG.BINS.ALLPAYMENTS, forceRefresh);
    }

    async createPayment(paymentData) {
        const payments = await this.getAllPayments(true);
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
            const users = await this.getAllUsers(true);
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

    // Pending operations management
    savePendingOperations() {
        try {
            localStorage.setItem('pendingOperations', JSON.stringify({
                queue: this.requestQueue,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Error saving pending operations:', e);
        }
    }

    loadPendingOperations() {
        try {
            const saved = localStorage.getItem('pendingOperations');
            if (saved) {
                const data = JSON.parse(saved);
                if (Date.now() - data.timestamp < 86400000) {
                    this.requestQueue = data.queue || [];
                    console.log(`📦 Loaded ${this.requestQueue.length} pending operations from storage`);
                } else {
                    localStorage.removeItem('pendingOperations');
                }
            }
        } catch (e) {
            console.error('Error loading pending operations:', e);
        }
    }

    // Enhanced queue operation
    queueOperation(binName, data, metadata = {}) {
        const operation = {
            id: 'op-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            binName,
            data: JSON.parse(JSON.stringify(data)),
            timestamp: Date.now(),
            attempts: 0,
            maxAttempts: 5,
            metadata: {
                ...metadata,
                userMessage: metadata.userMessage || 'Your changes will be saved automatically when connection is restored.'
            }
        };
        
        this.requestQueue.push(operation);
        this.savePendingOperations();
        this.showPendingOperationNotification(operation);
        
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
        
        return operation.id;
    }

    showPendingOperationNotification(operation) {
        const notification = document.createElement('div');
        notification.id = `pending-${operation.id}`;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #ff9800;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            max-width: 350px;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-clock" style="font-size: 1.2rem;"></i>
                <div>
                    <strong>Pending Save</strong>
                    <p style="margin: 5px 0 0; font-size: 0.85rem;">${operation.metadata.userMessage}</p>
                </div>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            const notif = document.getElementById(`pending-${operation.id}`);
            if (notif) notif.remove();
        }, 5000);
    }

    showQueueSuccessNotification(operation) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>
                <span>${operation.metadata.userMessage || 'Changes saved successfully!'}</span>
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

    showQueueFailedNotification(operation) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.2rem;"></i>
                <div>
                    <strong>Save Failed</strong>
                    <p style="margin: 5px 0 0; font-size: 0.85rem;">Please try again later.</p>
                </div>
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    checkAndClearPendingForBin(binName) {
        const pendingForBin = this.requestQueue.filter(op => op.binName === binName);
        
        if (pendingForBin.length > 0) {
            console.log(`🧹 Clearing ${pendingForBin.length} pending operations for ${binName}`);
            this.requestQueue = this.requestQueue.filter(op => op.binName !== binName);
            this.savePendingOperations();
        }
    }

    // Load from localStorage
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
api.loadFromLocalStorage();
