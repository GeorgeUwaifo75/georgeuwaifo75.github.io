// payments.js - Updated with proper Paystack integration

class PaymentService {
    constructor() {
        this.publicKey = CONFIG.PAYSTACK_PUBLIC_KEY;
    }

    async getPaymentRates() {
        try {
            const admin = await api.getUserByUserId('admin01');
            return {
                daily: admin.dailyPayValue || 300,
                weekly: admin.weeklyPayValue || 1000,
                monthly: admin.monthlyPayValue || 2800
            };
        } catch (error) {
            console.error('Error getting payment rates:', error);
            // Return default rates if admin not found
            return {
                daily: 300,
                weekly: 1000,
                monthly: 2800
            };
        }
    }

    initializePayment(amount, email, paymentType, productData, onSuccess, onError) {
        // Check if Paystack is loaded
        if (!window.PaystackPop) {
            this.loadPaystackScript()
                .then(() => {
                    this.openPaystackPopup(amount, email, paymentType, productData, onSuccess, onError);
                })
                .catch(error => {
                    onError(new Error('Failed to load Paystack. Please check your internet connection.'));
                });
        } else {
            this.openPaystackPopup(amount, email, paymentType, productData, onSuccess, onError);
        }
    }

    loadPaystackScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v1/inline.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    openPaystackPopup(amount, email, paymentType, productData, onSuccess, onError) {
        const handler = PaystackPop.setup({
            key: this.publicKey,
            email: email,
            amount: amount * 100, // Convert to kobo
            currency: 'NGN',
            ref: 'REF-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
            metadata: {
                payment_type: paymentType,
                product_name: productData.name,
                seller_id: productData.sellerId
            },
            callback: function(response) {
                // Payment successful
                onSuccess(response);
            },
            onClose: function() {
                // Payment cancelled
                onError(new Error('Payment cancelled by user'));
            }
        });
        
        handler.openIframe();
    }

    async getUserPaymentHistory(userId) {
        try {
            const payments = await api.getAllPayments();
            return payments.filter(p => p.userID === userId)
                .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        } catch (error) {
            console.error('Error getting payment history:', error);
            return [];
        }
    }

    async getPaymentByReference(reference) {
        try {
            const payments = await api.getAllPayments();
            return payments.find(p => p.reference === reference);
        } catch (error) {
            console.error('Error getting payment:', error);
            return null;
        }
    }
}

const paymentService = new PaymentService();
