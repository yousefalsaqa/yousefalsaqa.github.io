/* ==========================================================================
   Utility Functions Module
   ========================================================================== */

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait, immediate = false) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
};

/**
 * Throttle function to limit function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Check if element is in viewport
 * @param {Element} element - DOM element to check
 * @param {number} threshold - Threshold percentage (0-1)
 * @returns {boolean} True if element is in viewport
 */
export const isInViewport = (element, threshold = 0.1) => {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    const verticalVisible = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horizontalVisible = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);
    
    const visibleArea = Math.max(0, Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0)) *
                       Math.max(0, Math.min(rect.right, windowWidth) - Math.max(rect.left, 0));
    const totalArea = rect.width * rect.height;
    
    return verticalVisible && horizontalVisible && (visibleArea / totalArea) >= threshold;
};

/**
 * Get scroll percentage of page
 * @returns {number} Scroll percentage (0-100)
 */
export const getScrollPercentage = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    return scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
};

/**
 * Smooth scroll to element
 * @param {Element|string} target - Target element or selector
 * @param {number} offset - Offset from top in pixels
 * @param {string} behavior - Scroll behavior ('smooth' or 'auto')
 */
export const scrollToElement = (target, offset = 0, behavior = 'smooth') => {
    try {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element) {
            console.warn(`Element not found: ${target}`);
            return;
        }
        
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: behavior
        });
    } catch (error) {
        console.error('Error scrolling to element:', error);
    }
};

/**
 * Get element's offset from top of page
 * @param {Element} element - DOM element
 * @returns {number} Offset from top in pixels
 */
export const getElementOffset = (element) => {
    if (!element) return 0;
    
    let offsetTop = 0;
    let currentElement = element;
    
    while (currentElement) {
        offsetTop += currentElement.offsetTop;
        currentElement = currentElement.offsetParent;
    }
    
    return offsetTop;
};

/**
 * Add event listener with error handling
 * @param {Element} element - DOM element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event options
 */
export const safeAddEventListener = (element, event, handler, options = {}) => {
    try {
        if (!element || typeof handler !== 'function') {
            console.warn('Invalid element or handler for event listener');
            return;
        }
        
        element.addEventListener(event, handler, options);
    } catch (error) {
        console.error(`Error adding event listener for ${event}:`, error);
    }
};

/**
 * Remove event listener with error handling
 * @param {Element} element - DOM element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event options
 */
export const safeRemoveEventListener = (element, event, handler, options = {}) => {
    try {
        if (!element || typeof handler !== 'function') {
            console.warn('Invalid element or handler for event listener removal');
            return;
        }
        
        element.removeEventListener(event, handler, options);
    } catch (error) {
        console.error(`Error removing event listener for ${event}:`, error);
    }
};

/**
 * Check if user prefers reduced motion
 * @returns {boolean} True if user prefers reduced motion
 */
export const prefersReducedMotion = () => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Check if device supports touch
 * @returns {boolean} True if device supports touch
 */
export const isTouchDevice = () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
};

/**
 * Get device type based on screen size
 * @returns {string} Device type ('mobile', 'tablet', 'desktop')
 */
export const getDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
    try {
        const dateObj = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...options
        }).format(dateObj);
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
};

/**
 * Generate unique ID
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
export const generateId = (prefix = 'id') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
};

/**
 * Wait for specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after specified time
 */
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Load script dynamically
 * @param {string} src - Script source URL
 * @param {Object} options - Script options
 * @returns {Promise} Promise that resolves when script loads
 */
export const loadScript = (src, options = {}) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = options.async !== false;
        script.defer = options.defer || false;
        
        script.onload = () => resolve(script);
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        
        document.head.appendChild(script);
    });
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise} Promise that resolves when text is copied
 */
export const copyToClipboard = async (text) => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
        return true;
    } catch (error) {
        console.error('Failed to copy text:', error);
        return false;
    }
};

/**
 * Validate email address
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email is valid
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Create and dispatch custom event
 * @param {string} eventName - Event name
 * @param {Object} detail - Event detail data
 * @param {Element} target - Event target (defaults to document)
 */
export const dispatchCustomEvent = (eventName, detail = {}, target = document) => {
    try {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true,
            cancelable: true
        });
        target.dispatchEvent(event);
    } catch (error) {
        console.error(`Error dispatching custom event ${eventName}:`, error);
    }
};

