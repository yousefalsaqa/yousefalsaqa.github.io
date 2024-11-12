// Initialize AOS (Animate on Scroll)
AOS.init();

// Scrollspy initialization for sidebar navigation
document.body.addEventListener('activate.bs.scrollspy', function () {
    const activeSection = document.querySelector('.nav-link.active');
    console.log('Active section:', activeSection.textContent);
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

document.addEventListener('DOMContentLoaded', function () {
    const burgerMenu = document.querySelector('.burger-menu');
    const navMenu = document.querySelector('.navmenu ul');
    
    // Initially hide the nav menu on mobile
    navMenu.style.display = 'none';
    
    // Toggle menu display on burger menu click
    burgerMenu.addEventListener('click', function () {
        if (navMenu.style.display === 'none') {
            navMenu.style.display = 'flex'; // Show menu
        } else {
            navMenu.style.display = 'none'; // Hide menu
        }
    });
});




