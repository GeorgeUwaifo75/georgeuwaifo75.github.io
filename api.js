// api.js - Using JSONBin.io for storage with HIGH-INTEGRITY safeguards
class ApiService {
    constructor() {
        this.m_apiKey = CONFIG.JSONBIN_M_API_KEY;
        this.apiKey = CONFIG.JSONBIN_API_KEY;
        this.baseUrl = 'https://api.jsonbin.io/v3';
        this.mainBinId = CONFIG.JSONBIN_MAIN_BIN_ID;
        
        // State management with version tracking
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
        
        // Write queue with priority and locking
        this.writeQueue = [];
        this.isProcessingWrites = false;
        this.writeLocks = {
            allusers: false,
            allproducts: false,
            allpayments: false
        };
        
        // Version tracking for optimistic concurrency control
        this.binVersions = {
            allusers: 0,
            allproducts: 0,
            allpayments: 0
        };
        
        // Pending writes by bin (for deduplication)
        this.pendingWrites = {
            allusers: null,
            allproducts: null,
            allpayments: null
        };
        
        // Rate limit tracking
        this.rateLimitRemaining = 10;
        this.rateLimitReset = Date.now() + 60000;
        this.retryCount = 0;
        this.MAX_RETRIES = 5; // Increased for better reliability
        this.RETRY_DELAY = 2000;
        
        // Load persisted state
        this.loadVersionInfo();
        this.loadPendingOperations();
        
        // Process write queue continuously
        setInterval(() => this.processWriteQueue(), 1000);
        
        // Auto-save pending operations every 30 seconds
        setInterval(() => this.savePendingOperations(), 30000);
        
        // Health check every 5 minutes
        setInterval(() => this.performHealthCheck(), 300000);
        
        
        // Run expiration check periodically (add to constructor)
        // Add this in your ApiService constructor:
         setInterval(() => this.checkAndUpdateExpiredProducts(), 3600000); // Check every hour
        
        // List of CORS proxies (fallback)
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
        
        setInterval(() => this.rotateProxy(), 60000);
    }

    // Headers for JSONBin.io requests
    getHeaders(includeMeta = false) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Master-Key': this.m_apiKey,
            'X-Access-Key': this.apiKey,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };
        
        if (!includeMeta) {
            headers['X-Bin-Meta'] = 'false';
        }
        
        return headers;
    }

    // ============ VERSION TRACKING ============

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
                if (Date.now() - data.timestamp < 3600000) { // 1 hour
                    this.binVersions = data.versions;
                }
            }
        } catch (e) {
            console.error('Error loading version info:', e);
        }
    }

    // ============ PROXY MANAGEMENT ============

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


// Add this method to ApiService class in api.js

// Check and update expired products
async checkAndUpdateExpiredProducts() {
    try {
        const products = await this.getAllProducts(true);
        const now = new Date();
        let updatedCount = 0;
        
        for (const product of products) {
            // Check if product is active and has an end date
            if (product.activityStatus === 'Active' && product.endDate) {
                const endDate = new Date(product.endDate);
                
                if (endDate < now) {
                    // Product has expired - deactivate it
                    product.activityStatus = 'Inactive';
                    await this.updateProduct(product.sku, { activityStatus: 'Inactive' });
                    updatedCount++;
                    console.log(`📅 Product expired: ${product.name} (${product.sku})`);
                    
                    // Optional: Send notification to seller
                    await this.sendExpirationNotification(product);
                }
            }
        }
        
        if (updatedCount > 0) {
            console.log(`✅ Updated ${updatedCount} expired products to inactive`);
        }
        
        return updatedCount;
    } catch (error) {
        console.error('Error checking expired products:', error);
        return 0;
    }
}

// Send expiration notification (can be extended)
async sendExpirationNotification(product) {
    try {
        const seller = await this.getUserByUserId(product.sellerId);
        if (seller && seller.email) {
            console.log(`📧 Would send expiration email to ${seller.email} for product ${product.name}`);
            // Implement email notification if needed
        }
    } catch (error) {
        console.error('Error sending expiration notification:', error);
    }
}

