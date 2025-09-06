/* ==========================================================================
   Animations Module
   ========================================================================== */

import { debounce, safeAddEventListener, isInViewport, prefersReducedMotion } from './utils.js';

class AnimationManager {
    constructor() {
        this.animatedElements = new Set();
        this.observers = new Map();
        this.reducedMotion = prefersReducedMotion();
        
        this.init();
    }

    /**
     * Initialize animation system
     */
    init() {
        try {
            this.setupIntersectionObserver();
            this.initializeAnimations();
            this.setupMotionPreferenceListener();
        } catch (error) {
            console.error('Error initializing animations:', error);
        }
    }

    /**
     * Setup intersection observer for scroll animations
     */
    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '0px 0px -10% 0px',
            threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
        };

        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => this.handleIntersection(entry));
        }, options);
    }

    /**
     * Initialize all animations
     */
    initializeAnimations() {
        // Fade in animations
        this.observeElements('.fade-in-up', 'fade-in-up');
        this.observeElements('.fade-in-left', 'fade-in-left');
        this.observeElements('.fade-in-right', 'fade-in-right');
        this.observeElements('.scale-in', 'scale-in');
        
        // Stagger animations for grids
        this.setupStaggeredAnimations('.projects-grid .project-card', 100);
        this.setupStaggeredAnimations('.experience .showcase-box', 150);
        
        // Loading animations
        this.initLoadingAnimations();
        
        // Page transition
        this.initPageTransition();
    }

    /**
     * Observe elements for animations
     */
    observeElements(selector, animationType) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach((element, index) => {
            if (this.reducedMotion) {
                element.classList.add('visible');
                return;
            }
            
            element.dataset.animationType = animationType;
            element.dataset.animationIndex = index;
            this.scrollObserver.observe(element);
        });
    }

    /**
     * Handle intersection observer entries
     */
    handleIntersection(entry) {
        const element = entry.target;
        const animationType = element.dataset.animationType;
        
        if (entry.isIntersecting && !this.animatedElements.has(element)) {
            this.animateElement(element, animationType);
            this.animatedElements.add(element);
        }
    }

    /**
     * Animate individual element
     */
    animateElement(element, animationType) {
        if (this.reducedMotion) {
            element.classList.add('visible');
            return;
        }
        
        // Add a small delay based on element index for stagger effect
        const index = parseInt(element.dataset.animationIndex) || 0;
        const delay = index * 50; // 50ms stagger
        
        setTimeout(() => {
            element.classList.add('visible');
            this.dispatchAnimationEvent(element, 'animationStart');
        }, delay);
        
        // Listen for animation end
        const handleAnimationEnd = () => {
            this.dispatchAnimationEvent(element, 'animationEnd');
            element.removeEventListener('transitionend', handleAnimationEnd);
        };
        
        safeAddEventListener(element, 'transitionend', handleAnimationEnd);
    }

    /**
     * Setup staggered animations for element groups
     */
    setupStaggeredAnimations(selector, staggerDelay = 100) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach((element, index) => {
            if (this.reducedMotion) return;
            
            element.style.animationDelay = `${index * staggerDelay}ms`;
        });
    }

    /**
     * Initialize loading animations
     */
    initLoadingAnimations() {
        this.showLoadingOverlay();
        
        // Hide loading overlay when page is fully loaded
        if (document.readyState === 'complete') {
            this.hideLoadingOverlay();
        } else {
            safeAddEventListener(window, 'load', () => {
                setTimeout(() => this.hideLoadingOverlay(), 500);
            });
        }
    }

    /**
     * Show loading overlay
     */
    showLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
            
            // Remove from DOM after animation
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Initialize page transition
     */
    initPageTransition() {
        const body = document.body;
        body.classList.add('page-transition');
        
        // Trigger page load animation
        setTimeout(() => {
            body.classList.add('loaded');
        }, 100);
    }

    /**
     * Animate project cards on load
     */
    animateProjectCards() {
        const cards = document.querySelectorAll('.project-card');
        
        cards.forEach((card, index) => {
            if (this.reducedMotion) {
                card.style.opacity = '1';
                card.style.transform = 'none';
                return;
            }
            
            // Initial state
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            
            // Animate in with stagger
            setTimeout(() => {
                card.style.transition = 'all 0.6s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /**
     * Animate skill bars or progress indicators
     */
    animateProgressBars() {
        const progressBars = document.querySelectorAll('.progress-bar-fill');
        
        progressBars.forEach(bar => {
            const targetWidth = bar.dataset.width || '0%';
            
            if (this.reducedMotion) {
                bar.style.width = targetWidth;
                return;
            }
            
            // Animate progress bar
            bar.style.width = '0%';
            
            setTimeout(() => {
                bar.style.transition = 'width 1.5s ease-out';
                bar.style.width = targetWidth;
            }, 500);
        });
    }

    /**
     * Create floating animation for background elements
     */
    createFloatingElements() {
        if (this.reducedMotion) return;
        
        const container = document.body;
        const numElements = 5;
        
        for (let i = 0; i < numElements; i++) {
            const element = document.createElement('div');
            element.className = 'floating-element';
            element.style.cssText = `
                position: absolute;
                width: ${Math.random() * 20 + 10}px;
                height: ${Math.random() * 20 + 10}px;
                background: rgba(255, 215, 0, 0.1);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation-delay: ${Math.random() * 6}s;
                pointer-events: none;
            `;
            
            container.appendChild(element);
        }
    }

    /**
     * Setup motion preference listener
     */
    setupMotionPreferenceListener() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleChange = (e) => {
            this.reducedMotion = e.matches;
            this.updateAnimationsForMotionPreference();
        };
        
        safeAddEventListener(mediaQuery, 'change', handleChange);
    }

    /**
     * Update animations based on motion preference
     */
    updateAnimationsForMotionPreference() {
        if (this.reducedMotion) {
            // Disable all animations
            document.documentElement.style.setProperty('--transition-fast', '0ms');
            document.documentElement.style.setProperty('--transition-base', '0ms');
            document.documentElement.style.setProperty('--transition-slow', '0ms');
            
            // Make all animated elements visible immediately
            this.animatedElements.forEach(element => {
                element.classList.add('visible');
                element.style.transition = 'none';
            });
        } else {
            // Re-enable animations
            document.documentElement.style.removeProperty('--transition-fast');
            document.documentElement.style.removeProperty('--transition-base');
            document.documentElement.style.removeProperty('--transition-slow');
        }
    }

    /**
     * Dispatch custom animation events
     */
    dispatchAnimationEvent(element, eventType) {
        const event = new CustomEvent(eventType, {
            detail: { element },
            bubbles: true,
            cancelable: true
        });
        
        element.dispatchEvent(event);
    }

    /**
     * Create typewriter effect
     */
    typewriterEffect(element, text, speed = 50) {
        if (this.reducedMotion || !element) {
            element.textContent = text;
            return Promise.resolve();
        }
        
        return new Promise(resolve => {
            element.textContent = '';
            let i = 0;
            
            const typeChar = () => {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(typeChar, speed);
                } else {
                    resolve();
                }
            };
            
            typeChar();
        });
    }

    /**
     * Create parallax effect
     */
    setupParallax() {
        if (this.reducedMotion) return;
        
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        
        const updateParallax = () => {
            const scrollY = window.pageYOffset;
            
            parallaxElements.forEach(element => {
                const speed = parseFloat(element.dataset.parallax) || 0.5;
                const yPos = -(scrollY * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        };
        
        safeAddEventListener(window, 'scroll', debounce(updateParallax, 16), { passive: true });
    }

    /**
     * Animate counter numbers
     */
    animateCounters() {
        const counters = document.querySelectorAll('[data-counter]');
        
        counters.forEach(counter => {
            const target = parseInt(counter.dataset.counter);
            const duration = parseInt(counter.dataset.duration) || 2000;
            
            if (this.reducedMotion) {
                counter.textContent = target;
                return;
            }
            
            let start = 0;
            const increment = target / (duration / 16);
            
            const updateCounter = () => {
                start += increment;
                if (start < target) {
                    counter.textContent = Math.floor(start);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            };
            
            updateCounter();
        });
    }

    /**
     * Destroy animation manager
     */
    destroy() {
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
        }
        
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.animatedElements.clear();
    }
}

// Initialize animations when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.animationManager = new AnimationManager();
    });
} else {
    window.animationManager = new AnimationManager();
}

export default AnimationManager;
