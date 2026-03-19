// social-share.js - Social Media Sharing Functionality

class SocialShare {
    constructor() {
        this.shares = this.loadShareCounts();
        this.init();
    }

    init() {
        // Load share counts from localStorage
        this.loadShareCounts();
        
        // Add Open Graph meta tags if not present
        this.ensureOpenGraphTags();
    }

    // Load share counts from localStorage
    loadShareCounts() {
        try {
            const saved = localStorage.getItem('productShares');
            this.shares = saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Error loading share counts:', e);
            this.shares = {};
        }
        return this.shares;
    }

    // Save share counts to localStorage
    saveShareCounts() {
        try {
            localStorage.setItem('productShares', JSON.stringify(this.shares));
        } catch (e) {
            console.error('Error saving share counts:', e);
        }
    }

    // Increment share count for a product
    incrementShareCount(sku, platform) {
        if (!this.shares[sku]) {
            this.shares[sku] = {};
        }
        if (!this.shares[sku][platform]) {
            this.shares[sku][platform] = 0;
        }
        this.shares[sku][platform]++;
        this.saveShareCounts();
        
        // Optional: Send to server for analytics
        this.trackShare(sku, platform);
        
        return this.shares[sku][platform];
    }

    // Get share count for a product
    getShareCount(sku, platform = null) {
        if (!this.shares[sku]) return platform ? 0 : {};
        if (platform) return this.shares[sku][platform] || 0;
        return this.shares[sku];
    }

    // Get total shares for a product
    getTotalShares(sku) {
        if (!this.shares[sku]) return 0;
        return Object.values(this.shares[sku]).reduce((a, b) => a + b, 0);
    }

    // Track share (optional - send to server)
    async trackShare(sku, platform) {
        try {
            // You can implement server-side tracking here
            console.log(`📊 Share tracked: ${sku} on ${platform}`);
            
            // Optional: Send to your API
            // await api.trackShare({ sku, platform, timestamp: new Date().toISOString() });
        } catch (error) {
            console.error('Error tracking share:', error);
        }
    }

    // Ensure Open Graph meta tags are present
    ensureOpenGraphTags() {
        const requiredTags = [
            { property: 'og:title', content: 'GiTeksol Market Hub' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: window.location.href },
            { property: 'og:image', content: 'https://via.placeholder.com/1200x630?text=GiTeksol+Market' },
            { property: 'og:description', content: 'Buy and sell products on GiTeksol Market Hub - Your premier online marketplace.' },
            { property: 'og:site_name', content: 'GiTeksol Market Hub' },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: 'GiTeksol Market Hub' },
            { name: 'twitter:description', content: 'Buy and sell products on GiTeksol Market Hub.' },
            { name: 'twitter:image', content: 'https://via.placeholder.com/1200x630?text=GiTeksol+Market' }
        ];

