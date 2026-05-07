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
        this.MAX_RETRIES = 5;
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
        
        // Expiration check every hour
        setInterval(() => this.checkAndUpdateExpiredProducts(), 3600000);
        
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

    // ============ EXPIRATION & RENEWAL ============

    async checkAndUpdateExpiredProducts() {
        try {
            const products = await this.getAllProducts(true);
            const now = new Date();
            let updatedCount = 0;
            
            for (const product of products) {
                if (product.activityStatus === 'Active' && product.endDate) {
                    const endDate = new Date(product.endDate);
                    if (endDate < now) {
                        product.activityStatus = 'Inactive';
                        await this.updateProduct(product.sku, { activityStatus: 'Inactive' });
                        updatedCount++;
                        console.log(`📅 Product expired: ${product.name} (${product.sku})`);
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

    async sendExpirationNotification(product) {
        try {
            const seller = await this.getUserByUserId(product.sellerId);
            if (seller && seller.email) {
                console.log(`📧 Would send expiration email to ${seller.email} for product ${product.name}`);
            }
        } catch (error) {
            console.error('Error sending expiration notification:', error);
        }
    }

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
            
            const userProducts = await this.getProductsBySeller(product.sellerId);
            const activeUserProducts = userProducts.filter(p => 
                p.activityStatus === 'Active' && p.sku !== sku
            ).length;
            
            if (paymentType === 'free' || (paymentStatus === 'free' && activeUserProducts < 2)) {
                endDate = new Date();
                endDate.setDate(endDate.getDate() + 14);
                activityStatus = 'Active';
                paymentStatus = 'free';
                paymentType = 'free';
                console.log(`🔄 Renewing product ${sku} as FREE advert (active for 14 days)`);
            } else if (paymentType) {
                endDate = new Date();
                switch(paymentType) {
                    case 'daily':   endDate.setDate(endDate.getDate() + 1); break;
                    case 'weekly':  endDate.setDate(endDate.getDate() + 7); break;
                    case 'monthly': endDate.setMonth(endDate.getMonth() + 1); break;
                    default: throw new Error('Invalid payment type for renewal');
                }
                activityStatus = 'Active';
                paymentStatus = 'paid';
                console.log(`🔄 Renewing product ${sku} as PAID advert (${paymentType})`);
            } else {
                throw new Error('Cannot renew product. Please select a payment plan.');
            }
            
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

    async getRenewalEligibility(sku) {
        try {
            const product = await this.getProductBySku(sku);
            if (!product) throw new Error('Product not found');
            
            const userProducts = await this.getProductsBySeller(product.sellerId);
            const activeUserProducts = userProducts.filter(p => 
                p.activityStatus === 'Active' && p.sku !== sku
            ).length;
            
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
        const useProxy = false;
        const proxyUrl = (isGitHubPages && useProxy) ? this.getProxyUrl() : '';
        const finalUrl = proxyUrl + requestUrl;
        
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
                if (reset) this.rateLimitReset = parseInt(reset) * 1000;
                this.saveRateLimitInfo();
            }
            
            if (!response.ok) {
                if (response.status === 429 && retries > 0) {
                    const retryAfter = response.headers.get('Retry-After') || this.RETRY_DELAY / 1000;
                    console.log(`⏳ Rate limit reached. Waiting ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    return this.fetchWithRetry(url, options, retries - 1);
                }
                if (response.status === 404 && retries > 0) return response;
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            console.error(`Fetch error:`, error);
            
            if (isGitHubPages && !useProxy && retries > 0) {
                const proxyEnabledOptions = { ...options, useProxy: true };
                return this.fetchWithRetry(url, proxyEnabledOptions, retries - 1);
            }
            
            if (retries > 0) {
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
            
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
            
            const data = await response.json();
            return {
                record: data.record,
                version: data.metadata.version
            };
        } catch (error) {
            console.error('Error fetching full data:', error);
            return {
                record: { allusers: [], allproducts: [], allpayments: [] },
                version: 0
            };
        }
    }

    // ============ GET BIN DATA WITH CACHING ============

    async getBin(binName, forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh &&
            this.localCache[binName] &&
            (now - this.lastFetchTime[binName]) < this.CACHE_DURATION) {
            console.log(`📦 Using cached ${binName} data`);
            return this.localCache[binName];
        }

        try {
            console.log(`📡 Fetching full document from JSONBin.io (for ${binName})...`);
            const response = await this.fetchWithRetry(
                `${this.baseUrl}/b/${this.mainBinId}/latest`
            );

            if (!response.ok) {
                if (response.status === 404) {
                    await this.createInitialBin();
                    return this.localCache[binName] || [];
                }
                throw new Error(`Failed to fetch: ${response.status}`);
            }

            const fullDoc = await response.json();
            const fetchedAt = Date.now();

            // Cache ALL arrays from the document in one pass
            ['allusers', 'allproducts', 'allpayments'].forEach(key => {
                if (Array.isArray(fullDoc[key])) {
                    this.localCache[key] = fullDoc[key];
                    this.lastFetchTime[key] = fetchedAt;
                }
            });

            const result = this.localCache[binName] || [];
            console.log(`✅ Fetched ${result.length} ${binName} records`);
            return result;

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
        if (!this.validateData(binName, data)) {
            console.error(`❌ Data validation failed for ${binName}`);
            throw new Error(`Invalid data structure for ${binName}`);
        }

        return new Promise((resolve, reject) => {
            if (this.pendingWrites[binName]) {
                console.log(`🔄 Merging with pending write for ${binName}`);
                this.pendingWrites[binName].data = this.mergeData(
                    this.pendingWrites[binName].data,
                    data,
                    binName
                );
                this.pendingWrites[binName].timestamp = Date.now();
                this.pendingWrites[binName].resolvers.push(resolve);
                this.pendingWrites[binName].rejectors.push(reject);
            } else {
                const operation = {
                    id: 'write-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                    binName,
                    data: JSON.parse(JSON.stringify(data)),
                    timestamp: Date.now(),
                    resolvers: [resolve],
                    rejectors: [reject],
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
        if (this.writeQueue.length === 0 || this.isProcessingWrites) return;

        this.isProcessingWrites = true;
        this.writeQueue.sort((a, b) => a.timestamp - b.timestamp);

        while (this.writeQueue.length > 0) {
            const operation = this.writeQueue[0];

            if (Date.now() - operation.timestamp > 300000) {
                console.log(`⚠️ Dropping expired operation ${operation.id}`);
                this.writeQueue.shift();
                if (this.pendingWrites[operation.binName] === operation) {
                    this.pendingWrites[operation.binName] = null;
                }
                const err = new Error('Operation expired');
                operation.rejectors.forEach(r => r(err));
                continue;
            }

            if (this.writeLocks[operation.binName]) {
                console.log(`⏳ ${operation.binName} is locked, will retry later`);
                this.writeQueue.shift();
                this.writeQueue.push(operation);
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            this.writeLocks[operation.binName] = true;

            try {
                console.log(`🔄 Processing write ${operation.id} for ${operation.binName}...`);

                const { record: fullDoc } = await this.getFullDataWithVersion();

                // Always merge to avoid overwriting concurrent changes
                const serverSide = fullDoc[operation.binName];
                if (Array.isArray(serverSide) && serverSide.length > 0) {
                    fullDoc[operation.binName] = this.mergeData(
                        serverSide,
                        operation.data,
                        operation.binName
                    );
                } else {
                    fullDoc[operation.binName] = operation.data;
                }

                // CRITICAL FIX: Ensure the other two arrays are never emptied.
                // If the freshly-fetched fullDoc is missing allproducts or
                // allpayments (e.g. a previous write left them empty), restore
                // them from localCache before writing.
                ['allusers', 'allproducts', 'allpayments'].forEach(key => {
                    if (key === operation.binName) return; // already handled above
                    if (!Array.isArray(fullDoc[key]) || fullDoc[key].length === 0) {
                        if (this.localCache[key] && this.localCache[key].length > 0) {
                            console.warn(`⚠️ Server returned empty ${key}; restoring from cache`);
                            fullDoc[key] = this.localCache[key];
                        }
                    }
                });

                const updateResponse = await this.fetchWithRetry(
                    `${this.baseUrl}/b/${this.mainBinId}`,
                    {
                        method: 'PUT',
                        includeMeta: false,
                        body: JSON.stringify(fullDoc)
                    }
                );

                if (updateResponse.ok) {
                    const confirmedAt = Date.now();
                    ['allusers', 'allproducts', 'allpayments'].forEach(key => {
                        if (Array.isArray(fullDoc[key])) {
                            this.localCache[key] = fullDoc[key];
                            this.lastFetchTime[key] = confirmedAt;
                        }
                    });

                    this.saveToLocalStorage();
                    this.binVersions[operation.binName] =
                        (this.binVersions[operation.binName] || 0) + 1;
                    this.saveVersionInfo();

                    console.log(`✅ Write ${operation.id} confirmed`);

                    this.writeQueue.shift();
                    if (this.pendingWrites[operation.binName] === operation) {
                        this.pendingWrites[operation.binName] = null;
                    }
                    operation.resolvers.forEach(r => r(true));
                    this.showQueueSuccessNotification(operation);
                } else {
                    throw new Error(`HTTP error: ${updateResponse.status}`);
                }

            } catch (error) {
                console.error(`❌ Error processing write ${operation.id}:`, error);
                operation.attempts++;

                if (operation.attempts >= operation.maxAttempts) {
                    console.error(`⚠️ Operation ${operation.id} failed after ${operation.attempts} attempts`);
                    this.writeQueue.shift();
                    if (this.pendingWrites[operation.binName] === operation) {
                        this.pendingWrites[operation.binName] = null;
                    }
                    operation.rejectors.forEach(r => r(error));
                    this.showQueueFailedNotification(operation);
                } else {
                    this.writeQueue.shift();
                    this.writeQueue.push(operation);
                    console.log(`⏳ Will retry ${operation.id} (attempt ${operation.attempts}/${operation.maxAttempts})`);
                }
            } finally {
                this.writeLocks[operation.binName] = false;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.isProcessingWrites = false;
        console.log('✅ Write queue processing complete');
    }

    // ============ INTELLIGENT DATA MERGING ============

    mergeData(existingData, newData, binName) {
        if (binName === 'allusers') return this.mergeUserData(existingData, newData);
        if (binName === 'allproducts') return this.mergeProductData(existingData, newData);
        if (binName === 'allpayments') return this.mergePaymentData(existingData, newData);
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
                    updatedAt: new Date().toISOString(),
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

    validateData(binName, data) {
        if (!Array.isArray(data)) {
            console.error(`❌ Data for ${binName} is not an array`);
            return false;
        }
        
        if (binName === 'allusers') {
            return data.every(user => user && user.userId && user.email);
        }
        
        if (binName === 'allproducts') {
            return data.every(product => {
                const hasRequired = product && product.sku && product.name;
                if (!hasRequired) console.warn('Product missing required fields:', product);
                return hasRequired;
            });
        }
        
        if (binName === 'allpayments') {
            return data.every(payment => payment && (payment.productSKU || payment.reference));
        }
        
        return true;
    }

    // ============ WHATSAPP TRACKING ============

    async trackWhatsAppClick(sku) {
        try {
            const products = await this.getAllProducts(true);
            const product = products.find(p => p.sku === sku);
            if (product) {
                product.whatsappClicks = (product.whatsappClicks || 0) + 1;
                await this.updateProduct(sku, { whatsappClicks: product.whatsappClicks });
            }
        } catch (error) {
            console.error('Error tracking WhatsApp click:', error);
        }
    }

    // ============ USER METHODS ============

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
        if (!userData.userId || !userData.email || !userData.password) {
            throw new Error('Missing required user fields');
        }
        
        // ── FIX (Signup Data Loss) ─────────────────────────────────────────
        // Force-refresh the FULL document so localCache for ALL three arrays
        // reflects the current server state before we touch anything.
        // Without this, a subsequent createProduct() call (which also calls
        // getBin with forceRefresh) could race against the pending write and
        // see a stale allproducts/allpayments from before this session started.
        await this.getBin('allusers', true);  // refreshes all 3 arrays in one fetch
        const users = this.localCache['allusers'] ? [...this.localCache['allusers']] : [];
        
        const existingUser = users.find(u => 
            u.email === userData.email || u.userId === userData.userId
        );
        if (existingUser) throw new Error('User already exists');
        
        users.push(userData);

        // Wait for the write to be CONFIRMED before returning.
        // This prevents the race where login → createProduct() runs before the
        // new-user write is persisted, and the subsequent product write
        // overwrites allproducts with a stale empty (or shorter) snapshot.
        await this.updateBin(CONFIG.BINS.ALLUSERS, users, {
            userMessage: 'Creating new user account...'
        });

        // After the confirmed write, the cache is up-to-date for all arrays.
        console.log('✅ createUser: write confirmed, cache is coherent');
        return userData;
    }

    async updateUser(userId, updatedData) {
        const users = await this.getAllUsers(true);
        const index = users.findIndex(u => u.userId === userId);
        if (index === -1) throw new Error('User not found');
        
        users[index] = {
            ...users[index],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        
        await this.updateBin(CONFIG.BINS.ALLUSERS, users, {
            userMessage: 'Updating user profile...'
        });
        
        return users[index];
    }

    async deleteUser(userId) {
        if (userId === 'admin01') throw new Error('Cannot delete admin user');
        
        const users = await this.getAllUsers(true);
        const filtered = users.filter(u => u.userId !== userId);
        
        await this.updateBin(CONFIG.BINS.ALLUSERS, filtered, {
            userMessage: 'Deleting user account...'
        });
    }

    // ============ PRODUCT METHODS ============

    async getAllProducts(forceRefresh = false) {
        const products = await this.getBin(CONFIG.BINS.ALLPRODUCTS, forceRefresh);
        if (!Array.isArray(products)) return [];

        const needsNormalise = products.some(p =>
            !p.sku || !p.name || !p.description || p.price === undefined ||
            !p.category || !Array.isArray(p.images) || !p.sellerId || !p.activityStatus || !p.paymentStatus
        );

        if (!needsNormalise) return products;

        return products.map(p => ({
            sku:            p.sku            || '',
            name:           p.name           || '',
            description:    p.description    || '',
            price:          p.price          || 0,
            category:       p.category       || '',
            images:         Array.isArray(p.images) ? p.images : [],
            sellerId:       p.sellerId       || '',
            activityStatus: p.activityStatus || 'Inactive',
            paymentStatus:  p.paymentStatus  || 'free',
            ...p
        }));
    }

    async getProductsBySeller(userId) {
        const products = await this.getAllProducts();
        return products.filter(p => p.sellerId === userId);
    }

    async getProductsByCategory(category) {
        try {
            console.log(`🔍 Fetching products for category: "${category}"`);
            const products = await this.getAllProducts();
            const now = new Date();
            const filtered = products.filter(p => {
                const categoryMatch = p.category === category;
                const isActive      = p.activityStatus === 'Active';
                const notExpired    = !p.endDate || new Date(p.endDate) > now;
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

    // ============ CREATE PRODUCT (ATOMIC) ============

    async createProduct(productData) {
        // ── FIX (New Account First Ad Data Loss) ──────────────────────────
        //
        // Root cause of the reported bug:
        //
        // 1. User signs up  → createUser() calls getBin('allusers', true)
        //    which refreshes ALL THREE cache arrays from the server.
        //    The write to allusers is then QUEUED (async, not yet confirmed).
        //
        // 2. User immediately logs in and creates an ad.
        //    createProduct() is called. It calls getBin('allproducts', true)
        //    which should refresh ALL THREE arrays again.
        //
        //    BUT — if the signup write is still queued (not yet confirmed)
        //    AND another concurrent getBin call happened in between that
        //    refreshed the cache from the server (which doesn't yet contain
        //    the new user), localCache['allusers'] may be from BEFORE signup.
        //    More critically, localCache['allproducts'] could be from a stale
        //    fetch triggered elsewhere (e.g. initializeAdmin, spotlightSection)
        //    that captured an old/empty state.
        //
        // 3. If localCache['allproducts'] is stale/empty, products = []
        //    after the getBin call, and operation.data = [newProduct only].
        //    Even though processWriteQueue merges with the server, if the
        //    signup write was still in-flight and the server snapshot it fetches
        //    is from just after signup cleared the document (edge case with
        //    JSONBin's eventual consistency), existing data can be lost.
        //
        // FIX STRATEGY:
        // a) Drain the write queue (wait for any pending writes) before reading.
        // b) Force-refresh the full document once, in one fetch.
        // c) Mutate both allproducts and allusers IN MEMORY.
        // d) Write allproducts first (confirmed), then allusers (confirmed).
        //    Each confirmed write refreshes the full cache, so the second
        //    write always works from the latest server state.
        // ──────────────────────────────────────────────────────────────────

        // (a) Wait for any in-flight writes to finish before reading
        await this._drainWriteQueue();

        // (b) Force-refresh so we get the true current server state
        await this.getBin('allproducts', true);   // refreshes ALL three arrays

        const products = this.localCache['allproducts']
            ? [...this.localCache['allproducts']]
            : [];
        const users = this.localCache['allusers']
            ? [...this.localCache['allusers']]
            : [];

        const sku = productData.sku ||
            ('SKU-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase());
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
        console.log(`📦 New product payload: ${payloadSizeMB.toFixed(2)}MB`);
        if (payloadSizeMB > 9) {
            throw new Error(`413: Payload too large (${payloadSizeMB.toFixed(2)}MB). Please use smaller images.`);
        }

        // (c) Mutate both arrays in memory
        products.push(newProduct);

        let updatedUsers = users;
        if (productData.paymentStatus !== 'pending') {
            const userIndex = users.findIndex(u => u.userId === productData.sellerId);
            if (userIndex !== -1) {
                updatedUsers = [...users];
                updatedUsers[userIndex] = {
                    ...updatedUsers[userIndex],
                    numberOfAdverts: (updatedUsers[userIndex].numberOfAdverts || 0) + 1,
                    updatedAt: now.toISOString()
                };
            }
        }

        // (d) Write sequentially — each write awaits confirmation before the next
        await this.updateBin(CONFIG.BINS.ALLPRODUCTS, products);

        if (updatedUsers !== users) {
            // After the allproducts write is confirmed, the cache has been
            // refreshed. Now update allusers safely.
            await this.updateBin(CONFIG.BINS.ALLUSERS, updatedUsers, {
                userMessage: 'Updating advert count...'
            });
        }

        console.log('✅ Product created:', newProduct);
        return newProduct;
    }

    // ── Helper: wait until the write queue is empty ──────────────────────
    // Prevents createProduct from reading stale cache that predates a
    // pending (not-yet-confirmed) write from signup or another operation.
    _drainWriteQueue(timeoutMs = 15000) {
        return new Promise((resolve) => {
            if (this.writeQueue.length === 0) {
                resolve();
                return;
            }
            console.log(`⏳ Waiting for write queue to drain (${this.writeQueue.length} pending)...`);
            const deadline = Date.now() + timeoutMs;
            const poll = setInterval(() => {
                if (this.writeQueue.length === 0 || Date.now() > deadline) {
                    clearInterval(poll);
                    if (this.writeQueue.length > 0) {
                        console.warn('⚠️ Queue drain timed out — proceeding anyway');
                    } else {
                        console.log('✅ Write queue drained');
                    }
                    resolve();
                }
            }, 200);
        });
    }

    async updateProduct(sku, updatedData) {
        const products = await this.getAllProducts(true);
        const index = products.findIndex(p => p.sku === sku);
        if (index === -1) throw new Error('Product not found');
        
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
        if (!product) throw new Error('Product not found');
        
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
                if (chat.sender !== userId) chat.read = true;
            });
            if (userId === product.sellerId) product.unreadChatCount = 0;
            
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
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Error saving pending operations:', e);
        }
    }

    loadPendingOperations() {
        try {
            const saved = localStorage.getItem('pendingOperations');
            if (!saved) return;

            const data = JSON.parse(saved);
            if (Date.now() - data.timestamp >= 86400000) {
                localStorage.removeItem('pendingOperations');
                return;
            }

            const restoredQueue = (data.queue || []).map(op => ({
                ...op,
                resolvers: [() => {}],
                rejectors: [(e) => console.warn(`Restored op ${op.id} failed:`, e)],
                maxAttempts: op.maxAttempts || 5
            }));

            this.writeQueue = restoredQueue;

            restoredQueue.forEach(op => {
                if (!this.pendingWrites[op.binName]) {
                    this.pendingWrites[op.binName] = op;
                }
            });

            console.log(`📦 Loaded ${this.writeQueue.length} pending operations from storage`);
        } catch (e) {
            console.error('Error loading pending operations:', e);
        }
    }

    // ============ NOTIFICATIONS ============

    showBinUpdateNotification(newBinId) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #4CAF50;
            color: white; padding: 15px 20px; border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 9999;
            max-width: 350px; animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <strong>✅ New JSONBin.io Bin Created!</strong>
            <p style="margin: 5px 0 0; font-size: 0.9rem;">
                <strong>Bin ID:</strong> ${newBinId}<br>
                <small>Update your config.js with this new ID.</small>
            </p>
            <button onclick="this.parentElement.remove()" style="
                background: white; color: #4CAF50; border: none;
                padding: 5px 10px; border-radius: 5px; margin-top: 10px; cursor: pointer;
            ">Got it</button>
        `;
        document.body.appendChild(notification);
        setTimeout(() => { if (notification.parentElement) notification.remove(); }, 15000);
    }

    showQueueSuccessNotification(operation) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; background: #4CAF50;
            color: white; padding: 12px 20px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>
                <span>${operation.metadata?.userMessage || 'Loaded successfully!'}</span>
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

    showQueueFailedNotification(operation) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; background: #f44336;
            color: white; padding: 12px 20px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999;
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

    saveToLocalStorage() {
        try {
            const timestamp = Date.now();
            if (this.localCache.allusers)   localStorage.setItem('backup_allusers',   JSON.stringify(this.localCache.allusers));
            if (this.localCache.allproducts) localStorage.setItem('backup_allproducts', JSON.stringify(this.localCache.allproducts));
            if (this.localCache.allpayments) localStorage.setItem('backup_allpayments', JSON.stringify(this.localCache.allpayments));
            localStorage.setItem('backup_timestamp', String(timestamp));
        } catch (e) {
            console.warn('Error saving localStorage backup:', e);
        }
    }

    loadFromLocalStorage() {
        try {
            const backupTime = parseInt(localStorage.getItem('backup_timestamp') || '0', 10);
            if (!backupTime) return;

            const usersRaw    = localStorage.getItem('backup_allusers');
            const productsRaw = localStorage.getItem('backup_allproducts');
            const paymentsRaw = localStorage.getItem('backup_allpayments');

            if (usersRaw && !this.localCache.allusers) {
                this.localCache.allusers = JSON.parse(usersRaw);
                this.lastFetchTime.allusers = backupTime;
                console.log(`📦 Loaded ${this.localCache.allusers.length} users from localStorage backup`);
            }
            if (productsRaw && !this.localCache.allproducts) {
                this.localCache.allproducts = JSON.parse(productsRaw);
                this.lastFetchTime.allproducts = backupTime;
                console.log(`📦 Loaded ${this.localCache.allproducts.length} products from localStorage backup`);
            }
            if (paymentsRaw && !this.localCache.allpayments) {
                this.localCache.allpayments = JSON.parse(paymentsRaw);
                this.lastFetchTime.allpayments = backupTime;
                console.log(`📦 Loaded ${this.localCache.allpayments.length} payments from localStorage backup`);
            }
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }
}

const api = new ApiService();
api.loadFromLocalStorage();
