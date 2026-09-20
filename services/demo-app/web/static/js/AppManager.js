// AppManager instances maps name to { win, pid }
const AppManager = {
    instances: {},

    launch: (appName, args = null) => {
        if (!System.booted) return;

        // Singleton Logic for main apps
        if (['terminal', 'projects', 'resume', 'settings', 'mail'].includes(appName) && AppManager.instances[appName]) {
            if (WindowManager.restoreMinimized(appName)) return;
            AppManager.focus(AppManager.instances[appName].win);
            return;
        }

        let pid;
        try {
            pid = Shell.spawn(appName);
        } catch (e) {
            console.error('[AppManager] Shell.spawn failed:', e);
            return;
        }
        if (!pid || pid < 0) {
            console.error('[AppManager] Invalid PID from spawn:', pid);
            return;
        }

        const win = document.createElement('article');
        win.className = 'window active';
        win.setAttribute('role', 'dialog');
        win.dataset.pid = pid;
        win.style.zIndex = ++System.zIndex;

        // Center first open, slight offset for subsequent
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            win.style.left = 'calc(50% - 340px)';
            win.style.top = 'calc(50% - 225px)';
        }

        // Title Mapping
        const titles = {
            'terminal': 'Terminal',
            'projects': 'Projects',
            'resume': 'Resume',
            'settings': 'Settings',
            'mail': 'Contact Me',
            'text-viewer': args?.filename || 'Text Viewer',
            'html-viewer': args?.title || 'Document Viewer'
        };

        // Window HTML
        win.innerHTML = `
            <div class="win-header">
                <span class="material-symbols-rounded back-btn">arrow_back</span>
                <span class="win-title">${titles[appName] || 'Window'}</span>
                <div class="win-controls">
                    <button class="win-btn minimize" aria-label="Minimize"><span class="material-symbols-rounded" style="font-size:16px">remove</span></button>
                    <button class="win-btn maximize" aria-label="Maximize"><span class="material-symbols-rounded" style="font-size:14px">check_box_outline_blank</span></button>
                    <button class="win-btn close" aria-label="Close"><span class="material-symbols-rounded" style="font-size:16px">close</span></button>
                </div>
            </div>
            <div class="win-content"></div>
        `;

        // Load Content
        const contentArea = win.querySelector('.win-content');
        if (appName === 'terminal') AppManager.renderTerminal(contentArea, pid);
        else if (appName === 'projects') AppManager.renderProjects(contentArea, pid);
        else if (appName === 'resume') AppManager.renderResume(contentArea, pid);
        else if (appName === 'settings') AppManager.renderSettings(contentArea, pid);
        else if (appName === 'mail') AppManager.renderMail(contentArea, pid);
        else if (appName === 'text-viewer') AppManager.renderTextViewer(contentArea, args, pid);
        else if (appName === 'html-viewer') AppManager.renderHtmlViewer(contentArea, args, pid);

        // Inject
        const container = isMobile ? document.getElementById('mobile-env') : document.getElementById('workspace');
        container.appendChild(win);

        // Add event listeners programmatically
        win.querySelector('.win-header').addEventListener('mousedown', (e) => WindowManager.startDrag(e, win.querySelector('.win-header')));
        win.querySelector('.back-btn').addEventListener('click', () => AppManager.close(win));
        win.querySelector('.minimize').addEventListener('click', (e) => WindowManager.toggleMinimize(e.currentTarget));
        win.querySelector('.maximize').addEventListener('click', (e) => WindowManager.toggleMaximize(e.currentTarget));
        win.querySelector('.close').addEventListener('click', () => AppManager.close(win));

        // Register (unless temporary util like text viewer)
        if (!args?.temp) {
            AppManager.instances[appName] = { win, pid };
            // Update Dock
            const dockItem = document.getElementById(`dock-${appName}`);
            if (dockItem) dockItem.classList.add('running');
        }

        // Auto-maximize on desktop (unless launching minimized or is terminal)
        if (!isMobile && !args?.minimized && appName !== 'terminal') {
            const maxBtn = win.querySelector('.maximize');
            if (maxBtn) WindowManager.toggleMaximize(maxBtn);
        }

        // Launch minimized if requested
        if (args?.minimized) {
            win.classList.add('minimized');
            win.classList.remove('active');
        }

        // Focus Listener
        win.onmousedown = () => AppManager.focus(win);
    },

    close: (btnOrName) => {
        let targetWin;

        if (typeof btnOrName === 'string') {
            targetWin = AppManager.instances[btnOrName]?.win;
        } else if (btnOrName instanceof HTMLElement) {
            targetWin = btnOrName.closest ? btnOrName.closest('.window') : btnOrName;
        } else {
            return;
        }

        if (!targetWin) return;

        const pid = parseInt(targetWin.dataset.pid);

        // Immediately unregister so app can be relaunched
        for (const [key, val] of Object.entries(AppManager.instances)) {
            if (val.win === targetWin) {
                delete AppManager.instances[key];
                const dockItem = document.getElementById(`dock-${key}`);
                if (dockItem) dockItem.classList.remove('running');
            }
        }

        // Kill process AFTER unregistering to avoid race conditions
        if (!isNaN(pid) && pid > 0) {
            try { Shell.exit(pid); } catch (e) { /* process may already be dead */ }
        }

        // Smooth close animation via CSS transition
        targetWin.style.transform = 'scale(0.92)';
        targetWin.style.opacity = '0';
        targetWin.style.pointerEvents = 'none';

        setTimeout(() => {
            if (targetWin.parentNode) targetWin.parentNode.removeChild(targetWin);
        }, 200);
    },

    focus: (win) => {
        document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
        win.classList.add('active');
        win.style.zIndex = ++System.zIndex;
    },

    /* APP RENDERERS */
    renderTerminal: (container, pid) => {
        const initCwd = Shell.getcwd(pid);
        container.innerHTML = `
            <div class="term-container" onclick="this.querySelector('input').focus()">
                <div class="term-output"></div>
                <div class="cat-prompt" style="color: #ffb86c; margin-top: 4px; display: none;">=^.^=</div>
                <div class="cmd-line" style="display: none;">
                    <span class="prompt" style="color: #ffb86c">rune:${initCwd.replace('/home', '~')}$</span>
                    <input class="term-input" type="text" autocomplete="off" spellcheck="false">
                </div>
            </div>
        `;
        const input = container.querySelector('input');
        const output = container.querySelector('.term-output');
        const termContainer = container.querySelector('.term-container');

        /* ── Helper: append styled AI line to terminal ── */
        const appendAI = (text, cssClass) => {
            const line = document.createElement('div');
            line.className = 'ai-msg ' + (cssClass || '');
            line.innerHTML = '<span class="ai-prefix">[AI]</span> <span class="ai-body">' + text + '</span>';
            output.appendChild(line);
            termContainer.scrollTop = termContainer.scrollHeight;
        };

        /* ── Helper: progress bar element (updated in-place) ── */
        let progressEl = null;

        const updateProgress = (data) => {
            const pct = Math.round(data.progress);
            const barWidth = 30;
            const filled = Math.round((pct / 100) * barWidth);
            const empty = barWidth - filled;
            const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

            const loadedMB = (data.loaded / (1024 * 1024)).toFixed(1);
            const totalMB = (data.total / (1024 * 1024)).toFixed(1);
            const sizeText = data.total > 0 ? '  ' + loadedMB + ' MB / ' + totalMB + ' MB' : '';

            if (!progressEl) {
                progressEl = document.createElement('div');
                progressEl.className = 'ai-msg ai-progress';
                output.appendChild(progressEl);
            }
            progressEl.innerHTML = '<span class="ai-progress-bar">[' + bar + '] ' + pct + '%' + sizeText + '</span>';
            termContainer.scrollTop = termContainer.scrollHeight;
        };

        const showIntro = () => {
            const intro = ` /\\_/\\
( o.o )
 > ^ <

Rune-os v1.0

Hi, I'm Shubham.

Rune-os started as an experiment to learn operating systems.
It eventually became my portfolio.

Type 'help' to begin.`;
            if (!output.innerText.includes('Rune-os v1.0')) {
                const currentText = output.innerText;
                output.innerText = intro + (currentText ? '\n\n' + currentText : '');
            }
            container.querySelector('.cat-prompt').style.display = 'block';
            container.querySelector('.cmd-line').style.display = 'flex';
            input.focus();
            termContainer.scrollTop = termContainer.scrollHeight;
        };

        /* ── Terminal Intro (Non-blocking) ── */
        showIntro();

        /* ── Subscribe to AI background events ── */
        if (window.AIProcess) {
            if (!window.AIProcess.isReady()) {
                AIProcess.on('message', (data) => {
                    if (data.type !== 'ready') {
                        progressEl = null;
                        appendAI(data.text, '');
                    }
                });

                AIProcess.on('progress', (data) => {
                    updateProgress(data);
                });

                AIProcess.on('ready', () => {
                    if (progressEl) {
                        progressEl.remove();
                        progressEl = null;
                    }
                    /* Remove temporary ai messages */
                    output.querySelectorAll('.ai-msg:not(.ai-response)').forEach(el => el.remove());
                });
            }
        }

        /* ── Terminal input handler ── */
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const val = input.value.trim();
                if (!val) return;

                const currentCwd = Shell.getcwd(pid);
                const displayCwd = currentCwd.replace('/home', '~');
                output.innerText += '\n=^.^=\nrune:' + displayCwd + '$ ' + val;

                // JS-only commands
                if (val === 'clear') {
                    output.innerHTML = '';
                    input.value = '';
                    return;
                }
                if (val === 'reboot') {
                    location.reload();
                    return;
                }

                // All other commands -> real C kernel via WASM
                const response = Shell.exec(pid, val);

                /* Handle AI queries asynchronously */
                if (response.data === 'AI_QUERY' && response._prompt) {
                    const thinkLine = document.createElement('div');
                    thinkLine.className = 'ai-msg ai-response';
                    thinkLine.innerHTML = '<span class="ai-prefix">=^.^=</span> <span class="ai-body ai-thinking-text">thinking...</span>';
                    output.appendChild(thinkLine);
                    input.value = '';
                    input.disabled = true;
                    termContainer.scrollTop = termContainer.scrollHeight;

                    let firstTokenReceived = false;

                    const tokenListener = (data) => {
                        if (!firstTokenReceived) {
                            firstTokenReceived = true;
                            thinkLine.querySelector('.ai-body').innerText = '';
                            thinkLine.querySelector('.ai-body').classList.remove('ai-thinking-text');
                        }
                        thinkLine.querySelector('.ai-body').innerText += data.token;
                        termContainer.scrollTop = termContainer.scrollHeight;
                    };

                    AIProcess.on('token', tokenListener);

                    AIProcess.query(response._prompt).then(answer => {
                        AIProcess.off('token', tokenListener);
                        if (!firstTokenReceived) {
                            thinkLine.querySelector('.ai-body').classList.remove('ai-thinking-text');
                            thinkLine.querySelector('.ai-body').innerText = answer;
                        }
                        input.disabled = false;
                        input.focus();
                        termContainer.scrollTop = termContainer.scrollHeight;
                    }).catch(() => {
                        AIProcess.off('token', tokenListener);
                        thinkLine.remove();
                        appendAI('*hisses at the error*', 'ai-error');
                        input.disabled = false;
                        input.focus();
                    });
                    return;
                }

                if (response.data) output.innerText += '\n' + response.data;

                // Update prompt
                const newCwd = Shell.getcwd(pid).replace('/home', '~');
                container.querySelector('.prompt').innerText = 'rune:' + newCwd + '$';
                input.value = '';
                termContainer.scrollTop = termContainer.scrollHeight;
            }
        };
    },

    renderProjects: (container, pid) => {
        container.innerHTML = `
            <div class="projects-container">
                <div class="project-card" onclick="window.open('projects/runeos/index.html', '_blank')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="project-title">Rune-os v1.0</div>
                    </div>
                    <div class="project-tags">
                        <span>C</span>
                        <span>WebAssembly</span>
                        <span>Vanilla JS</span>
                    </div>
                    <div class="project-desc">A portfolio that boots — a custom C kernel compiled to WebAssembly running a virtual filesystem and process scheduler in your browser.</div>
                </div>

                <div class="project-card" onclick="window.open('projects/dlframework/index.html', '_blank')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="project-title">DistLearn</div>
                        <div class="research-badge"><span class="material-symbols-rounded" style="font-size:12px">menu_book</span> Research Paper</div>
                    </div>
                    <div class="project-tags">
                        <span>Distributed Systems</span>
                        <span>PyTorch</span>
                        <span>FastAPI</span>
                    </div>
                    <div class="project-desc">Opportunistic distributed deep learning across heterogeneous idle devices (laptops, phones) with asynchronous SGD.</div>
                </div>

                <div class="project-card" onclick="window.open('projects/arecanut/index.html', '_blank')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="project-title">Arecanut Disease Detector</div>
                        <div class="research-badge"><span class="material-symbols-rounded" style="font-size:12px">menu_book</span> Research Paper</div>
                    </div>
                    <div class="project-tags">
                        <span>Computer Vision</span>
                        <span>TFLite</span>
                        <span>React Native</span>
                    </div>
                    <div class="project-desc">Mobile app and UAV pipeline for real-time arecanut disease detection using INT8-quantized CNNs.</div>
                </div>

                <div class="project-card" onclick="window.open('projects/arshirt/index.html', '_blank')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="project-title">ARWear</div>
                    </div>
                    <div class="project-tags">
                        <span>Computer Vision</span>
                        <span>MediaPipe</span>
                        <span>3D Rendering</span>
                    </div>
                    <div class="project-desc">Real-time 3D garment try-on using 33 pose landmarks to drive a mesh with thousands of vertices.</div>
                </div>

                <div class="project-card" onclick="window.open('projects/gem/index.html', '_blank')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="project-title">GEM</div>
                        <a href="https://github.com/lRunel/Gem" target="_blank" onclick="event.stopPropagation()" style="font-size:11px;color:#888;text-decoration:none;border:1px solid #333;padding:2px 8px;border-radius:4px;">GitHub ↗</a>
                    </div>
                    <div class="project-tags">
                        <span>Multi-Agent</span>
                        <span>Blackboard Architecture</span>
                        <span>RAG</span>
                        <span>Voice I/O</span>
                    </div>
                    <div class="project-desc">A 6-agent AI assistant with Blackboard Architecture — voice control, computer vision, and autonomous tool execution. Custom dispatch loop built before agent frameworks existed.</div>
                </div>
            </div>
        `;
    },

    renderResume: (container, pid) => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:#1a1a1a;';
        const out = Shell.read(pid, '/home/resume.html');
        iframe.srcdoc = out.data || '';
        container.appendChild(iframe);
    },

    renderTextViewer: (container, args, pid) => {
        const out = Shell.read(pid, `/home/${args.filename}`);
        container.innerHTML = `<div class="text-view-container">${out.data}</div>`;
    },

    renderHtmlViewer: (container, args, pid) => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:#0d0d0d;';
        if (args.vfsPath) {
            // Read project HTML from kernel VFS via syscall
            const out = Shell.read(pid, args.vfsPath);
            iframe.srcdoc = out.data || '<p style="color:#888;padding:32px">Failed to load from VFS</p>';
        } else if (args.src === '__KERNEL__') {
            const out = Shell.read(pid, '/home/resume.html');
            iframe.srcdoc = out.data || '';
        } else {
            iframe.src = args.src || 'about:blank';
        }
        container.appendChild(iframe);
    },

    renderSettings: (container, pid) => {
        const kernelInfo = 'v1.0.0 (WASM32-Shell)';
        const procInfo = Shell.ps(pid).data || 'No processes';
        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-section" style="margin-top:0">
                    <div class="profile-section-title">System</div>
                    <div class="profile-edu">
                        <div class="school">Rune-os v1.0</div>
                        <div class="degree">Kernel: Monolithic (C → WebAssembly)</div>
                        <div class="degree">Architecture: WASM32</div>
                        <div class="degree">Scheduler: Round-Robin Cooperative</div>
                    </div>
                </div>
                <div class="profile-section">
                    <div class="profile-section-title">Kernel Info</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#aaa;background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;white-space:pre-wrap;line-height:1.5">${kernelInfo}</div>
                </div>
                <div class="profile-section">
                    <div class="profile-section-title">Processes</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#aaa;background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;white-space:pre-wrap;line-height:1.5">${procInfo}</div>
                </div>
                <div class="profile-section">
                    <div class="profile-section-title">Filesystem</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#aaa;background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;white-space:pre-wrap;line-height:1.5">${Shell.ls(pid, '/').data || '/'}</div>
                </div>
            </div>
        `;
    },

    renderMail: (container, pid) => {
        container.innerHTML = `
            <div class="profile-card" style="text-align: center; padding: 40px 20px;">
                <span class="material-symbols-rounded" style="font-size: 48px; color: var(--accent-blue); margin-bottom: 16px;">mail</span>
                <div class="project-title" style="margin-bottom: 8px;">Get in Touch</div>
                <div class="project-desc" style="margin-bottom: 24px;">Have a question, want to collaborate, or just want to say hi? Send me a direct email.</div>
                <a href="mailto:shubhamchouta@gmail.com" style="display: inline-flex; align-items: center; gap: 8px; background: var(--accent-blue); color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; transition: opacity 0.2s;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">send</span>
                    Send Email
                </a>
            </div>
        `;
    }
};
