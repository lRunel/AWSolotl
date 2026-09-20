const Shell = {
    syscall: null,
    getOutput: null,

    SYS: { PING: 0, SPAWN: 1, EXIT: 2, REAP: 3, READ: 4, WRITE: 5, MKDIR: 6, LS: 7, TOUCH: 8, CHDIR: 9, GETCWD: 10, SETSTATE: 11 },

    init(module) {
        this.syscall = module.cwrap('wasm_syscall', 'number', ['number', 'number', 'string', 'string', 'number']);
        this.getOutput = module.cwrap('wasm_get_output', 'string', []);
    },

    spawn(name) {
        this.syscall(this.SYS.SPAWN, 1, '', name, 0); 
        const res = this.parseOutput();
        return res.status; 
    },

    exit(pid) {
        this.syscall(this.SYS.EXIT, pid, '', '', 0);
        this.syscall(this.SYS.REAP, 1, '', '', pid);
    },

    read(pid, path) { this.syscall(this.SYS.READ, pid, path, '', 0); return this.parseOutput(); },
    ls(pid, path) { this.syscall(this.SYS.LS, pid, path, '', 0); return this.parseOutput(); },
    write(pid, path, data) { this.syscall(this.SYS.WRITE, pid, path, data, 0); return this.parseOutput(); },
    mkdir(pid, path) { this.syscall(this.SYS.MKDIR, pid, path, '', 0); return this.parseOutput(); },
    touch(pid, path) { this.syscall(this.SYS.TOUCH, pid, path, '', 0); return this.parseOutput(); },
    chdir(pid, path) { this.syscall(this.SYS.CHDIR, pid, path, '', 0); return this.parseOutput(); },
    getcwd(pid) { this.syscall(this.SYS.GETCWD, pid, '', '', 0); return this.parseOutput().data; },
    ps(pid) { this.read(pid, '/proc/ps'); return this.parseOutput(); },
    setstate(callerPid, targetPid, state) { this.syscall(this.SYS.SETSTATE, callerPid, '', state, targetPid); return this.parseOutput(); },

    parseOutput() {
        const raw = this.getOutput();
        const sep = raw.indexOf('|');
        if (sep === -1) return { status: -1, data: raw };
        return { 
            status: parseInt(raw.substring(0, sep)), 
            data: raw.substring(sep + 1) 
        };
    },

    exec(pid, input) {
        const val = input.trim();
        if (!val) return { status: 0, data: '' };

        const parts = val.split(/\s+/);
        const cmd = parts[0];

        switch (cmd) {
            case 'ls':    return this.ls(pid, parts[1] || '.');
            case 'cd':    return parts[1] ? this.chdir(pid, parts[1]) : this.chdir(pid, '/home');
            case 'cat':   return parts[1] ? this.read(pid, parts[1]) : { status: -1, data: 'usage: cat <path>' };
            case 'mkdir': return parts[1] ? this.mkdir(pid, parts[1]) : { status: -1, data: 'usage: mkdir <path>' };
            case 'touch': return parts[1] ? this.touch(pid, parts[1]) : { status: -1, data: 'usage: touch <path>' };
            case 'pwd':   return { status: 0, data: this.getcwd(pid) };
            case 'ps':    return this.ps(pid);
            case 'echo':  return this.handleEcho(pid, val);
            case 'help':  {
                const subCmd = parts[1];
                if (subCmd === 'ai') return { status: 0, data: this.helpAIText() };
                return { status: 0, data: this.helpText() };
            }
            case 'clear': return { status: 0, data: 'CLEAR_TERMINAL' };
            case 'reboot':return { status: 0, data: 'REBOOT_SYSTEM' };

            /* AI commands — delegate to AIProcess */
            case 'cache': {
                if (!window.AIProcess || !window.AIProcess.isReady()) {
                    return { status: 0, data: '=^.^= Cache is still waking up... try again in a moment.' };
                }
                const prompt = val.replace(/^cache\s*/, '').replace(/^["']|["']$/g, '');
                if (!prompt) {
                    const state = window.AIProcess.getState();
                    return { status: 0, data: `=^.^= Cache the Cat — AI Daemon (PID ${window.AIProcess.getPid()})\nState: ${state}\nUsage: cache <your question or message>` };
                }
                return { status: 0, data: 'AI_QUERY', _prompt: prompt };
            }

            default:      return { status: -1, data: `bash: ${cmd}: command not found` };
        }
    },

    handleEcho(pid, input) {
        const match = input.match(/^echo\s+(.+?)\s*>\s*(.+)$/);
        if (!match) return { status: -1, data: 'usage: echo <text> > <path>' };
        return this.write(pid, match[2].trim(), match[1].trim());
    },

    helpText() {
        return 'Rune-os v1.0 — available commands:\n' +
               '  cd <path>          Change directory\n' +
               '  pwd                Print working directory\n' +
               '  ls [path]          List directory\n' +
               '  cat <path>         Read file\n' +
               '  echo <t> > <path>  Write to file\n' +
               '  mkdir <path>       Create directory\n' +
               '  touch <path>       Create empty file\n' +
               '  ps                 List processes\n' +
               '  clear              Clear terminal\n' +
               '  reboot             Reload page\n' +
               '\n  AI Commands:\n' +
               '  cache <message>    Ask or chat with Cache the AI cat\n' +
               '  help ai            AI-specific help\n';
    },

    helpAIText() {
        const ready = window.AIProcess ? window.AIProcess.isReady() : false;
        const state = window.AIProcess ? window.AIProcess.getState() : 'OFFLINE';
        const pid = window.AIProcess ? window.AIProcess.getPid() : '-';
        return '=^.^= Cache — Rune-os AI Daemon\n' +
               '───────────────────────────────\n' +
               `  PID:    ${pid}\n` +
               `  State:  ${state}\n` +
               `  Engine: Local knowledge base (120K+ Q&A pairs)\n` +
               `  Ready:  ${ready ? 'yes' : 'no'}\n` +
               '\n  Commands:\n' +
               '  cache <message>    Ask or chat with Cache\n' +
               '\n  Cache runs entirely in your browser.\n' +
               '  No data leaves this machine.\n';
    }
};

window.Shell = Shell;
