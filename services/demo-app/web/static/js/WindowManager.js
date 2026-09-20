const WindowManager = {
            startDrag: (e, header) => {
                if (window.innerWidth <= 768) return;
                if (e.target.closest('button') || e.target.closest('.back-btn')) return;

                const win = header.parentElement;
                AppManager.focus(win);

                // If maximized, unmaximize on drag
                if (win.classList.contains('maximized')) return;

                let shiftX = e.clientX - win.getBoundingClientRect().left;
                let shiftY = e.clientY - win.getBoundingClientRect().top;

                const onMouseMove = (ev) => {
                    let left = ev.clientX - shiftX;
                    let top = ev.clientY - shiftY;

                    if (top < 32) top = 32;
                    if (top > window.innerHeight - 32) top = window.innerHeight - 32;

                    win.style.left = left + 'px';
                    win.style.top = top + 'px';
                };

                const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };
                
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            },

            toggleMaximize: (btn) => {
                const win = btn.closest('.window');
                if (!win) return;

                const icon = btn.querySelector('.material-symbols-rounded');

                if (win.classList.contains('maximized')) {
                    win.classList.remove('maximized');
                    win.style.left = win._prevLeft || '';
                    win.style.top = win._prevTop || '';
                    win.style.width = win._prevWidth || '';
                    win.style.height = win._prevHeight || '';
                    icon.textContent = 'check_box_outline_blank';
                } else {
                    win._prevLeft = win.style.left;
                    win._prevTop = win.style.top;
                    win._prevWidth = win.style.width;
                    win._prevHeight = win.style.height;
                    win.classList.add('maximized');
                    icon.textContent = 'filter_none';
                }
            },

            toggleMinimize: (btn) => {
                const win = btn.closest('.window');
                if (!win) return;
                win.classList.add('minimized');
                win.classList.remove('active');
            },

            restoreMinimized: (appName) => {
                const entry = AppManager.instances[appName];
                if (entry && entry.win && entry.win.classList.contains('minimized')) {
                    entry.win.classList.remove('minimized');
                    AppManager.focus(entry.win);
                    return true;
                }
                return false;
            }
        };
