/* ==========================================================================
   Navigation Module
   ========================================================================== */

import { debounce, throttle, safeAddEventListener, scrollToElement, getScrollPercentage, isInViewport } from './utils.js';

class NavigationManager {
    constructor() {
        this.header = null;
        this.navbar = null;
        this.navLinks = [];
        this.sections = [];
        this.mobileToggle = null;
        this.scrollIndicator = null;
        this.scrollIndicatorBar = null;
        this.activeSection = null;
        this.isScrolling = false;
        this.lastScrollY = 0;
        
        this.init();
    }

    /**
     * Initialize navigation functionality
     */
    init() {
        try {
            this.cacheElements();
            this.bindEvents();
            this.setupIntersectionObserver();
            this.updateActiveLink();
        } catch (error) {
            console.error('Error initializing navigation:', error);
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.header = document.getElementById('header');
        this.navbar = document.getElementById('navbar');
        this.navLinks = Array.from(document.querySelectorAll('.nav-link'));
        this.sections = Array.from(document.querySelectorAll('section[id]'));
        this.mobileToggle = document.getElementById('mobile-menu-toggle');
        this.scrollIndicator = document.querySelector('.scroll-indicator');
        this.scrollIndicatorBar = document.querySelector('.scroll-indicator-bar');

        if (!this.header || !this.navbar) {
            throw new Error('Required navigation elements not found');
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Scroll events
        const handleScroll = throttle(() => this.handleScroll(), 16); // ~60fps
        safeAddEventListener(window, 'scroll', handleScroll, { passive: true });

        // Navigation link clicks
        this.navLinks.forEach(link => {
            safeAddEventListener(link, 'click', (e) => this.handleNavClick(e));
        });

        // Mobile menu toggle
        if (this.mobileToggle) {
            safeAddEventListener(this.mobileToggle, 'click', () => this.toggleMobileMenu());
            safeAddEventListener(this.mobileToggle, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleMobileMenu();
                }
            });
        }

        // Close mobile menu on outside click
        safeAddEventListener(document, 'click', (e) => this.handleOutsideClick(e));

        // Handle resize
        const handleResize = debounce(() => this.handleResize(), 250);
        safeAddEventListener(window, 'resize', handleResize);

        // Keyboard navigation
        safeAddEventListener(document, 'keydown', (e) => this.handleKeyboardNavigation(e));
    }

