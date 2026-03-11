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

    // Compress image before upload
    async compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Calculate new dimensions while maintaining aspect ratio
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round(height * (maxWidth / width));
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round(width * (maxHeight / height));
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to blob
                    canvas.toBlob((blob) => {
                        // Create a new File from the blob
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        
                        // Log compression stats
                        const originalSizeKB = file.size / 1024;
                        const compressedSizeKB = compressedFile.size / 1024;
                        console.log(`📸 Compressed: ${originalSizeKB.toFixed(0)}KB → ${compressedSizeKB.toFixed(0)}KB (${Math.round((1-compressedSizeKB/originalSizeKB)*100)}% reduction)`);
                        
                        resolve(compressedFile);
                    }, 'image/jpeg', quality);
                };
                
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    // Upload a single image to Firebase Storage
    async uploadImage(file, path) {
        try {
            if (!this.initialized) {
                this.initialize();
            }

            // Compress the image first
            const compressedFile = await this.compressImage(file, 800, 800, 0.8);
            
            // Create a unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const filename = `${timestamp}-${randomString}.jpg`;
            const fullPath = `products/${path}/${filename}`;
            
            // Create storage reference
            const storageRef = this.storage.ref(fullPath);
            
            // Upload file with metadata
            const metadata = {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000',
            };
            
            const snapshot = await storageRef.put(compressedFile, metadata);
            
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
                const path = `${productSku}`;
                
                // Upload and collect promise
                const uploadPromise = this.uploadImage(file, path)
                    .then(url => {
                        imageUrls.push(url);
                        return url;
                    });
                
                uploadPromises.push(uploadPromise);
                
                // Small delay between uploads to avoid overwhelming
                await new Promise(resolve => setTimeout(resolve, 500));
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
