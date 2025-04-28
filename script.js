// Image Carousel Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize carousel
    const carousel = document.querySelector('.carousel');
    const slides = document.querySelectorAll('.carousel-slide');
    let currentIndex = 0;
    const slideCount = slides.length;
    const delay = 3000; // 3 seconds

    // Set initial slide positions
    function initializeSlides() {
        slides.forEach((slide, index) => {
            slide.style.transform = `translateX(${index * 100}%)`;
        });
    }

    // Rotate carousel automatically
    function rotateCarousel() {
        currentIndex = (currentIndex + 1) % slideCount;
        updateCarousel();
    }

    // Update carousel position
    function updateCarousel() {
        carousel.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    // Start with initialized slides
    initializeSlides();
    
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

    // Navigation controls (optional - uncomment if needed)
    /*
    const nextBtn = document.querySelector('.carousel-next');
    const prevBtn = document.querySelector('.carousel-prev');
    
    nextBtn.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % slideCount;
        updateCarousel();
    });
    
    prevBtn.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + slideCount) % slideCount;
        updateCarousel();
    });
    */
});

// Fix for the typo in your click event listener
document.addEventListener('click', (e) => {
    if (!e.target.matches('.menu-btn')) {
        document.querySelectorAll('.submenu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});
