// ============================================================
// Naybor Travel Express - Configuration File
// ============================================================

const CONFIG = {
  // JSONBin.io Configuration
  // JSONBIN_M_API_KEY  = your Master Key  ($2a$10$GY26W...)
  // JSONBIN_API_KEY    = your Access Key  ($2a$10$p33U...)
  JSONBIN_M_API_KEY: '$2a$10$GY26W.StiN7bdlaoYuva3.GCGhyglj8ne8v0aaIJ895NLv9o61bqy',
  JSONBIN_API_KEY:   '$2a$10$p33UKD.Ju51IwJKELeOTKerEQM8JPavlsiRQ1ANegN7b/2bkEMvku',
  JSONBIN_MAIN_BIN_ID: "69e0f434856a6821893ee661",
  JSONBIN_BASE_URL: "https://api.jsonbin.io/v3",

  // Firebase Configuration (for photo storage)
  FIREBASE: {
    apiKey: "AIzaSyBj9wQ04hnfPjowVvEa_yf8_Fq3VXVaH5I",
    authDomain: "giteksolhub-project.firebaseapp.com",
    projectId: "giteksolhub-project",
    storageBucket: "giteksolhub-project.firebasestorage.app",
    messagingSenderId: "917911843059",
    appId: "1:917911843059:web:0aa2438be6605d1f400786"
  },

  // EmailJS Configuration
  // All three email types share the one template you created.
  // Your template in EmailJS must expose: {{subject}} and {{message}} variables.
  EMAILJS: {
    PUBLIC_KEY:        'VGj6eL5SaKXRW2fIi',
    SERVICE_ID:        'service_78wp8b9',
    TEMPLATE_ID_ADMIN: 'template_n1me3bf',
    TEMPLATE_ID_USER:  'template_n1me3bf',
    TEMPLATE_ID_CHAT:  'template_n1me3bf',
    ADMIN_EMAIL:       'geocorpsys@gmail.com'
  },

  // Paystack Configuration
  PAYSTACK_PUBLIC_KEY: "pk_live_2018244c913523ab0751249b240bc3e3448c3c19",

  // Admin Configuration
  ADMIN: {
    username: "Admin01",
    password: "Kingfifo@#",
    email: "geocorpsys@gmail.com"
  },

  // App Settings (modifiable by admin at runtime)
  APP_SETTINGS: {
    driver_chat_fee: 650,
    free_chat_limit: 2,
    app_name: "Naybor Travel Express",
    app_version: "1.0.0"
  },

  // Nigerian States
  NIGERIAN_STATES: [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
    "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
    "Ekiti", "Enugu", "FCT - Abuja", "Gombe", "Imo", "Jigawa",
    "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
    "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
    "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
  ]
};

Object.freeze(CONFIG.ADMIN);
