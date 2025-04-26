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