    /**
     * Setup Intersection Observer for section tracking
     */
    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '-20% 0px -70% 0px',
            threshold: [0, 0.25, 0.5, 0.75, 1]
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.setActiveSection(entry.target.id);
                }
            });
        }, options);

        this.sections.forEach(section => {
            this.observer.observe(section);
        });
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        const currentScrollY = window.pageYOffset;
        
        try {
            // Update scroll indicator
            this.updateScrollIndicator();
            
            // Update header appearance on scroll
            this.updateHeaderOnScroll(currentScrollY);
            
            // Hide/show header based on scroll direction
            this.handleHeaderVisibility(currentScrollY);
            
            this.lastScrollY = currentScrollY;
        } catch (error) {
            console.error('Error handling scroll:', error);
        }
    }

    /**
     * Update scroll progress indicator
     */
    updateScrollIndicator() {
        if (!this.scrollIndicatorBar) return;
        
        const scrollPercentage = getScrollPercentage();
        this.scrollIndicatorBar.style.width = `${scrollPercentage}%`;
    }

    /**
     * Update header appearance based on scroll position
     */
    updateHeaderOnScroll(scrollY) {
        if (!this.header) return;
        
        if (scrollY > 100) {
            this.header.classList.add('scrolled');
        } else {
            this.header.classList.remove('scrolled');
        }
    }

    /**
     * Handle header visibility based on scroll direction
     */
    handleHeaderVisibility(currentScrollY) {
        if (!this.header) return;
        
        const scrollDifference = Math.abs(currentScrollY - this.lastScrollY);
        
        // Only hide/show if scroll difference is significant
        if (scrollDifference < 5) return;
        
        if (currentScrollY > this.lastScrollY && currentScrollY > 200) {
            // Scrolling down - hide header
            this.header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up - show header
            this.header.style.transform = 'translateY(0)';
        }
    }

    /**
     * Handle navigation link clicks
     */
    handleNavClick(event) {
        event.preventDefault();
        
        const link = event.currentTarget;
        const href = link.getAttribute('href');
        
        if (!href || href === '#') return;
        
        // Handle email links
        if (href.startsWith('mailto:')) {
            window.location.href = href;
            return;
        }
        
        // Handle section navigation
        if (href.startsWith('#')) {
            const targetId = href.substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                this.scrollToSection(targetSection);
                this.closeMobileMenu();
                
                // Update URL without triggering scroll
                if (history.replaceState) {
                    history.replaceState(null, null, href);
                }
            }
        }
    }

    /**
     * Scroll to section with offset
     */
    scrollToSection(section) {
        const headerHeight = this.header ? this.header.offsetHeight : 0;
        const offset = headerHeight + 20; // Add some padding
        
        scrollToElement(section, offset);
    }

    /**
     * Set active section and update navigation
     */
    setActiveSection(sectionId) {
        if (this.activeSection === sectionId) return;
        
        this.activeSection = sectionId;
        this.updateActiveLink();
    }

    /**
     * Update active navigation link
     */
    updateActiveLink() {
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            link.setAttribute('aria-current', 'false');
            
            const href = link.getAttribute('href');
            if (href === `#${this.activeSection}`) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            }
        });
    }

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        if (!this.navbar || !this.mobileToggle) return;
        
        const isExpanded = this.mobileToggle.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        
        this.mobileToggle.setAttribute('aria-expanded', newState.toString());
        this.mobileToggle.classList.toggle('active', newState);
        this.navbar.classList.toggle('mobile', newState);
        this.navbar.classList.toggle('active', newState);
        
        // Manage focus
        if (newState) {
            this.trapFocus();
        } else {
            this.releaseFocus();
        }
        
        // Prevent body scroll when menu is open
        document.body.style.overflow = newState ? 'hidden' : '';
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        if (!this.navbar || !this.mobileToggle) return;
        
        this.mobileToggle.setAttribute('aria-expanded', 'false');
        this.mobileToggle.classList.remove('active');
        this.navbar.classList.remove('mobile', 'active');
        document.body.style.overflow = '';
        
        this.releaseFocus();
    }

    /**
     * Handle clicks outside mobile menu
     */
    handleOutsideClick(event) {
        if (!this.navbar || !this.mobileToggle) return;
        
        const isMenuOpen = this.navbar.classList.contains('active');
        if (!isMenuOpen) return;
        
        const isClickInsideMenu = this.navbar.contains(event.target) || 
                                 this.mobileToggle.contains(event.target);
        
        if (!isClickInsideMenu) {
            this.closeMobileMenu();
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Close mobile menu on resize to desktop
        if (window.innerWidth > 768) {
            this.closeMobileMenu();
        }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyboardNavigation(event) {
        // Close mobile menu on Escape
        if (event.key === 'Escape') {
            this.closeMobileMenu();
        }
        
        // Navigate with arrow keys when focus is on nav
        if (document.activeElement?.closest('#navbar')) {
            this.handleArrowKeyNavigation(event);
        }
    }

    /**
     * Handle arrow key navigation in menu
     */
    handleArrowKeyNavigation(event) {
        const focusableLinks = this.navLinks.filter(link => 
            link.offsetParent !== null && !link.disabled
        );
        
        const currentIndex = focusableLinks.indexOf(document.activeElement);
        let nextIndex;
        
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                event.preventDefault();
                nextIndex = (currentIndex + 1) % focusableLinks.length;
                focusableLinks[nextIndex].focus();
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                event.preventDefault();
                nextIndex = currentIndex <= 0 ? focusableLinks.length - 1 : currentIndex - 1;
                focusableLinks[nextIndex].focus();
                break;
            case 'Home':
                event.preventDefault();
                focusableLinks[0].focus();
                break;
            case 'End':
                event.preventDefault();
                focusableLinks[focusableLinks.length - 1].focus();
                break;
        }
    }

    /**
     * Trap focus within mobile menu
     */
    trapFocus() {
        const focusableElements = this.navbar.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        this.focusTrapHandler = (event) => {
            if (event.key !== 'Tab') return;
            
            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };
        
        safeAddEventListener(document, 'keydown', this.focusTrapHandler);
        firstElement.focus();
    }

    /**
     * Release focus trap
     */
    releaseFocus() {
        if (this.focusTrapHandler) {
            document.removeEventListener('keydown', this.focusTrapHandler);
            this.focusTrapHandler = null;
        }
    }

    /**
     * Destroy navigation manager
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.releaseFocus();
        
        // Remove event listeners would go here if we tracked them
        // For now, we rely on garbage collection
    }
}

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.navigationManager = new NavigationManager();
    });
} else {
    window.navigationManager = new NavigationManager();
}

export default NavigationManager;



