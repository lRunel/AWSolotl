/**
 * AIProcess.js — Rune-os AI Daemon (PID 4)
 * 
 * User-space process named "Cache" (the cat =^.^=).
 * Communicates with the C kernel through Shell syscalls.
 * Runs SmolLM2-135M-Instruct inference in a Web Worker.
 * Streams tokens back for real-time display.
 * 
 * Lifecycle:
 *   UNSTARTED → DOWNLOADING → READY
 */
const AIProcess = (() => {
    let _pid = null;
    let _state = 'UNSTARTED';
    let _worker = null;
    let _listeners = {};
    let _ready = false;
    let _currentStage = '';
    let _downloadProgress = { progress: 0, loaded: 0, total: 0 };

    const SYSTEM_PROMPT =
        'You are Cache, a helpful AI cat daemon inside Rune-os built by Shubham. ' +
        'Answer questions clearly and concisely based on your knowledge base. ' +
        'Keep answers very short. You can meow occasionally.';

    function _emit(event, data) {
        const handlers = _listeners[event];
        if (handlers) {
            handlers.forEach(fn => {
                try { fn(data); } catch (e) { console.error('[AI] listener error:', e); }
            });
        }
    }

    function _on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
    }

    function _off(event, fn) {
        if (_listeners[event]) {
            _listeners[event] = _listeners[event].filter(f => f !== fn);
        }
    }

    function _writeStatus(status) {
        try { Shell.write(_pid, '/ai/status', status); } catch (e) { }
    }

    function _setKernelState(stateName) {
        try { Shell.setstate(_pid, _pid, stateName); } catch (e) { }
    }

    function _initWorker() {
        // Mock instant initialization
        setTimeout(() => {
            _state = 'READY';
            _ready = true;
            _currentStage = 'ready';
            _writeStatus('ready');
            _setKernelState('running');
            _emit('ready', { pid: _pid });
        }, 100);
    }

    return {
        boot() {
            if (_state !== 'UNSTARTED') return;
            _state = 'SPAWNING';

            try {
                _pid = Shell.spawn('ai');
            } catch (e) {
                console.error('[AI] Failed to spawn:', e);
                return;
            }

            if (!_pid || _pid < 0) {
                console.error('[AI] Invalid PID:', _pid);
                return;
            }

            _setKernelState('initializing');
            _writeStatus('downloading');
            _initWorker();
        },

        /**
         * Query Cache. Returns a Promise that resolves when generation is done.
         * Subscribe to 'token' events for streaming.
         */
        query(prompt) {
            return new Promise((resolve) => {
                if (!_ready) {
                    resolve('Cache is still loading... try again in a moment.');
                    return;
                }

                let response = "";
                let matched = false;
                
                // Helper to reflect words
                const reflect = (str) => {
                    if (!str) return "";
                    // clean up punctuation from the captured string
                    str = str.replace(/[.?!]/g, '');
                    const words = str.toLowerCase().split(/\s+/);
                    const reflected = words.map(w => (window.ELIZA_REFLECTIONS && window.ELIZA_REFLECTIONS[w]) ? window.ELIZA_REFLECTIONS[w] : w);
                    return reflected.join(' ');
                };
                
                const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
                
                // 1. Try ELIZA rules
                if (window.ELIZA_RULES) {
                    for (const rule of ELIZA_RULES) {
                        const match = prompt.match(rule.pattern);
                        if (match) {
                            matched = true;
                            let template = random(rule.responses);
                            if (match[1]) {
                                const reflectedStr = reflect(match[1]);
                                template = template.replace('{0}', reflectedStr);
                            }
                            response = template;
                            break;
                        }
                    }
                }
                
                // 2. Fallback if no match
                if (!matched) {
                    const fallbackWrappers = [
                        "I'm sorry, I couldn't find specific details on that.",
                        "Hmm, that doesn't seem to match my current knowledge base.",
                        "I don't have an exact answer for that right now."
                    ];
                    const fallbackSuggestions = " But I can tell you about Rune-os, Shubham, or projects like the DL Framework and Arecanut disease detection. What would you like to know?";
                    response = `${random(fallbackWrappers)}${fallbackSuggestions}`;
                }

                // Simulate token streaming
                const tokens = response.split(' ');
                let currentIndex = 0;

                const streamInterval = setInterval(() => {
                    if (currentIndex < tokens.length) {
                        // Append space back since we split by space
                        _emit('token', { token: tokens[currentIndex] + ' ' });
                        currentIndex++;
                    } else {
                        clearInterval(streamInterval);
                        _emit('result', { text: response });
                        _emit('done', {});
                        resolve(response);
                    }
                }, 30); // 30ms per word simulates fast typing
            });
        },

        isReady() { return _ready; },
        getState() { return _state; },
        getStage() { return _currentStage; },
        getProgress() { return { ..._downloadProgress }; },
        getPid() { return _pid; },
        on: _on,
        off: _off
    };
})();

window.AIProcess = AIProcess;
