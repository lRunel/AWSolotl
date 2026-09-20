const System = {
            booted: false,
            zIndex: 100,

            boot: () => {
                const log = document.getElementById('boot-log');
                const progress = document.getElementById('boot-progress');

                const addLog = (text, delay, pct) => setTimeout(() => {
                    const line = document.createElement('span');
                    line.textContent = text;
                    log.appendChild(line);
                    if (pct !== undefined) progress.style.width = pct + '%';
                }, delay);

                addLog('Booting Rune-os...', 300, 10);
                addLog('Loading kernel v1.0.0...', 900, 30);

                // Load WASM kernel, then continue boot
                KernelModule().then(mod => {
                    _wasmModule = mod;
                    const initFn = mod.cwrap('wasm_kernel_init', null, []);
                    Shell.init(mod);
                    initFn();

                    addLog('Mounting /home filesystem...', 200, 60);
                    addLog('Starting UI services...', 700, 85);
                    addLog('Ready.', 1200, 100);

                    setTimeout(() => {
                        document.getElementById('boot-screen').style.opacity = 0;
                        setTimeout(() => {
                            document.getElementById('boot-screen').style.display = 'none';
                            const env = document.getElementById('environment');
                            if (env) env.style.visibility = 'visible';
                            System.booted = true;
                            System.startLoops();
                            setTimeout(() => AppManager.launch('terminal'), 500);

                            /* Boot AI daemon after desktop is usable (idle time) */
                            if (window.requestIdleCallback) {
                                requestIdleCallback(() => {
                                    if (window.AIProcess) AIProcess.boot();
                                }, { timeout: 3000 });
                            } else {
                                setTimeout(() => {
                                    if (window.AIProcess) AIProcess.boot();
                                }, 2500);
                            }
                        }, 1000);
                    }, 1500);
                }).catch(err => {
                    addLog('[WARN] WASM load failed: ' + err, 400, 50);
                    addLog('Falling back to JS kernel stub...', 800, 80);
                    addLog('Ready.', 1200, 100);
                    setTimeout(() => {
                        document.getElementById('boot-screen').style.opacity = 0;
                        setTimeout(() => {
                            document.getElementById('boot-screen').style.display = 'none';
                            const env = document.getElementById('environment');
                            if (env) env.style.visibility = 'visible';
                            System.booted = true;
                            System.startLoops();
                            setTimeout(() => AppManager.launch('terminal'), 500);

                            /* Boot AI daemon after desktop is usable (idle time) */
                            if (window.requestIdleCallback) {
                                requestIdleCallback(() => {
                                    if (window.AIProcess) AIProcess.boot();
                                }, { timeout: 3000 });
                            } else {
                                setTimeout(() => {
                                    if (window.AIProcess) AIProcess.boot();
                                }, 2500);
                            }
                        }, 1000);
                    }, 1500);
                });
            },

            startLoops: () => {
                // Clock — updates both mobile status bar and desktop clock widget
                const updateClocks = () => {
                    const now = new Date();
                    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const mobileClock = document.getElementById('mobile-clock');
                    if (mobileClock) mobileClock.textContent = time;

                    // Desktop clock widget
                    const clockTime = document.getElementById('clock-time');
                    const clockDate = document.getElementById('clock-date');
                    const clockGreeting = document.getElementById('clock-greeting');
                    if (clockTime) clockTime.textContent = time;
                    if (clockDate) {
                        clockDate.textContent = now.toLocaleDateString([], {
                            weekday: 'long', month: 'long', day: 'numeric'
                        });
                    }
                    if (clockGreeting) {
                        const hour = now.getHours();
                        let greeting = '';
                        if (hour < 5) greeting = 'Burning the midnight oil';
                        else if (hour < 12) greeting = 'Good morning';
                        else if (hour < 17) greeting = 'Good afternoon';
                        else if (hour < 21) greeting = 'Good evening';
                        else greeting = 'Night owl mode';
                        clockGreeting.textContent = greeting;
                    }
                };
                updateClocks();
                setInterval(updateClocks, 1000);

                // Kernel Poll — real WASM kernel state
                const updateWidget = () => {
                    const out = Shell.read(1, '/kernel/state');
                    const raw = out.data || 'kernel: ok';
                    /* Parse kernel state for display */
                    const lines = raw.split('\n').filter(l => l.trim());
                    let display = '';
                    for (const line of lines) {
                        const [key, val] = line.split(':').map(s => s.trim());
                        if (key && val !== undefined) {
                            if (key === 'ai') {
                                const aiState = window.AIProcess ? window.AIProcess.getState() : val;
                                const aiStage = window.AIProcess ? window.AIProcess.getStage() : '';
                                let statusText = aiState.toLowerCase();
                                if (aiStage === 'downloading') {
                                    const p = window.AIProcess.getProgress();
                                    statusText = `downloading ${Math.round(p.progress)}%`;
                                } else if (aiStage === 'ready') {
                                    statusText = 'ready ✓';
                                }
                                display += `ai: ${statusText}\n`;
                            } else {
                                display += `${key}: ${val}\n`;
                            }
                        }
                    }
                    document.getElementById('sys-widget').innerText = display.trim();
                };
                updateWidget();
                setInterval(updateWidget, 3000);

                // Desktop UI Refresher connecting real-time to /home
                let lastDesktopState = "";
                setInterval(() => {
                    const lsData = Shell.ls(1, '/home').data;
                    if (lsData !== undefined && lsData !== lastDesktopState) {
                        lastDesktopState = lsData;
                        const items = lsData.split('\n').filter(i => i.trim() !== '');
                        
                        const ws = document.getElementById('workspace');
                        // clear existing file-icon-items but keep windows securely
                        ws.querySelectorAll('.file-icon-item').forEach(e => e.remove());
                        
                        let offset = 20;
                        for (const item of items) {
                            if (item === 'resume.html' || item === 'projects') continue; // Hide raw html and dock apps
                            const isFolder = !item.includes('.');
                            const iconStr = isFolder ? 'folder' : 'insert_drive_file';
                            const colorClass = isFolder ? 'color-folder' : 'color-file';
                            
                            const div = document.createElement('div');
                            div.className = 'file-icon-item desktop-item';
                            div.style.position = 'absolute';
                            div.style.top = offset + 'px';
                            div.style.right = '20px';
                            div.style.width = '80px';
                            div.style.cursor = 'pointer';
                            div.innerHTML = `
                                <span class="material-symbols-rounded f-icon ${colorClass}">${iconStr}</span>
                                <span class="f-name" style="color:white;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${item}</span>
                            `;
                            ws.appendChild(div);
                            offset += 100;
                        }
                    }
                }, 1000);

                // Dynamic Mobile Status Bar
                const updateMobileStatus = async () => {
                    const wifiIcon = document.querySelector('.mobile-status-right .material-symbols-rounded:nth-child(2)');
                    const batteryIcon = document.querySelector('.mobile-status-right .material-symbols-rounded:nth-child(3)');
                    
                    if (navigator.connection) {
                        if (!navigator.onLine) {
                            wifiIcon.textContent = 'wifi_off';
                        } else {
                            wifiIcon.textContent = 'wifi';
                        }
                    }
                    
                    if (navigator.getBattery) {
                        try {
                            const battery = await navigator.getBattery();
                            if (battery.charging) {
                                batteryIcon.textContent = 'battery_charging_full';
                            } else if (battery.level > 0.9) {
                                batteryIcon.textContent = 'battery_full';
                            } else if (battery.level > 0.6) {
                                batteryIcon.textContent = 'battery_5_bar';
                            } else if (battery.level > 0.3) {
                                batteryIcon.textContent = 'battery_3_bar';
                            } else {
                                batteryIcon.textContent = 'battery_1_bar';
                            }
                        } catch (e) {}
                    }
                };
                updateMobileStatus();
                setInterval(updateMobileStatus, 60000);
                window.addEventListener('online', updateMobileStatus);
                window.addEventListener('offline', updateMobileStatus);
            }
        };
