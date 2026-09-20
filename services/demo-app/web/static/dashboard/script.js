document.addEventListener('DOMContentLoaded', () => {
    // Handle startup animation
    const overlay = document.getElementById('startup-overlay');
    const app = document.getElementById('app');

    // Simulate startup time then fade out overlay
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.backdropFilter = 'blur(0px)';
        
        // Show main app
        app.classList.remove('hidden');
        // Give a tiny delay before adding visible class to trigger transition
        setTimeout(() => {
            app.classList.add('visible');
            
            // Remove overlay from DOM after transition
            setTimeout(() => {
                overlay.remove();
            }, 800);
        }, 50);
        
    }, 3000); // 3 seconds for full animation sequence

    // Handle tab switching
    const navLinks = document.querySelectorAll('.nav-links li');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Remove active from all links and panes
            navLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Add active to clicked link
            link.classList.add('active');

            // Show corresponding pane
            const targetId = `tab-${link.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
        });
    });
});
