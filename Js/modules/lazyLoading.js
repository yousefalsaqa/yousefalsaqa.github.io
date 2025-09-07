/* ==========================================================================
   Lazy Loading Module
   ========================================================================== */

import { safeAddEventListener, debounce } from './utils.js';

class LazyLoadingManager {
    constructor() {
        this.images = new Set();
        this.observer = null;
        this.fallbackActive = false;
        
        this.init();
    }

    /**
     * Initialize lazy loading system
     */
    init() {
        try {
            if ('IntersectionObserver' in window) {
                this.setupIntersectionObserver();
            } else {
                this.setupFallback();
            }
            
            this.loadImages();
            this.setupImageErrorHandling();
        } catch (error) {
            console.error('Error initializing lazy loading:', error);
            this.loadAllImages(); // Fallback to load all images
        }
    }

    /**
     * Setup intersection observer for modern browsers
     */
    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '50px 0px 50px 0px', // Load images 50px before they come into view
            threshold: 0.01
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, options);
    }

    /**
     * Setup fallback for older browsers
     */
    setupFallback() {
        this.fallbackActive = true;
        
        const checkImages = debounce(() => {
            this.images.forEach(img => {
                if (this.isInViewport(img)) {
                    this.loadImage(img);
                    this.images.delete(img);
                }
            });
        }, 100);

        safeAddEventListener(window, 'scroll', checkImages, { passive: true });
        safeAddEventListener(window, 'resize', checkImages, { passive: true });
        
        // Initial check
        checkImages();
    }

    /**
     * Find and setup lazy loading for images
     */
    loadImages() {
        // Find all images with loading="lazy" or data-src attributes
        const lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src]');
        
        lazyImages.forEach(img => {
            this.setupImage(img);
        });

        // Also handle background images
        const lazyBackgrounds = document.querySelectorAll('[data-bg]');
        lazyBackgrounds.forEach(element => {
            this.setupBackgroundImage(element);
        });
    }

    /**
     * Setup individual image for lazy loading
     */
    setupImage(img) {
        // Add loading placeholder
        img.classList.add('image-loading');
        
        // Store original src if not already stored
        if (img.src && !img.dataset.src) {
            img.dataset.src = img.src;
            img.src = this.createPlaceholder(img.width || 300, img.height || 200);
        }
        
        this.images.add(img);
        
        if (this.observer) {
            this.observer.observe(img);
        }
    }

    /**
     * Setup background image for lazy loading
     */
    setupBackgroundImage(element) {
        element.classList.add('image-loading');
        this.images.add(element);
        
        if (this.observer) {
            this.observer.observe(element);
        }
    }

    /**
     * Load individual image
     */
    loadImage(img) {
        return new Promise((resolve, reject) => {
            if (img.dataset.bg) {
                // Handle background image
                this.loadBackgroundImage(img).then(resolve).catch(reject);
            } else {
                // Handle regular image
                this.loadRegularImage(img).then(resolve).catch(reject);
            }
        });
    }

    /**
     * Load regular image
     */
    loadRegularImage(img) {
        return new Promise((resolve, reject) => {
            const newImg = new Image();
            
            newImg.onload = () => {
                // Replace placeholder with actual image
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
                
                // Update srcset if present
                if (img.dataset.srcset) {
                    img.srcset = img.dataset.srcset;
                }
                
                // Remove loading state
                img.classList.remove('image-loading');
                img.classList.add('loaded');
                
                // Dispatch load event
                this.dispatchLoadEvent(img);
                
                resolve(img);
            };
            
            newImg.onerror = () => {
                this.handleImageError(img);
                reject(new Error(`Failed to load image: ${img.dataset.src}`));
            };
            
            // Start loading
            newImg.src = img.dataset.src || img.src;
            
            // Copy srcset for responsive images
            if (img.dataset.srcset) {
                newImg.srcset = img.dataset.srcset;
            }
        });
    }

    /**
     * Load background image
     */
    loadBackgroundImage(element) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                element.style.backgroundImage = `url(${element.dataset.bg})`;
                element.classList.remove('image-loading');
                element.classList.add('loaded');
                
                this.dispatchLoadEvent(element);
                resolve(element);
            };
            
            img.onerror = () => {
                this.handleImageError(element);
                reject(new Error(`Failed to load background image: ${element.dataset.bg}`));
            };
            
            img.src = element.dataset.bg;
        });
    }

    /**
     * Handle image loading errors
     */
    handleImageError(img) {
        img.classList.remove('image-loading');
        img.classList.add('error');
        
        // Set fallback image or placeholder
        if (img.dataset.fallback) {
            img.src = img.dataset.fallback;
        } else if (img.tagName === 'IMG') {
            img.src = this.createErrorPlaceholder(img.width || 300, img.height || 200);
        }
        
        console.warn('Failed to load image:', img.dataset.src || img.src);
    }

    /**
     * Setup error handling for all images
     */
    setupImageErrorHandling() {
        safeAddEventListener(document, 'error', (event) => {
            if (event.target.tagName === 'IMG') {
                this.handleImageError(event.target);
            }
        }, true);
    }

    /**
     * Create placeholder image (data URL)
     */
    createPlaceholder(width = 300, height = 200) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = width;
        canvas.height = height;
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#f0f0f0');
        gradient.addColorStop(1, '#e0e0e0');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add loading indicator
        ctx.fillStyle = '#ccc';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', width / 2, height / 2);
        
        return canvas.toDataURL();
    }

    /**
     * Create error placeholder
     */
    createErrorPlaceholder(width = 300, height = 200) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = width;
        canvas.height = height;
        
        // Create error background
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, 0, width, height);
        
        // Add error message
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Image failed to load', width / 2, height / 2);
        
        return canvas.toDataURL();
    }

    /**
     * Check if element is in viewport (fallback method)
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        return (
            rect.bottom >= -50 &&
            rect.right >= 0 &&
            rect.top <= windowHeight + 50 &&
            rect.left <= windowWidth
        );
    }

    /**
     * Dispatch custom load event
     */
    dispatchLoadEvent(element) {
        const event = new CustomEvent('lazyload', {
            detail: { element },
            bubbles: true,
            cancelable: true
        });
        
        element.dispatchEvent(event);
    }

    /**
     * Load all images immediately (fallback)
     */
    loadAllImages() {
        const allImages = document.querySelectorAll('img[data-src], [data-bg]');
        
        allImages.forEach(element => {
            if (element.dataset.src) {
                element.src = element.dataset.src;
                if (element.dataset.srcset) {
                    element.srcset = element.dataset.srcset;
                }
            }
            
            if (element.dataset.bg) {
                element.style.backgroundImage = `url(${element.dataset.bg})`;
            }
            
            element.classList.remove('image-loading');
            element.classList.add('loaded');
        });
    }

    /**
     * Add new images to lazy loading
     */
    addImages(images) {
        const imageArray = Array.isArray(images) ? images : [images];
        
        imageArray.forEach(img => {
            if (img.tagName === 'IMG' || img.dataset.bg) {
                this.setupImage(img);
            }
        });
    }

    /**
     * Refresh lazy loading (useful for dynamically added content)
     */
    refresh() {
        this.loadImages();
    }

    /**
     * Get loading statistics
     */
    getStats() {
        return {
            totalImages: this.images.size,
            loadedImages: document.querySelectorAll('img.loaded, [data-bg].loaded').length,
            errorImages: document.querySelectorAll('img.error, [data-bg].error').length
        };
    }

    /**
     * Destroy lazy loading manager
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.images.clear();
    }
}

// Initialize lazy loading when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.lazyLoadingManager = new LazyLoadingManager();
    });
} else {
    window.lazyLoadingManager = new LazyLoadingManager();
}

export default LazyLoadingManager;

