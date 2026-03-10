// firebase.js - Firebase Storage Service

class FirebaseService {
    constructor() {
        this.initialized = false;
        this.storage = null;
    }

    initialize() {
        if (this.initialized) return true;
        
        try {
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not loaded');
                return false;
            }

            // Initialize Firebase
            firebase.initializeApp(CONFIG.FIREBASE);
            this.storage = firebase.storage();
            this.initialized = true;
            console.log('✅ Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            return false;
        }
    }

    // Upload a single image to Firebase Storage
    async uploadImage(file, path) {
        try {
            if (!this.initialized) {
                this.initialize();
            }

            // Create a unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const filename = `${timestamp}-${randomString}.jpg`;
            const fullPath = `products/${path}/${filename}`;
            
            // Create storage reference
            const storageRef = this.storage.ref(fullPath);
            
            // Upload file
            const snapshot = await storageRef.put(file);
            
            // Get download URL
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            console.log(`📸 Image uploaded: ${downloadURL}`);
            return downloadURL;
            
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }

    // Upload multiple images
    async uploadMultipleImages(files, productSku) {
        try {
            const uploadPromises = [];
            const imageUrls = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const path = `${productSku}/image-${i + 1}`;
                
                // Upload and collect promise
                const uploadPromise = this.uploadImage(file, path)
                    .then(url => {
                        imageUrls.push(url);
                        return url;
                    });
                
                uploadPromises.push(uploadPromise);
            }

            // Wait for all uploads to complete
            await Promise.all(uploadPromises);
            
            console.log(`✅ All ${imageUrls.length} images uploaded successfully`);
            return imageUrls;
            
        } catch (error) {
            console.error('Error uploading multiple images:', error);
            throw error;
        }
    }

    // Upload from File objects (from input)
    async uploadImagesFromFileList(fileList, productSku) {
        const files = Array.from(fileList);
        return this.uploadMultipleImages(files, productSku);
    }

    // Upload from base64 strings (if you still want compression before upload)
    async uploadBase64Image(base64String, path) {
        try {
            // Convert base64 to blob
            const response = await fetch(base64String);
            const blob = await response.blob();
            
            // Create a File object from blob
            const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
            
            // Upload the file
            return this.uploadImage(file, path);
            
        } catch (error) {
            console.error('Error uploading base64 image:', error);
            throw error;
        }
    }

    // Delete an image by URL
    async deleteImageByUrl(imageUrl) {
        try {
            if (!this.initialized) {
                this.initialize();
            }

            // Create a reference from the URL
            const storageRef = this.storage.refFromURL(imageUrl);
            
            // Delete the file
            await storageRef.delete();
            
            console.log('🗑️ Image deleted successfully');
            return true;
            
        } catch (error) {
            console.error('Error deleting image:', error);
            throw error;
        }
    }

    // Delete multiple images
    async deleteMultipleImages(imageUrls) {
        try {
            const deletePromises = imageUrls.map(url => this.deleteImageByUrl(url));
            await Promise.all(deletePromises);
            console.log(`✅ ${imageUrls.length} images deleted successfully`);
            return true;
        } catch (error) {
            console.error('Error deleting multiple images:', error);
            throw error;
        }
    }
}

const firebaseService = new FirebaseService();
