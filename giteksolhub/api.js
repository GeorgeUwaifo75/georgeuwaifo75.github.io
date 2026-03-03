// api.js - COMPLETE FIX based on original requirements
class ApiService {
    
    constructor() {
        this.apiKey = CONFIG.JSONBIN_API_KEY;
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        this.mainBinId = CONFIG.JSONBIN_MAIN_BIN_ID;
    } 
 /*
    constructor() {
        // Use config from window object
        this.apiKey = window.APP_CONFIG.JSONBIN_API_KEY;
        this.mainBinId = window.APP_CONFIG.JSONBIN_MAIN_BIN_ID;
        this.baseURL = 'https://api.jsonbin.io/v3/b';
    }*/

    
    async getBin(binName) {
        try {
            const response = await fetch(`${this.baseUrl}/b/${this.mainBinId}/latest`, {
            // const response = await fetch(`${this.proxyUrl}${this.baseUrl}/b/${this.mainBinId}/latest`, {
       
                headers: {
                    'X-Master-Key': this.apiKey
                    //'X-Access-Key': this.apiKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.record[binName] || [];
        } catch (error) {
            console.error('Error fetching bin:', error);
            return []; // Return empty array to prevent app from crashing
        }
    }

    async updateBin(binName, data) {
        try {
            // First get current bin
             //const response = await fetch(`${this.proxyUrl}${this.baseUrl}/b/${this.mainBinId}/latest`, {
       
            const response = await fetch(`${this.baseUrl}/b/${this.mainBinId}/latest`, {
                headers: {
                    'X-Master-Key': this.apiKey
                    //'X-Access-Key': this.apiKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch bin: ${response.status}`);
            }
            
            const currentData = await response.json();
            
            // Update the specific bin
            currentData.record[binName] = data;
            
            // Save back to jsonbin
            const updateResponse = await fetch(`${this.baseUrl}/b/${this.mainBinId}`, {
           //const updateResponse = await fetch(`${this.proxyUrl}${this.baseUrl}/b/${this.mainBinId}`, {
           
              
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                    //'X-Access-Key': this.apiKey
                },
                body: JSON.stringify(currentData.record)
            });
            
            if (!updateResponse.ok) {
                throw new Error(`Failed to update bin: ${updateResponse.status}`);
            }
            
            console.log(`✅ Successfully updated ${binName}`);
            return await updateResponse.json();
        } catch (error) {
            console.error('Error updating bin:', error);
            throw error;
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
        
        // Check if user already exists
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

    // Product methods - FIXED based on original requirements
    async getAllProducts() {
        return await this.getBin(CONFIG.BINS.ALLPRODUCTS);
    }

    async getActiveProducts() {
        const products = await this.getAllProducts();
        const now = new Date();
        
        return products.filter(p => {
            // Only show active products as per original requirement
            if (p.activityStatus !== 'Active') return false;
            
            // Check if product has expired
            if (p.endDate) {
                const endDate = new Date(p.endDate);
                if (endDate < now) {
                    // Auto-update expired products to inactive
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
        const activeProducts = await this.getActiveProducts();
        return activeProducts.filter(p => p.category === category);
    }

    async getProductBySku(sku) {
        const products = await this.getAllProducts();
        return products.find(p => p.sku === sku);
    }

    // FIXED createProduct method - matches original requirements exactly
    async createProduct(productData) {
        try {
            const products = await this.getAllProducts();
            
            // Generate unique SKU as required
            const sku = 'SKU-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            
            const now = new Date();
            let endDate = new Date();
            
            // If free product, set end date to 2 weeks as required
            if (productData.paymentStatus === 'free') {
                endDate.setDate(endDate.getDate() + 14); // 2 weeks for free products
            } else {
                endDate = null; // Paid products set end date after payment
            }
            
            // Complete product data structure matching original requirements
            const newProduct = {
                // Core product information (visible during registration)
                sku: sku,
                name: productData.name,
                description: productData.description,
                price: parseFloat(productData.price),
                category: productData.category,
                images: productData.images || [], // Base64 encoded images - minimum 4 required
                
                // Seller information (required per original spec)
                sellerId: productData.sellerId,
                sellerName: productData.sellerName || '',
                sellerContact: productData.sellerContact || '',
                
                // Status fields (NOT visible during registration - per original note)
                activityStatus: productData.paymentStatus === 'free' ? 'Active' : 'Inactive',
                paymentStatus: productData.paymentStatus || 'free',
                paymentType: productData.paymentType || null, // 'day', 'week', 'month' or null for free
                
                // Dates (NOT visible during registration - per original note)
                dateAdvertised: now.toISOString(),
                endDate: endDate ? endDate.toISOString() : null,
                
                // Chat session (NOT visible during registration - per original note)
                chats: [],
                unreadChatCount: 0,
                
                // Additional metadata
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                viewCount: 0
            };
            
            console.log('Creating product with structure:', newProduct);
            
            products.push(newProduct);
            await this.updateBin(CONFIG.BINS.ALLPRODUCTS, products);
            
            // Update user's advert count (track free adverts)
            const users = await this.getAllUsers();
            const userIndex = users.findIndex(u => u.userId === productData.sellerId);
            if (userIndex !== -1) {
                users[userIndex].numberOfAdverts = (users[userIndex].numberOfAdverts || 0) + 1;
                await this.updateBin(CONFIG.BINS.ALLUSERS, users);
            }
            
            console.log('✅ Product created successfully:', newProduct);
            return newProduct;
            
        } catch (error) {
            console.error('❌ Error creating product:', error);
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
            
            // Update unread count for notifications (red color per original spec)
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

    // Initialize admin user if not exists
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
}

const api = new ApiService();
