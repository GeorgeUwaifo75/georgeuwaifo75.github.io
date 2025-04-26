// Toggle submenus on button click
document.querySelectorAll('.menu-btn').forEach(button => {
    button.addEventListener('click', () => {
        const submenu = button.nextElementSibling;
        
        // Close all other open submenus
        document.querySelectorAll('.submenu').forEach(menu => {
            if (menu !== submenu) {
                menu.style.display = 'none';
            }
        });

        // Toggle current submenu
        if (submenu.style.display === 'block') {
            submenu.style.display = 'none';
        } else {
            submenu.style.display = 'block';
        }
    });
});

// Close submenus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.matches('.menu-btn')) {
        document.querySelectorAll('.submenu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

// Image Carousel Functionality
document.addEventListener('DOMContentLoaded', function() {
    const carousel = document.querySelector('.carousel');
    const slides = document.querySelectorAll('.carousel-slide');
    let currentIndex = 0;
    const slideCount = slides.length;
    const delay = 3000; // 3 seconds

    function rotateCarousel() {
        currentIndex = (currentIndex + 1) % slideCount;
        carousel.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    // Start auto-rotation
    let carouselInterval = setInterval(rotateCarousel, delay);

    // Pause on hover
    carousel.addEventListener('mouseenter', () => {
        clearInterval(carouselInterval);
    });

    // Resume on mouse leave
    carousel.addEventListener('mouseleave', () => {
        carouselInterval = setInterval(rotateCarousel, delay);
    });
});
