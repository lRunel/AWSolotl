/**
 * OSBridge — Passive bridge between kernel events and environment reactions.
 * 
 * Reads OS state without modifying Shell, System, AppManager, or kernel code.
 * Dispatches subtle visual cues to the wallpaper environment.
 */
export class OSBridge {
  constructor() {
    this.listeners = {};
    this._lastProcessCount = 0;
    this._lastMemory = 0;
    this._booted = false;
    this._observeDOM();
    this._observeKernel();
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  _observeDOM() {
    // Watch for window creation/destruction
    const workspace = document.getElementById('workspace');
    if (workspace) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.classList && node.classList.contains('window')) {
              this._emit('window:open', {});
            }
          });
          m.removedNodes.forEach(node => {
            if (node.classList && node.classList.contains('window')) {
              this._emit('window:close', {});
            }
          });
        });
      });
      observer.observe(workspace, { childList: true });
    }

    // Watch for boot completion
    const checkBoot = setInterval(() => {
      if (typeof System !== 'undefined' && System.booted && !this._booted) {
        this._booted = true;
        this._emit('kernel:boot', {});
        clearInterval(checkBoot);
      }
    }, 500);
  }

  _observeKernel() {
    // Poll kernel state every 3s (same frequency as System.startLoops widget)
    setInterval(() => {
      if (typeof Shell === 'undefined' || !Shell.syscall) return;
      try {
        const stateData = Shell.read(1, '/kernel/state');
        if (stateData && stateData.data) {
          const text = stateData.data;
          // Parse running process count
          const runMatch = text.match(/running:\s*(\d+)/);
          const memMatch = text.match(/memory_used:\s*(\d+)/);
          if (runMatch) {
            const count = parseInt(runMatch[1]);
            if (count !== this._lastProcessCount) {
              this._emit('scheduler:heartbeat', { processes: count });
              this._lastProcessCount = count;
            }
          }
          if (memMatch) {
            const mem = parseInt(memMatch[1]);
            if (mem > this._lastMemory + 100) {
              this._emit('memory:spike', { used: mem });
            }
            this._lastMemory = mem;
          }
        }
      } catch (e) { /* silently ignore if kernel not ready */ }
    }, 3000);

    // Track terminal activity by watching for input events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const activeInput = document.querySelector('.window.active .term-input');
        if (activeInput && activeInput === document.activeElement) {
          this._emit('terminal:command', {});
        }
      }
    });
  }
}