// Renew a product (handles both free and paid renewals)
async renewProduct(sku, paymentType = null) {
    try {
        const products = await this.getAllProducts(true);
        const product = products.find(p => p.sku === sku);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        const now = new Date();
        let endDate = null;
        let activityStatus = 'Inactive';
        let paymentStatus = product.paymentStatus;
        
        // Check if this is a free renewal (user still has free advert slots)
        const userProducts = await this.getProductsBySeller(product.sellerId);
        const activeUserProducts = userProducts.filter(p => 
            p.activityStatus === 'Active' && p.sku !== sku
        ).length;
        
        // Determine if this renewal should be free or paid
        if (paymentType === 'free' || (paymentStatus === 'free' && activeUserProducts < 2)) {
            // Free renewal (first 2 adverts)
            endDate = new Date();
            endDate.setDate(endDate.getDate() + 14); // 14 days from now
            activityStatus = 'Active';
            paymentStatus = 'free';
            paymentType = 'free';
            
            console.log(`🔄 Renewing product ${sku} as FREE advert (active for 14 days)`);
            
        } else if (paymentType) {
            // Paid renewal
            endDate = new Date();
            
            switch(paymentType) {
                case 'daily':
                    endDate.setDate(endDate.getDate() + 1);
                    break;
                case 'weekly':
                    endDate.setDate(endDate.getDate() + 7);
                    break;
                case 'monthly':
                    endDate.setMonth(endDate.getMonth() + 1);
                    break;
                default:
                    throw new Error('Invalid payment type for renewal');
            }
            
            activityStatus = 'Active';
            paymentStatus = 'paid';
            
            console.log(`🔄 Renewing product ${sku} as PAID advert (${paymentType}, active until ${endDate.toISOString()})`);
            
        } else {
            throw new Error('Cannot renew product. Please select a payment plan or check your free advert eligibility.');
        }
        
        // Update product with new dates
        const updatedProduct = {
            ...product,
            endDate: endDate.toISOString(),
            activityStatus: activityStatus,
            paymentStatus: paymentStatus,
            paymentType: paymentType,
            dateAdvertised: now.toISOString(),
            updatedAt: now.toISOString(),
            renewedCount: (product.renewedCount || 0) + 1,
            lastRenewalDate: now.toISOString()
        };
        
        await this.updateProduct(sku, updatedProduct);
        
        console.log(`✅ Product ${sku} renewed successfully. Active until: ${endDate.toISOString()}`);
        
        return {
            success: true,
            product: updatedProduct,
            endDate: endDate,
            isFree: paymentType === 'free' || paymentStatus === 'free'
        };
        
    } catch (error) {
        console.error('Error renewing product:', error);
        throw error;
    }
}

