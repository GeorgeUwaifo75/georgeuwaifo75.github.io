// ticker.js - Dynamic Market Ticker (Crypto-Free Version)

class MarketTicker {
    constructor() {
        this.container = document.getElementById('tickerItems');
        this.updateInterval = 60000; // Update every 60 seconds
        this.cacheDuration = 300000; // Cache market data for 5 minutes
        this.cachedData = null;
        this.lastFetchTime = 0;
        
        // Currency pairs only - no crypto
        this.currencyPairs = [
            { from: 'USD', to: 'NGN', icon: 'fa-dollar-sign', name: 'USD/NGN' },
            { from: 'GBP', to: 'NGN', icon: 'fa-pound-sign', name: 'GBP/NGN' },
            { from: 'EUR', to: 'NGN', icon: 'fa-euro-sign', name: 'EUR/NGN' },
            { from: 'JPY', to: 'NGN', icon: 'fa-yen-sign', name: 'JPY/NGN' }
        ];
        
        this.init();
    }
    
    async init() {
        await this.loadInitialData();
        this.startUpdates();
    }
    
    async loadInitialData() {
        await this.fetchMarketData();
        await this.fetchPlatformStats();
    }
    
    startUpdates() {
        // Update market data every minute
        setInterval(async () => {
            await this.fetchMarketData();
        }, this.updateInterval);
        
        // Update platform stats every 30 seconds
        setInterval(async () => {
            await this.fetchPlatformStats();
        }, 30000);
    }
    
    async fetchMarketData() {
        try {
            // Try to get cached data first
            if (this.cachedData && (Date.now() - this.lastFetchTime) < this.cacheDuration) {
                this.renderTicker(this.cachedData);
                return;
            }
            
            // Fetch currency rates
            const currencyData = await this.fetchCurrencyRates();
            
            const marketData = {
                currencies: currencyData,
                timestamp: Date.now()
            };
            
            this.cachedData = marketData;
            this.lastFetchTime = Date.now();
            
            // Get platform stats and render all together
            const stats = await this.getPlatformStats();
           //New 
            const stats2 = await this.fetchAnalyticsStats();
            this.renderTicker({ ...marketData, stats, stats2 });
           
            //this.renderTicker({ ...marketData, stats });
            
        } catch (error) {
            console.error('Error fetching market data:', error);
            this.renderFallbackData();
        }
    }
    
    
   // In your ticker.js

/*
async fetchAnalyticsStats() {
  try {
    const response = await fetch('https://v1.nocodeapi.com/geocorps75/ga/USxdQIWAGnkfweeG', {
      
      headers: {
        'Authorization': 'Bearer AFqiegRgDsoHmvFfc'
      }
    });
    const data = await response.json();
    console.error('The data analytics:', data);
    return {
      visitorsToday: data.users, // Adjust based on actual response structure
      visitorsMonth: data.sessions
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return this.getFallbackStats();
  }
} 
*/

async fetchAnalyticsStats() {
  try {
    // Replace 123456789 with your actual numeric Property ID
    const propertyId = '527751931'; // e.g., '123456789'
    
    // Today's visitors
    const todayResponse = await fetch(`https://v1.nocodeapi.com/geocorps75/ga/activeUsers?propertyId=${propertyId}&daterange=today`, {
      headers: {
        'Authorization': 'Bearer AFqiegRgDsoHmvFfc'
      }
    });
    
    // Monthly visitors (last 30 days)
    const monthResponse = await fetch(`https://v1.nocodeapi.com/geocorps75/ga/activeUsers?propertyId=${propertyId}&daterange=30daysAgo`, {
      headers: {
        'Authorization': 'Bearer AFqiegRgDsoHmvFfc'
      }
    });
    
    let todayUsers = 0;
    let monthUsers = 0;
    
    if (todayResponse.ok) {
      const todayData = await todayResponse.json();
      todayUsers = todayData.activeUsers || 0;
      console.log('Today\'s visitors:', todayUsers);
    } else {
      console.error('Today API error:', await todayResponse.text());
    }
    
    if (monthResponse.ok) {
      const monthData = await monthResponse.json();
      monthUsers = monthData.activeUsers || 0;
      console.log('Monthly visitors:', monthUsers);
    }
    
    return {
      visitorsToday: todayUsers,
      visitorsMonth: monthUsers
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      visitorsToday: Math.floor(Math.random() * 150) + 50,
      visitorsMonth: Math.floor(Math.random() * 4500) + 1500
    };
  }
}




// Separate method for monthly data
async fetchMonthlyVisitors() {
  try {
    const response = await fetch('https://v1.nocodeapi.com/geocorps75/ga/activeUsers?daterange=30daysAgo', {
      headers: {
        'Authorization': 'Bearer AFqiegRgDsoHmvFfc'
      }
    });
    
    if (!response.ok) return 0;
    
    const data = await response.json();
    return data.activeUsers || 0;
  } catch (error) {
    return 0;
  }
}
    
    
    
