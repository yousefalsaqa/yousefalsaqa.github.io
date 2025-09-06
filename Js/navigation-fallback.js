/* ==========================================================================
   Navigation Fallback - Simple Implementation
   ========================================================================== */

(function() {
    'use strict';
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        setupNavigation();
        setupMobileMenu();
        setupScrollToTop();
        setupSmoothScrolling();
    }
    
    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const sections = document.querySelectorAll('section[id]');
        
        // Handle navigation clicks
        navLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const targetId = href.substring(1);
                    const targetSection = document.getElementById(targetId);
                    
                    if (targetSection) {
                        const headerHeight = 80;
                        const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                        
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                        
                        // Close mobile menu if open
                        closeMobileMenu();
                    }
                }
            });
        });
        
        // Update active link on scroll
        function updateActiveLink() {
            let current = '';
            
            sections.forEach(function(section) {
                const sectionTop = section.getBoundingClientRect().top;
                const sectionHeight = section.offsetHeight;
                
                if (sectionTop <= 100 && sectionTop + sectionHeight > 100) {
                    current = section.getAttribute('id');
                }
            });
            
            navLinks.forEach(function(link) {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + current) {
                    link.classList.add('active');
                }
            });
        }
        
        // Throttle scroll events
        let scrollTimeout;
        window.addEventListener('scroll', function() {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(updateActiveLink, 10);
        });
        
        // Initial call
        updateActiveLink();
    }
    
    function setupMobileMenu() {
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const navbar = document.getElementById('navbar');
        
        if (!mobileToggle || !navbar) return;
        
        mobileToggle.addEventListener('click', function() {
            toggleMobileMenu();
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navbar.contains(e.target) && !mobileToggle.contains(e.target)) {
                closeMobileMenu();
            }
        });
        
        // Close menu on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeMobileMenu();
            }
        });
    }
    
    function toggleMobileMenu() {
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const navbar = document.getElementById('navbar');
        
        if (!mobileToggle || !navbar) return;
        
        const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        
        mobileToggle.setAttribute('aria-expanded', newState.toString());
        mobileToggle.classList.toggle('active', newState);
        navbar.classList.toggle('mobile', newState);
        navbar.classList.toggle('active', newState);
        
        // Prevent body scroll when menu is open
        document.body.style.overflow = newState ? 'hidden' : '';
    }
    
    function closeMobileMenu() {
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const navbar = document.getElementById('navbar');
        
        if (!mobileToggle || !navbar) return;
        
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.classList.remove('active');
        navbar.classList.remove('mobile', 'active');
        document.body.style.overflow = '';
    }
    
    function setupScrollToTop() {
        const backToTopBtn = document.getElementById('back-to-top');
        if (!backToTopBtn) return;
        
        // Show/hide button based on scroll position
        function toggleBackToTop() {
            const scrollY = window.pageYOffset;
            const shouldShow = scrollY > 300;
            
            backToTopBtn.classList.toggle('visible', shouldShow);
        }
        
        let scrollTimeout;
        window.addEventListener('scroll', function() {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(toggleBackToTop, 10);
        });
        
        // Handle click
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Initial call
        toggleBackToTop();
    }
    
    function setupSmoothScrolling() {
        // Add smooth scrolling to all anchor links
        const anchorLinks = document.querySelectorAll('a[href^="#"]');
        
        anchorLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                if (href === '#') return;
                
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    e.preventDefault();
                    
                    const headerHeight = 80;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
    
    // Initialize AOS if available
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-out',
            once: true,
            offset: 100
        });
    }
    
})();
