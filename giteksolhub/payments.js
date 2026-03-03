// payments.js
class PaymentService {
    constructor() {
        this.publicKey = CONFIG.PAYSTACK_PUBLIC_KEY;
    }

    async getPaymentRates() {
        // Get rates from admin user
        const admin = await api.getUserByUserId('admin01');
        return {
            daily: admin.dailyPayValue,
            weekly: admin.weeklyPayValue,
            monthly: admin.monthlyPayValue
        };
    }

    initializePayment(amount, email, productSku, onSuccess, onError) {
        const handler = PaystackPop.setup({
            key: this.publicKey,
            email: email,
            amount: amount * 100, // Convert to kobo
            currency: 'NGN',
            callback: async (response) => {
                if (response.status === 'success') {
                    try {
                        // Record payment
                        await api.createPayment({
                            productSKU: productSku,
                            userID: auth.currentUser.userId,
                            payAmount: amount,
                            reference: response.reference
                        });
                        
                        // Update product payment status
                        const products = await api.getAllProducts();
                        const product = products.find(p => p.sku === productSku);
                        if (product) {
                            product.paymentStatus = 'paid';
                            // Set end date based on payment type
                            const endDate = new Date();
                            if (product.paymentType === 'daily') {
                                endDate.setDate(endDate.getDate() + 1);
                            } else if (product.paymentType === 'weekly') {
                                endDate.setDate(endDate.getDate() + 7);
                            } else if (product.paymentType === 'monthly') {
                                endDate.setMonth(endDate.getMonth() + 1);
                            }
                            product.endDate = endDate.toISOString();
                            product.activityStatus = 'Active';
                            await api.updateProduct(productSku, product);
                        }
                        
                        onSuccess(response);
                    } catch (error) {
                        onError(error);
                    }
                } else {
                    onError(new Error('Payment failed'));
                }
            },
            onClose: () => {
                onError(new Error('Payment cancelled'));
            }
        });
        
        handler.openIframe();
    }

    async processAdvertPayment(productSku, paymentType) {
        if (!auth.currentUser) {
            throw new Error('Please login first');
        }

        const rates = await this.getPaymentRates();
        let amount = 0;
        
        switch(paymentType) {
            case 'daily':
                amount = rates.daily;
                break;
            case 'weekly':
                amount = rates.weekly;
                break;
            case 'monthly':
                amount = rates.monthly;
                break;
            default:
                throw new Error('Invalid payment type');
        }

        return new Promise((resolve, reject) => {
            this.initializePayment(
                amount,
                auth.currentUser.email,
                productSku,
                resolve,
                reject
            );
        });
    }
}

const paymentService = new PaymentService();