        requiredTags.forEach(tag => {
            if (tag.property && !document.querySelector(`meta[property="${tag.property}"]`)) {
                const meta = document.createElement('meta');
                meta.setAttribute('property', tag.property);
                meta.content = tag.content;
                document.head.appendChild(meta);
            }
            if (tag.name && !document.querySelector(`meta[name="${tag.name}"]`)) {
                const meta = document.createElement('meta');
                meta.setAttribute('name', tag.name);
                meta.content = tag.content;
                document.head.appendChild(meta);
            }
        });
    }

    // Update Open Graph tags for specific product
    updateOpenGraphTags(product) {
        const siteUrl = window.location.origin;
        const productUrl = `${siteUrl}/#product/${product.sku}`;
        const imageUrl = product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/1200x630?text=No+Image';
        const description = product.description.substring(0, 160);
        const price = `₦${product.price.toLocaleString()}`;

        const tags = [
            { property: 'og:title', content: `${product.name} - GiTeksol Market Hub` },
            { property: 'og:url', content: productUrl },
            { property: 'og:image', content: imageUrl },
            { property: 'og:description', content: `${description} - Price: ${price} - ${product.state || 'Nigeria'}` },
            { property: 'product:price:amount', content: product.price },
            { property: 'product:price:currency', content: 'NGN' },
            { name: 'twitter:title', content: product.name },
            { name: 'twitter:description', content: `${description.substring(0, 100)}... Price: ${price}` },
            { name: 'twitter:image', content: imageUrl }
        ];

        tags.forEach(tag => {
            let meta;
            if (tag.property) {
                meta = document.querySelector(`meta[property="${tag.property}"]`);
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('property', tag.property);
                    document.head.appendChild(meta);
                }
            } else if (tag.name) {
                meta = document.querySelector(`meta[name="${tag.name}"]`);
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('name', tag.name);
                    document.head.appendChild(meta);
                }
            }
            if (meta) meta.content = tag.content;
        });
    }

    // Generate share URLs
    getShareUrls(product) {
        const siteUrl = window.location.origin;
        const productUrl = `${siteUrl}/#product/${product.sku}`;
        const encodedUrl = encodeURIComponent(productUrl);
        const title = encodeURIComponent(`${product.name} - ₦${product.price.toLocaleString()}`);
        const description = encodeURIComponent(product.description.substring(0, 100));
        const image = product.images && product.images[0] ? encodeURIComponent(product.images[0]) : '';

        return {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            twitter: `https://twitter.com/intent/tweet?text=${title}&url=${encodedUrl}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(`*${product.name}*\n\n${product.description.substring(0, 150)}...\n\nPrice: ₦${product.price.toLocaleString()}\n\nView product: ${productUrl}`)}`,
            telegram: `https://t.me/share/url?url=${encodedUrl}&text=${title}`,
            pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${image}&description=${description}`,
            email: `mailto:?subject=${title}&body=${encodeURIComponent(`Check out this product: ${product.name}\n\n${product.description}\n\nPrice: ₦${product.price.toLocaleString()}\n\nView product: ${productUrl}`)}`
        };
    }

    // Share to platform
    share(product, platform, event = null) {
        if (event) event.preventDefault();
        
        const urls = this.getShareUrls(product);
        const url = urls[platform];
        
        if (!url) {
            this.showToast('Sharing not available for this platform', 'error');
            return;
        }

        // Increment share count
        this.incrementShareCount(product.sku, platform);

        // Open share dialog
        if (platform === 'email') {
            window.location.href = url;
        } else {
            const width = 600;
            const height = 400;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            window.open(
                url,
                `share-${platform}`,
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
            );
        }

        this.showToast(`Shared on ${platform.charAt(0).toUpperCase() + platform.slice(1)}!`, 'success');
    }

    // Copy link to clipboard
    async copyLink(product, button) {
        const siteUrl = window.location.origin;
        const productUrl = `${siteUrl}/#product/${product.sku}`;
        
        try {
            await navigator.clipboard.writeText(productUrl);
            
            // Increment share count
            this.incrementShareCount(product.sku, 'copy');
            
            // Visual feedback
            button.classList.add('copied');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
            
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = originalText;
            }, 2000);
            
            this.showToast('Link copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showToast('Failed to copy link', 'error');
        }
    }

    // Show toast notification
    showToast(message, type = 'success') {
        // Remove existing toast
        const existingToast = document.querySelector('.share-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `share-toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUpToast 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Create share buttons HTML
    createShareButtons(product, compact = false) {
        const totalShares = this.getTotalShares(product.sku);
        
        return `
            <div class="share-container">
                <div class="share-title">
                    <i class="fas fa-share-alt"></i>
                    <span>Share this product</span>
                    ${totalShares > 0 ? `<span class="share-count">${totalShares} shares</span>` : ''}
                </div>
                <div class="share-buttons">
                    <button class="share-btn facebook" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'facebook', event)">
                        <i class="fab fa-facebook-f"></i>
                        ${!compact ? '<span>Facebook</span>' : ''}
                    </button>
                    <button class="share-btn twitter" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'twitter', event)">
                        <i class="fab fa-twitter"></i>
                        ${!compact ? '<span>Twitter</span>' : ''}
                    </button>
                    <button class="share-btn whatsapp" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'whatsapp', event)">
                        <i class="fab fa-whatsapp"></i>
                        ${!compact ? '<span>WhatsApp</span>' : ''}
                    </button>
                    <button class="share-btn copy-link" onclick="socialShare.copyLink(${JSON.stringify(product).replace(/"/g, '&quot;')}, this)">
                        <i class="fas fa-link"></i>
                        ${!compact ? '<span>Copy Link</span>' : ''}
                    </button>
                    <button class="share-btn telegram" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'telegram', event)">
                        <i class="fab fa-telegram-plane"></i>
                        ${!compact ? '<span>Telegram</span>' : ''}
                    </button>
                    <button class="share-btn pinterest" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'pinterest', event)">
                        <i class="fab fa-pinterest"></i>
                        ${!compact ? '<span>Pinterest</span>' : ''}
                    </button>
                    <button class="share-btn email" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'email', event)">
                        <i class="fas fa-envelope"></i>
                        ${!compact ? '<span>Email</span>' : ''}
                    </button>
                </div>
            </div>
        `;
    }

    // Create share modal
    showShareModal(product) {
        // Remove existing modal
        const existingModal = document.querySelector('.share-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'share-modal';
        
        const siteUrl = window.location.origin;
        const productUrl = `${siteUrl}/#product/${product.sku}`;
        
        modal.innerHTML = `
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h3><i class="fas fa-share-alt"></i> Share ${product.name}</h3>
                    <button class="share-modal-close" onclick="this.closest('.share-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="og-preview">
                    <h4>Preview</h4>
                    <div class="og-preview-card">
                        <img src="${product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/80'}" class="og-preview-image">
                        <div class="og-preview-info">
                            <div class="og-preview-title">${product.name}</div>
                            <div class="og-preview-description">${product.description.substring(0, 60)}...</div>
                            <div class="og-preview-site">GiTeksol Market Hub</div>
                        </div>
                    </div>
                </div>
                
                <div class="share-modal-buttons">
                    <button class="share-modal-btn facebook" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'facebook'); this.closest('.share-modal').remove()">
                        <i class="fab fa-facebook-f"></i>
                        <span>Facebook</span>
                    </button>
                    <button class="share-modal-btn twitter" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'twitter'); this.closest('.share-modal').remove()">
                        <i class="fab fa-twitter"></i>
                        <span>Twitter</span>
                    </button>
                    <button class="share-modal-btn whatsapp" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'whatsapp'); this.closest('.share-modal').remove()">
                        <i class="fab fa-whatsapp"></i>
                        <span>WhatsApp</span>
                    </button>
                    <button class="share-modal-btn telegram" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'telegram'); this.closest('.share-modal').remove()">
                        <i class="fab fa-telegram-plane"></i>
                        <span>Telegram</span>
                    </button>
                    <button class="share-modal-btn pinterest" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'pinterest'); this.closest('.share-modal').remove()">
                        <i class="fab fa-pinterest"></i>
                        <span>Pinterest</span>
                    </button>
                    <button class="share-modal-btn email" onclick="socialShare.share(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'email'); this.closest('.share-modal').remove()">
                        <i class="fas fa-envelope"></i>
                        <span>Email</span>
                    </button>
                    <button class="share-modal-btn copy" onclick="socialShare.copyLink(${JSON.stringify(product).replace(/"/g, '&quot;')}, this)">
                        <i class="fas fa-link"></i>
                        <span>Copy Link</span>
                    </button>
                </div>
                
                <div class="copy-link-section">
                    <p>Or copy link directly:</p>
                    <div class="copy-link-input-group">
                        <input type="text" value="${productUrl}" readonly id="shareLinkInput">
                        <button onclick="socialShare.copyLinkInput()" id="copyLinkBtn">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Copy link from input
    copyLinkInput() {
        const input = document.getElementById('shareLinkInput');
        const btn = document.getElementById('copyLinkBtn');
        
        input.select();
        input.setSelectionRange(0, 99999);
        
        navigator.clipboard.writeText(input.value).then(() => {
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                btn.classList.remove('copied');
            }, 2000);
            
            this.showToast('Link copied to clipboard!', 'success');
        });
    }
}

// Initialize social sharing
const socialShare = new SocialShare();