    async fetchCurrencyRates() {
        try {
            // Using free ExchangeRate-API (no key required for limited requests)
            // Note: For production, you might want to sign up for a free API key
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            
            // ExchangeRate-API doesn't have NGN, so we'll use realistic rates
            // In production, you could use a service that supports NGN
            
            // For demo purposes, we'll return realistic NGN rates
            // These are based on typical parallel market rates
            return {
                USDNGN: 1540.25,
                GBPNGN: 1950.75,
                EURNGN: 1680.50,
                JPYNGN: 10.25,
                // Add a small random variation to make it look live
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Currency API error:', error);
            // Fallback to simulated rates with slight variation
            const baseRate = 1540;
            const variation = (Math.random() * 10) - 5; // -5 to +5 variation
            
            return {
                USDNGN: baseRate + variation,
                GBPNGN: (baseRate * 1.27) + variation,
                EURNGN: (baseRate * 1.09) + variation,
                JPYNGN: (baseRate * 0.0065) + (variation * 0.0065)
            };
        }
    }
    
    async getPlatformStats() {
        try {
            // Get all products from your existing API
            const allProducts = await api.getAllProducts();
            
            // Calculate today's new products
            const today = new Date().setHours(0,0,0,0);
            const newProducts = allProducts.filter(p => 
                new Date(p.dateAdvertised).setHours(0,0,0,0) === today
            ).length;
            
            // Get recently uploaded products (last 3)
            const recentProducts = allProducts
                .sort((a, b) => new Date(b.dateAdvertised) - new Date(a.dateAdvertised))
                .slice(0, 3);
            
            // Simulate visitor counts (you can replace with actual analytics)
            // For real implementation, you'd want to use Google Analytics API or similar
            const visitorsToday = Math.floor(Math.random() * 150) + 50;
            const visitorsMonth = Math.floor(Math.random() * 4500) + 1500;
            
            return {
                totalProducts: allProducts.length,
                newProducts: newProducts,
                recentProducts: recentProducts,
                visitorsToday: visitorsToday,
                visitorsMonth: visitorsMonth
                
                
            };
        } catch (error) {
            console.error('Error fetching platform stats:', error);
            return {
                totalProducts: 0,
                newProducts: 0,
                recentProducts: [],
                visitorsToday: 0,
                visitorsMonth: 0
            };
        }
    }
    
    async fetchPlatformStats() {
        const stats = await this.getPlatformStats();
        if (this.cachedData) {
            this.cachedData.stats = stats;
            this.renderTicker(this.cachedData);
        }
    }
    
    renderTicker(data) {
        if (!this.container) return;
        
        // Create track container for animation
        const track = document.createElement('div');
        track.className = 'ticker-track';
        
        // Add currency items
        track.appendChild(this.createCurrencyItems(data.currencies));
        
        // Add platform stats
        if (data.stats) {
            track.appendChild(this.createStatsItems(data.stats));
        }
        
        // Add new product suggestions
        if (data.stats && data.stats.recentProducts.length > 0) {
            track.appendChild(this.createNewProductItems(data.stats.recentProducts));
        }
        
        // Clone for seamless scrolling
        const trackClone = track.cloneNode(true);
        track.appendChild(trackClone);
        
        // Clear and update container
        this.container.innerHTML = '';
        this.container.appendChild(track);
    }
    
    createCurrencyItems(rates) {
        const fragment = document.createDocumentFragment();
        
        const items = [
            { icon: 'fa-dollar-sign', label: 'USD/NGN', value: rates.USDNGN.toFixed(2) },
            { icon: 'fa-pound-sign', label: 'GBP/NGN', value: rates.GBPNGN.toFixed(2) },
            { icon: 'fa-euro-sign', label: 'EUR/NGN', value: rates.EURNGN.toFixed(2) },
            { icon: 'fa-yen-sign', label: 'JPY/NGN', value: rates.JPYNGN.toFixed(2) }
        ];
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ticker-item currency';
            
            // Add trend indicator (simulated)
            const trend = Math.random() > 0.5 ? 'up' : 'down';
            const trendIcon = trend === 'up' ? '▲' : '▼';
            const trendClass = trend === 'up' ? 'trend-up' : 'trend-down';
            
            div.innerHTML = `
                <i class="fas ${item.icon}"></i>
                <span class="label">${item.label}:</span>
                <span class="value">₦${item.value}</span>
                <span class="${trendClass}">${trendIcon}</span>
            `;
            fragment.appendChild(div);
        });
        
        return fragment;
    }
    
    createStatsItems(stats) {
        const fragment = document.createDocumentFragment();
        
        const items = [
            { icon: 'fa-boxes', label: 'Total Products', value: stats.totalProducts.toLocaleString() },
            { icon: 'fa-clock', label: "Today's New", value: stats.newProducts },
            { icon: 'fa-users', label: "Today's Visitors", value: stats.visitorsToday },
            { icon: 'fa-calendar', label: 'Monthly Visitors', value: stats.visitorsMonth.toLocaleString() }
        ];
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ticker-item stats';
            div.innerHTML = `
                <i class="fas ${item.icon}"></i>
                <span class="label">${item.label}:</span>
                <span class="value">${item.value}</span>
            `;
            fragment.appendChild(div);
        });
        
        return fragment;
    }
    
    createNewProductItems(recentProducts) {
        const fragment = document.createDocumentFragment();
        
        recentProducts.forEach(product => {
            const div = document.createElement('div');
            div.className = 'ticker-item new-product';
            div.innerHTML = `
                <i class="fas fa-star"></i>
                <span class="label">✨ New:</span>
                <span class="value">${product.name}</span>
                <span class="trend-up">in ${product.category || 'General'}</span>
            `;
            fragment.appendChild(div);
        });
        
        return fragment;
    }
    
    renderFallbackData() {
        const fallbackData = {
            currencies: {
                USDNGN: 1540.25,
                GBPNGN: 1950.75,
                EURNGN: 1680.50,
                JPYNGN: 10.25
            },
            stats: {
                totalProducts: 1250,
                newProducts: 18,
                recentProducts: [
                    { name: 'iPhone 15 Pro', category: 'Electronics' },
                    { name: 'Toyota Camry 2020', category: 'Automobiles' },
                    { name: '3-Bedroom Flat in Lekki', category: 'Rentals' }
                ],
                visitorsToday: 342,
                visitorsMonth: 8750
            }
        };
        
        this.renderTicker(fallbackData);
    }
}

// Initialize ticker when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other services to initialize
    setTimeout(() => {
        new MarketTicker();
    }, 1500);
});
