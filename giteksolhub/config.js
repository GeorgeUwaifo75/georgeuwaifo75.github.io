// config.js
const CONFIG = {
    JSONBIN_API_KEY: '$2a$10$GY26W.StiN7bdlaoYuva3.GCGhyglj8ne8v0aaIJ895NLv9o61bqy',
    //JSONBIN_API_KEY: '$2a$10$p33UKD.Ju51IwJKELeOTKerEQM8JPavlsiRQ1ANegN7b/2bkEMvku',
    JSONBIN_MAIN_BIN_ID: '69a99281d0ea881f40f1dc8d', // Your new bin ID
    PAYSTACK_PUBLIC_KEY: 'pk_live_2018244c913523ab0751249b240bc3e3448c3c19',
    BINS: {
        ALLUSERS: 'allusers',
        ALLPRODUCTS: 'allproducts',
        ALLPAYMENTS: 'allpayments'
    }
    ,
    // Add EmailJS configuration
    EMAILJS: {
        PUBLIC_KEY: 'VGj6eL5SaKXRW2fIi', // Get from EmailJS dashboard
        SERVICE_ID: 'service_78wp8b9', // Your email service ID
        TEMPLATE_ID: 'template_06fjijo' // Your template ID
    }
};

const CATEGORIES = [
    'All Business types', // Changed from 'Supermarkets'
    'Computing and Electronics',
    'Computer Services',
    'Household Products',
    'Wholesale food commodities',
    'Printing and Publishing',
    'Automobiles',
    'Food services',
    'Rentals and Properties',
    'Furniture and others'
];