// Get renewal eligibility for a product
// Get renewal eligibility for a product
async getRenewalEligibility(sku) {
    try {
        const product = await this.getProductBySku(sku);
        if (!product) {
            throw new Error('Product not found');
        }
        
        const userProducts = await this.getProductsBySeller(product.sellerId);
        const activeUserProducts = userProducts.filter(p => 
            p.activityStatus === 'Active' && p.sku !== sku
        ).length;
        
        // Get admin rates
        const admin = await this.getUserByUserId('admin01');
        const dailyRate = admin?.dailyPayValue || 300;
        const weeklyRate = admin?.weeklyPayValue || 1000;
        const monthlyRate = admin?.monthlyPayValue || 2800;
        
        const hasFreeSlot = activeUserProducts < 2;
        
        return {
            sku: sku,
            productName: product.name,
            currentStatus: product.activityStatus,
            currentPaymentStatus: product.paymentStatus,
            currentEndDate: product.endDate,
            canRenewFree: hasFreeSlot,
            canRenewPaid: true,
            freeSlotsRemaining: Math.max(0, 2 - activeUserProducts),
            isExpired: product.activityStatus !== 'Active' || 
                      (product.endDate && new Date(product.endDate) < new Date()),
            dailyRate: dailyRate,
            weeklyRate: weeklyRate,
            monthlyRate: monthlyRate
        };
        
    } catch (error) {
        console.error('Error checking renewal eligibility:', error);
        throw error;
    }
}



    // ============ CORE FETCH WITH RETRY ============

    async fetchWithRetry(url, options = {}, retries = this.MAX_RETRIES) {
        let requestUrl = url;
        if (!options.method || options.method === 'GET') {
            const separator = url.includes('?') ? '&' : '?';
            requestUrl = `${url}${separator}_t=${Date.now()}`;
        }

        const isGitHubPages = window.location.hostname.includes('github.io');
        const useProxy = false; // Try without proxy first
        const proxyUrl = (isGitHubPages && useProxy) ? this.getProxyUrl() : '';
        const finalUrl = proxyUrl + requestUrl;
        
        console.log(`📡 Request: ${url.substring(0, 50)}...`);
        
        const headers = this.getHeaders(options.includeMeta || false);
        
        try {
            const response = await fetch(finalUrl, {
                ...options,
                headers: headers,
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
            console.error(`Fetch error:`, error);
            
            if (isGitHubPages && !useProxy && retries > 0) {
                console.log('🔄 Possible CORS error, trying with proxy...');
                const proxyEnabledOptions = { ...options, useProxy: true };
                return this.fetchWithRetry(url, proxyEnabledOptions, retries - 1);
            }
            
            if (retries > 0) {
                console.log(`🔄 Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // ============ GET FULL DATA WITH VERSION ============

    async getFullDataWithVersion() {
        try {
            const response = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}/latest`, {
                includeMeta: true
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

    // ============ GET BIN DATA WITH CACHING ============

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

    // ============ HIGH-INTEGRITY WRITE QUEUE ============

    async updateBin(binName, data, metadata = {}) {
        // Validate data first
        if (!this.validateData(binName, data)) {
            console.error(`❌ Data validation failed for ${binName}`);
            throw new Error(`Invalid data structure for ${binName}`);
        }
        
        // Update cache immediately for responsive UI
        this.localCache[binName] = data;
        
        // Create a promise that will resolve when the write is complete
        return new Promise((resolve, reject) => {
            // If there's already a pending write for this bin, merge the data
            if (this.pendingWrites[binName]) {
                console.log(`🔄 Merging with pending write for ${binName}`);
                this.pendingWrites[binName].data = this.mergeData(
                    this.pendingWrites[binName].data, 
                    data, 
                    binName
                );
                this.pendingWrites[binName].timestamp = Date.now();
                this.pendingWrites[binName].resolve = resolve;
                this.pendingWrites[binName].reject = reject;
            } else {
                // Create new pending write
                const operation = {
                    id: 'write-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                    binName,
                    data: JSON.parse(JSON.stringify(data)),
                    timestamp: Date.now(),
                    resolve,
                    reject,
                    attempts: 0,
                    maxAttempts: 5,
                    metadata
                };
                
                this.pendingWrites[binName] = operation;
                this.writeQueue.push(operation);
                console.log(`📝 Queued write operation ${operation.id} for ${binName}`);
            }
            
            if (!this.isProcessingWrites) {
                this.processWriteQueue();
            }
        });
    }

    async processWriteQueue() {
        if (this.writeQueue.length === 0 || this.isProcessingWrites) {
            return;
        }
        
        this.isProcessingWrites = true;
        
        // Sort queue by timestamp (oldest first)
        this.writeQueue.sort((a, b) => a.timestamp - b.timestamp);
        
        while (this.writeQueue.length > 0) {
            const operation = this.writeQueue[0];
            
            // Skip if too old (> 5 minutes)
            if (Date.now() - operation.timestamp > 300000) {
                console.log(`⚠️ Dropping expired operation ${operation.id}`);
                this.writeQueue.shift();
                if (this.pendingWrites[operation.binName] === operation) {
                    this.pendingWrites[operation.binName] = null;
                }
                operation.reject(new Error('Operation expired'));
                continue;
            }
            
            try {
                console.log(`🔄 Processing write operation ${operation.id} for ${operation.binName}...`);
                
                // Acquire lock for this bin
                if (this.writeLocks[operation.binName]) {
                    console.log(`⏳ ${operation.binName} is locked, will retry later`);
                    // Move to end of queue
                    this.writeQueue.shift();
                    this.writeQueue.push(operation);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                
                this.writeLocks[operation.binName] = true;
                
                // Get current data with version
                const { record: fullData, version: currentVersion } = await this.getFullDataWithVersion();
                
                // Check if our version matches
                if (this.binVersions[operation.binName] && 
                    this.binVersions[operation.binName] !== currentVersion) {
                    console.warn(`⚠️ Version mismatch for ${operation.binName}. Local: ${this.binVersions[operation.binName]}, Remote: ${currentVersion}`);
                    
                    // Intelligent merge
                    const existingData = fullData[operation.binName] || [];
                    const mergedData = this.mergeData(existingData, operation.data, operation.binName);
                    fullData[operation.binName] = mergedData;
                } else {
                    fullData[operation.binName] = operation.data;
                }
                
                // Save back to JSONBin.io
                const updateResponse = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}`, {
                    method: 'PUT',
                    includeMeta: false,
                    body: JSON.stringify(fullData)
                });
                
                if (updateResponse.ok) {
                    // Update version tracking
                    this.binVersions[operation.binName] = currentVersion + 1;
                    this.lastFetchTime[operation.binName] = Date.now();
                    this.saveVersionInfo();
                    
                    console.log(`✅ Successfully processed write operation ${operation.id}`);
                    
                    // Remove from queue and resolve
                    this.writeQueue.shift();
                    if (this.pendingWrites[operation.binName] === operation) {
                        this.pendingWrites[operation.binName] = null;
                    }
                    operation.resolve(true);
                    
                    // Show success notification
                    this.showQueueSuccessNotification(operation);
                    
                } else {
                    throw new Error(`HTTP error: ${updateResponse.status}`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing write operation ${operation.id}:`, error);
                
                operation.attempts++;
                
                if (operation.attempts >= operation.maxAttempts) {
                    console.error(`⚠️ Operation ${operation.id} failed after ${operation.attempts} attempts`);
                    this.writeQueue.shift();
                    if (this.pendingWrites[operation.binName] === operation) {
                        this.pendingWrites[operation.binName] = null;
                    }
                    operation.reject(error);
                    this.showQueueFailedNotification(operation);
                } else {
                    // Move to end of queue for retry
                    this.writeQueue.shift();
                    this.writeQueue.push(operation);
                    console.log(`⏳ Operation ${operation.id} will retry later (attempt ${operation.attempts}/${operation.maxAttempts})`);
                }
            } finally {
                // Release lock
                this.writeLocks[operation.binName] = false;
            }
            
            // Small delay between operations
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        this.isProcessingWrites = false;
        console.log('✅ Write queue processing complete');
    }

    // ============ INTELLIGENT DATA MERGING ============

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
        
        // Index existing users
        existing.forEach(user => userMap.set(user.userId, user));
        
        // Merge incoming users
        incoming.forEach(user => {
            if (userMap.has(user.userId)) {
                const existingUser = userMap.get(user.userId);
                // Merge, preferring non-empty values and latest timestamps
                userMap.set(user.userId, {
                    ...existingUser,
                    ...user,
                    updatedAt: new Date().toISOString(),
                    // Ensure critical fields are preserved
                    password: user.password || existingUser.password,
                    email: user.email || existingUser.email,
                    userGroup: user.userGroup !== undefined ? user.userGroup : existingUser.userGroup
                });
            } else {
                userMap.set(user.userId, user);
            }
        });
        
        return Array.from(userMap.values());
    }

    mergeProductData(existing, incoming) {
        const productMap = new Map();
        
        // Index existing products
        existing.forEach(product => productMap.set(product.sku, product));
        
        // Merge incoming products
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
        
        // Use reference as key, or create composite key
        existing.forEach(payment => {
            const key = payment.reference || `${payment.productSKU}-${payment.userID}-${payment.paymentDate}`;
            paymentMap.set(key, payment);
        });
        
        incoming.forEach(payment => {
            const key = payment.reference || `${payment.productSKU}-${payment.userID}-${payment.paymentDate}`;
            paymentMap.set(key, payment);
        });
        
        return Array.from(paymentMap.values());
    }

    // ============ DATA VALIDATION ============

    
    // In api.js - Update validateData to be more flexible
        validateData(binName, data) {
            if (!Array.isArray(data)) {
                console.error(`❌ Data for ${binName} is not an array`);
                return false;
            }
            
            if (binName === 'allusers') {
                // More flexible validation - only check for essential fields
                return data.every(user => 
                    user && 
                    user.userId && 
                    user.email
                    // password can be optional for existing users
                    // userGroup can be optional for backward compatibility
                );
            }
            
            if (binName === 'allproducts') {
                // Much more flexible validation for products
                return data.every(product => {
                    // Only check for the absolute essentials
                    const hasRequired = product && 
                        product.sku && 
                        product.name;
                    
                    // Log any issues for debugging
                    if (!hasRequired) {
                        console.warn('Product missing required fields:', product);
                    }
                    
                    return hasRequired;
                });
            }
            
            if (binName === 'allpayments') {
                return data.every(payment => 
                    payment && 
                    (payment.productSKU || payment.reference)
                );
            }
            
            return true;
        }

    // ============ HIGH-INTEGRITY USER METHODS ============


// Add to ApiService class in api.js
async trackWhatsAppClick(sku) {
    try {
        const products = await this.getAllProducts(true);
        const product = products.find(p => p.sku === sku);
        
        if (product) {
            // Increment a whatsappClickCount field
            product.whatsappClicks = (product.whatsappClicks || 0) + 1;
            await this.updateProduct(sku, { whatsappClicks: product.whatsappClicks });
            console.log(`✅ WhatsApp click tracked for product ${sku}`);
        }
    } catch (error) {
        console.error('Error tracking WhatsApp click:', error);
    }
}



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
        // Validate user data
        if (!userData.userId || !userData.email || !userData.password) {
            throw new Error('Missing required user fields');
        }
        
        // Get fresh data
        const users = await this.getAllUsers(true);
        
        // Check for existing user
        const existingUser = users.find(u => 
            u.email === userData.email || u.userId === userData.userId
        );
        
        if (existingUser) {
            throw new Error('User already exists');
        }
        
        // Add new user
        users.push(userData);
        
        // Update with version tracking
        await this.updateBin(CONFIG.BINS.ALLUSERS, users, {
            userMessage: 'Creating new user account...'
        });
        
        return userData;
    }

    async updateUser(userId, updatedData) {
        // Get fresh data
        const users = await this.getAllUsers(true);
        const index = users.findIndex(u => u.userId === userId);
        
        if (index === -1) {
            throw new Error('User not found');
        }
        
        // Update user data
        users[index] = {
            ...users[index],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        
        // Update with version tracking
        await this.updateBin(CONFIG.BINS.ALLUSERS, users, {
            userMessage: 'Updating user profile...'
        });
        
        return users[index];
    }

    async deleteUser(userId) {
        // Prevent admin deletion
        if (userId === 'admin01') {
            throw new Error('Cannot delete admin user');
        }
        
        // Get fresh data
        const users = await this.getAllUsers(true);
        const filtered = users.filter(u => u.userId !== userId);
        
        // Update with version tracking
        await this.updateBin(CONFIG.BINS.ALLUSERS, filtered, {
            userMessage: 'Deleting user account...'
        });
    }

    // ============ PRODUCT METHODS ============
/*
    async getAllProducts(forceRefresh = false) {
        return await this.getBin(CONFIG.BINS.ALLPRODUCTS, forceRefresh);
    }
    */
    
    // In api.js - Verify getAllProducts
async getAllProducts(forceRefresh = false) {
    const products = await this.getBin(CONFIG.BINS.ALLPRODUCTS, forceRefresh);
    
    // Ensure each product has at least the minimum structure
    if (Array.isArray(products)) {
        return products.map(p => ({
            sku: p.sku || '',
            name: p.name || '',
            description: p.description || '',
            price: p.price || 0,
            category: p.category || '',
            images: Array.isArray(p.images) ? p.images : [],
            sellerId: p.sellerId || '',
            activityStatus: p.activityStatus || 'Inactive',
            paymentStatus: p.paymentStatus || 'free',
            ...p // Keep all other fields
        }));
    }
    
    return [];
}

    async getProductsBySeller(userId) {
        const products = await this.getAllProducts();
        return products.filter(p => p.sellerId === userId);
    }

    
    
// Update getProductsByCategory to ensure only active, non-expired products
async getProductsByCategory(category) {
    try {
        console.log(`🔍 Fetching products for category: "${category}"`);
        
        // First, check and update expired products
        await this.checkAndUpdateExpiredProducts();
        
        const products = await this.getAllProducts();
        console.log(`📦 Total products fetched: ${products.length}`);
        
        const now = new Date();
        
        const filtered = products.filter(p => {
            // Check if category matches
            const categoryMatch = p.category === category;
            
            // Check if active
            const isActive = p.activityStatus === 'Active';
            
            // Check if not expired
            let notExpired = true;
            if (p.endDate) {
                const endDate = new Date(p.endDate);
                notExpired = endDate > now;
            }
            
            return categoryMatch && isActive && notExpired;
        });
        
        console.log(`✅ Found ${filtered.length} active products in category "${category}"`);
        
        return filtered;
        
    } catch (error) {
        console.error('❌ Error in getProductsByCategory:', error);
        return [];
    }
}

    async getProductBySku(sku) {
        const products = await this.getAllProducts();
        return products.find(p => p.sku === sku);
    }

// In api.js - Update createProduct method
async createProduct(productData) {
    const products = await this.getAllProducts(true);
    
    const sku = productData.sku || ('SKU-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase());
    const now = new Date();
    
    const newProduct = {
        sku: sku,
        name: productData.name,
        description: productData.description,
        price: parseFloat(productData.price),
        category: productData.category,
        state: productData.state || 'Not specified',
        images: productData.images || [],
        sellerId: productData.sellerId,
        sellerName: productData.sellerName || '',
        sellerContact: productData.sellerContact || '',
        activityStatus: productData.activityStatus || 'Inactive',
        paymentStatus: productData.paymentStatus || 'free',
        paymentType: productData.paymentType || null,
        dateAdvertised: productData.dateAdvertised || now.toISOString(),
        endDate: productData.endDate || null,
        chats: productData.chats || [],
        unreadChatCount: productData.unreadChatCount || 0,
        createdAt: productData.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
        viewCount: productData.viewCount || 0
    };
    
    const payloadSize = JSON.stringify(newProduct).length;
    const payloadSizeMB = payloadSize / (1024 * 1024);
    
    console.log(`📦 Payload size: ${payloadSizeMB.toFixed(2)}MB`);
    
    if (payloadSizeMB > 9) {
        throw new Error(`413: Payload too large (${payloadSizeMB.toFixed(2)}MB). Please use smaller images.`);
    }
    
    products.push(newProduct);
    
    await this.updateBin(CONFIG.BINS.ALLPRODUCTS, products);
    
    // Update user's advert count only for free products or after payment
    if (productData.paymentStatus !== 'pending') {
        const users = await this.getAllUsers(true);
        const userIndex = users.findIndex(u => u.userId === productData.sellerId);
        if (userIndex !== -1) {
            users[userIndex].numberOfAdverts = (users[userIndex].numberOfAdverts || 0) + 1;
            await this.updateBin(CONFIG.BINS.ALLUSERS, users);
        }
    }
    
    console.log('✅ Product created:', newProduct);
    return newProduct;
} 

    async updateProduct(sku, updatedData) {
        const products = await this.getAllProducts(true);
        const index = products.findIndex(p => p.sku === sku);
        
        if (index === -1) {
            throw new Error('Product not found');
        }
        
        products[index] = {
            ...products[index],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        
        await this.updateBin(CONFIG.BINS.ALLPRODUCTS, products);
        return products[index];
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

    // ============ PAYMENT METHODS ============

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

    // ============ CHAT METHODS ============

    async addChatMessage(sku, message, senderId, senderName) {
        const products = await this.getAllProducts(true);
        const product = products.find(p => p.sku === sku);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
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

    // ============ INITIALIZATION ============

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
                    'X-Access-Key': this.apiKey,
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

    // ============ PENDING OPERATIONS MANAGEMENT ============

    savePendingOperations() {
        try {
            localStorage.setItem('pendingOperations', JSON.stringify({
                queue: this.writeQueue.map(op => ({
                    id: op.id,
                    binName: op.binName,
                    data: op.data,
                    timestamp: op.timestamp,
                    attempts: op.attempts,
                    metadata: op.metadata
                })),
                pendingWrites: Object.keys(this.pendingWrites).reduce((acc, key) => {
                    if (this.pendingWrites[key]) {
                        acc[key] = {
                            id: this.pendingWrites[key].id,
                            binName: this.pendingWrites[key].binName,
                            timestamp: this.pendingWrites[key].timestamp
                        };
                    }
                    return acc;
                }, {}),
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
                if (Date.now() - data.timestamp < 86400000) { // 24 hours
                    this.writeQueue = data.queue || [];
                    console.log(`📦 Loaded ${this.writeQueue.length} pending operations from storage`);
                } else {
                    localStorage.removeItem('pendingOperations');
                }
            }
        } catch (e) {
            console.error('Error loading pending operations:', e);
        }
    }

    // ============ NOTIFICATIONS ============

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
                <span>${operation.metadata?.userMessage|| 'Loaded successfully!'}</span>
              
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

   //     <span>${operation.metadata?.userMessage || 'Changes saved successfully!'}</span>
          
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

    // ============ RATE LIMIT ============

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

    // ============ HEALTH CHECK ============

    async performHealthCheck() {
        try {
            const response = await this.fetchWithRetry(`${this.baseUrl}/b/${this.mainBinId}/latest`, {
                includeMeta: true
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Health check passed', {
                    version: data.metadata.version,
                    userCount: data.record.allusers?.length || 0,
                    productCount: data.record.allproducts?.length || 0
                });
            }
        } catch (error) {
            console.error('❌ Health check failed:', error);
        }
    }

    // ============ LOCAL STORAGE BACKUP ============

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
