// SmartVotes Network - Configuration File
// Replace all placeholder values with your actual credentials

const SMARTVOTES_CONFIG = {

  // ─── JSONBin.io Configuration ───────────────────────────────────────────────
    JSONBIN_M_API_KEY: '$2a$10$GY26W.StiN7bdlaoYuva3.GCGhyglj8ne8v0aaIJ895NLv9o61bqy',
    JSONBIN_API_KEY: '$2a$10$p33UKD.Ju51IwJKELeOTKerEQM8JPavlsiRQ1ANegN7b/2bkEMvku',
    JSONBIN_MAIN_BIN_ID: '69d02fa0aaba882197c150bf',
 
    JSONBIN_BASE_URL: "https://api.jsonbin.io/v3",

  // ─── EmailJS Configuration ───────────────────────────────────────────────────
  EMAILJS: {
    PUBLIC_KEY: 'VGj6eL5SaKXRW2fIi',
    SERVICE_ID: 'service_78wp8b9',
    TEMPLATE_ID: "template_n1me3bf"//,   // Validation code template
   // RESULT_TEMPLATE_ID: "YOUR_EMAILJS_RESULT_TEMPLATE_ID" // Optional: results notification
  },

  // ─── Paystack Configuration ──────────────────────────────────────────────────
  PAYSTACK_PUBLIC_KEY: 'pk_live_2018244c913523ab0751249b240bc3e3448c3c19',

  // ─── Firebase Configuration ──────────────────────────────────────────────────
  FIREBASE: {
    apiKey: "AIzaSyBj9wQ04hnfPjowVvEa_yf8_Fq3VXVaH5I",
    authDomain: "giteksolhub-project.firebaseapp.com",
    projectId: "giteksolhub-project",
    storageBucket: "giteksolhub-project.firebasestorage.app",
    messagingSenderId: "917911843059",
    appId: "1:917911843059:web:0aa2438be6605d1f400786"
    //measurementId: "YOUR_MEASUREMENT_ID"
  },

  // ─── App Settings ────────────────────────────────────────────────────────────
  APP: {
    NAME: "SmartVotes Network",
    VERSION: "1.0.0",
    DEFAULT_ADMIN_ID: "Admin01",
    DEFAULT_ADMIN_PASSWORD: "Kingfifo@#",
    VALIDATION_CODE_LENGTH: 5,
    SESSION_TIMEOUT_MINUTES: 60
  }
};

// Export for use in other scripts
if (typeof module !== "undefined") {
  module.exports = SMARTVOTES_CONFIG;
}
