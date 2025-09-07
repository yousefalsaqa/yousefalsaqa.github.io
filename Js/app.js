/* ==========================================================================
   Main Application Entry Point
   Modern Portfolio - Yousef Alsaqa
   ========================================================================== */

import { debounce, throttle, safeAddEventListener, getScrollPercentage, prefersReducedMotion } from './modules/utils.js';
import NavigationManager from './modules/navigation.js';
import AnimationManager from './modules/animations.js';
import LazyLoadingManager from './modules/lazyLoading.js';

class PortfolioApp {
    constructor() {
        this.modules = new Map();
        this.isInitialized = false;
        this.performance = {
            startTime: performance.now(),
            loadTime: null,
            interactiveTime: null
        };
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('🚀 Initializing Portfolio Application...');
            
            // Wait for DOM to be ready
            await this.waitForDOM();
            
            // Initialize core modules
            await this.initializeModules();
            
            // Setup global event listeners
            this.setupGlobalEvents();
            
            // Initialize third-party libraries
            this.initializeVendorLibraries();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Mark as initialized
            this.isInitialized = true;
            this.performance.loadTime = performance.now() - this.performance.startTime;
            
            console.log(`✅ Portfolio loaded in ${this.performance.loadTime.toFixed(2)}ms`);
            
            // Dispatch ready event
            this.dispatchReadyEvent();
            
        } catch (error) {
            console.error('❌ Error initializing portfolio:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Wait for DOM to be ready
     */
    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Initialize core modules
     */
    async initializeModules() {
        const modulePromises = [
            this.initializeNavigation(),
            this.initializeAnimations(),
            this.initializeLazyLoading(),
            this.initializeBackToTop(),
            this.initializeContactButton(),
            this.initializeAccessibility()
        ];

        await Promise.allSettled(modulePromises);
    }

    /**
     * Initialize navigation module
     */
    async initializeNavigation() {
        try {
            const navigation = new NavigationManager();
            this.modules.set('navigation', navigation);
            console.log('✅ Navigation module initialized');
        } catch (error) {
            console.error('❌ Error initializing navigation:', error);
        }
    }

    /**
     * Initialize animations module
     */
    async initializeAnimations() {
        try {
            const animations = new AnimationManager();
            this.modules.set('animations', animations);
            console.log('✅ Animations module initialized');
        } catch (error) {
            console.error('❌ Error initializing animations:', error);
        }
    }

    /**
     * Initialize lazy loading module
     */
    async initializeLazyLoading() {
        try {
            const lazyLoading = new LazyLoadingManager();
            this.modules.set('lazyLoading', lazyLoading);
            console.log('✅ Lazy loading module initialized');
        } catch (error) {
            console.error('❌ Error initializing lazy loading:', error);
        }
    }

    /**
     * Initialize back to top functionality
     */
    async initializeBackToTop() {
        try {
            const backToTopBtn = document.getElementById('back-to-top');
            if (!backToTopBtn) return;

            const showButton = throttle(() => {
                const scrollY = window.pageYOffset;
                const shouldShow = scrollY > 300;
                
                backToTopBtn.classList.toggle('visible', shouldShow);
                backToTopBtn.setAttribute('aria-hidden', (!shouldShow).toString());
            }, 100);

            safeAddEventListener(window, 'scroll', showButton, { passive: true });

            safeAddEventListener(backToTopBtn, 'click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: prefersReducedMotion() ? 'auto' : 'smooth'
                });
            });

            console.log('✅ Back to top initialized');
        } catch (error) {
            console.error('❌ Error initializing back to top:', error);
        }
    }

    /**
     * Initialize contact button functionality
     */
    async initializeContactButton() {
        try {
            const contactButtons = document.querySelectorAll('[href^="mailto:"]');
            
            contactButtons.forEach(button => {
                safeAddEventListener(button, 'click', (e) => {
                    // Track contact button clicks
                    this.trackEvent('contact', 'email_click', 'header');
                });
            });

            console.log('✅ Contact buttons initialized');
        } catch (error) {
            console.error('❌ Error initializing contact buttons:', error);
        }
    }

    /**
     * Initialize accessibility features
     */
    async initializeAccessibility() {
        try {
            // Skip links functionality
            this.setupSkipLinks();
            
            // Focus management
            this.setupFocusManagement();
            
            // Keyboard navigation
            this.setupKeyboardNavigation();
            
            // ARIA live regions
            this.setupLiveRegions();
            
            console.log('✅ Accessibility features initialized');
        } catch (error) {
            console.error('❌ Error initializing accessibility:', error);
        }
    }

    /**
     * Setup skip links
     */
    setupSkipLinks() {
        const skipLinks = document.querySelectorAll('.skip-link');
        
        skipLinks.forEach(link => {
            safeAddEventListener(link, 'click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                
                if (target) {
                    target.focus();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    /**
     * Setup focus management
     */
    setupFocusManagement() {
        // Ensure focusable elements are properly managed
        const focusableElements = document.querySelectorAll(
            'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
        );

        focusableElements.forEach(element => {
            if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
                // Add appropriate labels for screen readers
                const text = element.textContent?.trim() || element.value || element.alt;
                if (text) {
                    element.setAttribute('aria-label', text);
                }
            }
        });
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        safeAddEventListener(document, 'keydown', (e) => {
            // Handle global keyboard shortcuts
            switch (e.key) {
                case 'Escape':
                    this.handleEscapeKey();
                    break;
                case 'Tab':
                    this.handleTabKey(e);
                    break;
            }
        });
    }

    /**
     * Setup ARIA live regions
     */
    setupLiveRegions() {
        // Create live region for announcements
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.id = 'live-region';
        document.body.appendChild(liveRegion);

        // Store reference for announcements
        this.liveRegion = liveRegion;
    }

    /**
     * Handle escape key press
     */
    handleEscapeKey() {
        // Close any open modals, menus, etc.
        const openElements = document.querySelectorAll('.active, .open, [aria-expanded="true"]');
        openElements.forEach(element => {
            if (element.classList.contains('navbar')) {
                this.modules.get('navigation')?.closeMobileMenu();
            }
        });
    }

    /**
     * Handle tab key for focus management
     */
    handleTabKey(e) {
        // Implement focus trapping if needed
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            this.trapFocusInModal(e, activeModal);
        }
    }

    /**
     * Setup global event listeners
     */
    setupGlobalEvents() {
        // Handle page visibility changes
        safeAddEventListener(document, 'visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Handle online/offline status
        safeAddEventListener(window, 'online', () => this.handleOnline());
        safeAddEventListener(window, 'offline', () => this.handleOffline());

        // Handle unload for cleanup
        safeAddEventListener(window, 'beforeunload', () => this.cleanup());

        // Global error handling
        safeAddEventListener(window, 'error', (e) => this.handleGlobalError(e));
        safeAddEventListener(window, 'unhandledrejection', (e) => this.handleUnhandledRejection(e));
    }

    /**
     * Initialize third-party vendor libraries
     */
    initializeVendorLibraries() {
        try {
            // Initialize AOS (Animate On Scroll) if available
            if (typeof AOS !== 'undefined' && !prefersReducedMotion()) {
                AOS.init({
                    duration: 800,
                    easing: 'ease-out',
                    once: true,
                    offset: 100
                });
                console.log('✅ AOS initialized');
            }

            // Initialize other vendor libraries as needed
            this.initializeBootstrap();
            
        } catch (error) {
            console.error('❌ Error initializing vendor libraries:', error);
        }
    }

    /**
     * Initialize Bootstrap components
     */
    initializeBootstrap() {
        // Initialize tooltips if Bootstrap is available
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
        }
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor Core Web Vitals
        this.monitorWebVitals();
        
        // Monitor resource loading
        this.monitorResourceLoading();
        
        // Monitor user interactions
        this.monitorUserInteractions();
    }

    /**
     * Monitor Core Web Vitals
     */
    monitorWebVitals() {
        // First Contentful Paint
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                    console.log('📊 FCP:', entry.startTime.toFixed(2) + 'ms');
                }
            }
        }).observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            console.log('📊 LCP:', lastEntry.startTime.toFixed(2) + 'ms');
        }).observe({ entryTypes: ['largest-contentful-paint'] });
    }

    /**
     * Monitor resource loading
     */
    monitorResourceLoading() {
        safeAddEventListener(window, 'load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            console.log('📊 Page Load Time:', navigation.loadEventEnd - navigation.fetchStart + 'ms');
        });
    }

    /**
     * Monitor user interactions
     */
    monitorUserInteractions() {
        let isInteractive = false;
        
        const markInteractive = () => {
            if (!isInteractive) {
                isInteractive = true;
                this.performance.interactiveTime = performance.now() - this.performance.startTime;
                console.log('📊 Time to Interactive:', this.performance.interactiveTime.toFixed(2) + 'ms');
            }
        };

        ['click', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            safeAddEventListener(document, event, markInteractive, { once: true, passive: true });
        });
    }

    /**
     * Handle page hidden
     */
    handlePageHidden() {
        // Pause any running animations or timers
        console.log('📱 Page hidden - pausing activities');
    }

    /**
     * Handle page visible
     */
    handlePageVisible() {
        // Resume activities
        console.log('📱 Page visible - resuming activities');
    }

    /**
     * Handle online status
     */
    handleOnline() {
        this.announce('Connection restored');
        console.log('🌐 Back online');
    }

    /**
     * Handle offline status
     */
    handleOffline() {
        this.announce('Connection lost');
        console.log('📵 Gone offline');
    }

    /**
     * Handle global errors
     */
    handleGlobalError(event) {
        console.error('Global error:', event.error);
        this.trackEvent('error', 'javascript_error', event.error?.message || 'Unknown error');
    }

    /**
     * Handle unhandled promise rejections
     */
    handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        this.trackEvent('error', 'promise_rejection', event.reason?.message || 'Unknown rejection');
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.innerHTML = `
            <h3>Oops! Something went wrong</h3>
            <p>The portfolio is having trouble loading. Please try refreshing the page.</p>
            <button onclick="window.location.reload()">Refresh Page</button>
        `;
        
        document.body.prepend(errorMessage);
        this.trackEvent('error', 'initialization_error', error.message);
    }

    /**
     * Announce message to screen readers
     */
    announce(message) {
        if (this.liveRegion) {
            this.liveRegion.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                this.liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Track events (placeholder for analytics)
     */
    trackEvent(category, action, label) {
        console.log('📈 Event:', { category, action, label });
        
        // Integrate with analytics service
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: category,
                event_label: label
            });
        }
    }

    /**
     * Dispatch ready event
     */
    dispatchReadyEvent() {
        const event = new CustomEvent('portfolioReady', {
            detail: {
                loadTime: this.performance.loadTime,
                modules: Array.from(this.modules.keys())
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Get module instance
     */
    getModule(name) {
        return this.modules.get(name);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('🧹 Cleaning up resources...');
        
        // Destroy all modules
        this.modules.forEach((module, name) => {
            if (typeof module.destroy === 'function') {
                module.destroy();
                console.log(`✅ ${name} module destroyed`);
            }
        });
        
        this.modules.clear();
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performance,
            navigation: performance.getEntriesByType('navigation')[0],
            resources: performance.getEntriesByType('resource').length
        };
    }
}

// Initialize application
const app = new PortfolioApp();

// Make app globally available for debugging
if (typeof window !== 'undefined') {
    window.portfolioApp = app;
}

export default PortfolioApp;

