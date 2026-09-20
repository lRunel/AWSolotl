/* ===== REAL WASM KERNEL ===== */
let _wasmModule = null;
document.addEventListener('DOMContentLoaded', () => {
    // Dock Listeners (click + keyboard)
    ['terminal', 'projects', 'resume', 'settings', 'mail'].forEach(app => {
        const dItem = document.getElementById(`dock-${app}`);
        if(dItem) {
            dItem.addEventListener('click', () => AppManager.launch(app));
            dItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); AppManager.launch(app); }
            });
        }
    });

    // Mobile Grid Listeners (click + keyboard)
    ['terminal', 'projects', 'resume', 'settings', 'mail'].forEach(app => {
        const mItem = document.getElementById(`mobile-${app}`);
        if(mItem) {
            mItem.addEventListener('click', () => AppManager.launch(app));
            mItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); AppManager.launch(app); }
            });
        }
    });

    // Handle Desktop items
    const workspace = document.getElementById('workspace');
    workspace.addEventListener('click', (e) => {
        const iconItem = e.target.closest('.file-icon-item');
        if (iconItem) {
            const fname = iconItem.querySelector('.f-name').textContent;
            if (fname === 'projects') {
                AppManager.launch('projects');
            } else if (fname.endsWith('.pdf')) {
                AppManager.launch('html-viewer', {title: fname, src: '__KERNEL__', temp: true});
            } else {
                AppManager.launch('text-viewer', {filename: fname, temp: true});
            }
        }
    });

    // Start System
    System.boot();
});
