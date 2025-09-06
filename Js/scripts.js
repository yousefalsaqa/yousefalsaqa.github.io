// Initialize AOS (Animate on Scroll)
if (typeof AOS !== 'undefined') {
    AOS.init({
        duration: 800,
        easing: 'ease-out-cubic',
        once: true,
        offset: 100
    });
}

// Professional scroll animations
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe fade-in elements
    document.querySelectorAll('.fade-in-up').forEach(el => {
        observer.observe(el);
    });
}

// Initialize animations when DOM is loaded
document.addEventListener('DOMContentLoaded', initScrollAnimations);

// Scrollspy initialization for sidebar navigation
document.body.addEventListener('activate.bs.scrollspy', function () {
    const activeSection = document.querySelector('.nav-link.active');
    console.log('Active section:', activeSection.textContent);
});

// Get the navbar element
const navbar = document.getElementById('navbar-scrollspy');

// Add a scroll event listener to the window
window.addEventListener('scroll', () => {
    // Check the scroll position
    if (window.scrollY > 100) { // Adjust threshold as needed
        navbar.classList.add('visible');
        navbar.classList.remove('hidden');
    } else {
        navbar.classList.add('hidden');
        navbar.classList.remove('visible');
    }
});

// Select all navigation links and sections
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('#about, #projects, #experience, #footer');

// Add click handlers for smooth scrolling with proper offset
navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // Skip email links
        if (href.startsWith('mailto:')) return;
        
        // Handle section links
        if (href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = 80; // Account for fixed header
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// Function to remove 'active' class from all links
const removeActiveClasses = () => {
  navLinks.forEach((link) => link.classList.remove('active'));
};

// Function to add 'active' class to the current link
const activateNavLink = (id) => {
  removeActiveClasses();
  const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
};

// Use Intersection Observer API to observe each section
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        activateNavLink(entry.target.id);
      }
    });
  },
  {
    threshold: 0, // Trigger when section is at least 60% visible
  }
);

// Observe each section
sections.forEach((section) => {
  observer.observe(section);
});


// Project Navigation (can be used with modal or separate page)
function navigateToProject(projectId) {
    let projectDetails = {
        1: {
            title: "Autonomous Vehicle Design",
            description: "Developed a fully autonomous vehicle using ROS and machine learning.",
            technologies: "ROS, TensorFlow, Python"
        },
        2: {
            title: "Robotic Arm Design",
            description: "Designed and programmed a 6-DOF robotic arm using Python and C++.",
            technologies: "Python, C++, Control Algorithms"
        },
        3: {
            title: "AI Drone Navigation",
            description: "Implemented AI algorithms for drone navigation using computer vision.",
            technologies: "OpenCV, AI, Computer Vision"
        }
    };

    alert("Navigating to project: " + projectDetails[projectId].title + "\nDescription: " + projectDetails[projectId].description + "\nTechnologies: " + projectDetails[projectId].technologies);
}

document.addEventListener("DOMContentLoaded", () => {
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll("#navbar-scrollspy .nav-link");

    const updateActiveLink = () => {
        let activeSection = "";

        // Iterate through sections and find the one currently in the viewport
        sections.forEach((section) => {
            const rect = section.getBoundingClientRect();
            const sectionTop = rect.top;
            const sectionHeight = rect.height;

            // Check if the section is at least partially visible in the viewport
            if (sectionTop <= window.innerHeight / 2 && sectionTop + sectionHeight >= window.innerHeight / 2) {
                activeSection = section.getAttribute("id");
            }
        });

        // Update the active class on navigation links
        navLinks.forEach((link) => {
            link.classList.remove("active");
            if (link.getAttribute("href").includes(activeSection)) {
                link.classList.add("active");
            }
        });
    };

    // Listen for scroll events and update active link
    window.addEventListener("scroll", updateActiveLink);
});



// Show Back-to-Main button after scrolling down
window.addEventListener("scroll", function () {
    const backToMain = document.getElementById("back-to-main");
    if (window.scrollY > 100) { // Adjust scroll threshold as needed
        backToMain.style.display = "block"; // Show button
    } else {
        backToMain.style.display = "none"; // Hide button
    }
});





