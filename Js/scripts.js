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





