/* resume.c — HTML resume content embedded in the kernel */

/*
 * resume.c — HTML resume embedded in the kernel.
 * Served via wasm_get_resume_html() to the browser.
 */

const char *resume_html =
"<!DOCTYPE html>"
"<html lang=\"en\">"
"<head>"
"<meta charset=\"UTF-8\">"
"<style>"
"@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');"
"*{margin:0;padding:0;box-sizing:border-box}"
"body{"
"  font-family:'Inter',sans-serif;"
"  background:#1a1a1a;"
"  color:#e0e0e0;"
"  line-height:1.6;"
"  padding:32px;"
"  -webkit-font-smoothing:antialiased"
"}"
".resume{max-width:720px;margin:0 auto}"

/* Header */
".header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.1)}"
".header h1{font-size:28px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}"
".header .location{color:#888;font-size:13px;margin-bottom:10px}"
".header .contact{display:flex;justify-content:center;flex-wrap:wrap;gap:6px 16px;font-size:13px}"
".header .contact a{color:#6bb5ff;text-decoration:none;transition:color .2s}"
".header .contact a:hover{color:#9dd0ff;text-decoration:underline}"
".header .contact .sep{color:#555}"

/* Sections */
".section{margin-bottom:24px}"
".section-title{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#6bb5ff;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid rgba(107,181,255,0.2)}"

/* Education */
".edu-row{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap}"
".edu-row .school{font-weight:600;color:#fff;font-size:15px}"
".edu-row .year{color:#888;font-size:13px;font-family:'JetBrains Mono',monospace}"
".edu-degree{color:#bbb;font-size:14px;margin-top:2px}"

/* Skills */
".skills-grid{display:grid;gap:8px}"
".skill-row{font-size:14px}"
".skill-row .label{font-weight:600;color:#ccc}"
".skill-row .value{color:#aaa}"

/* Projects */
".project{margin-bottom:20px}"
".project:last-child{margin-bottom:0}"
".project-header{margin-bottom:4px}"
".project-title{font-weight:600;color:#fff;font-size:15px}"
".project-tag{font-size:12px;color:#f0a050;font-style:italic}"
".project-tech{font-size:13px;color:#888;font-style:italic;margin-bottom:6px}"
".project ul{padding-left:20px;list-style:none}"
".project ul li{font-size:13px;color:#bbb;margin-bottom:4px;position:relative;padding-left:12px}"
".project ul li::before{content:'\\25B8';position:absolute;left:0;color:#6bb5ff;font-size:11px}"
"code{font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-size:12px;color:#e0e0e0}"

/* Download */
".download-bar{text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06)}"
".download-bar a{display:inline-block;background:linear-gradient(135deg,#3584e4,#1a5fb4);color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;transition:transform .15s,box-shadow .15s;box-shadow:0 2px 8px rgba(53,132,228,0.3)}"
".download-bar a:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(53,132,228,0.4)}"
"</style>"
"</head>"
"<body>"
"<div class=\"resume\">"

/* Header */
"<div class=\"header\">"
"<h1>Shubham R Chowta</h1>"
"<div class=\"location\">Udupi, Karnataka</div>"
"<div class=\"contact\">"
"<span>+91 79750 06501</span>"
"<span class=\"sep\">|</span>"
"<a href=\"mailto:shubhamchout@gmail.com\">Email</a>"
"<span class=\"sep\">|</span>"
"<a href=\"https://github.com/lRunel\" target=\"_blank\">GitHub</a>"
"<span class=\"sep\">|</span>"
"<a href=\"https://www.linkedin.com/in/shubham-chowta-36aa1b292/\" target=\"_blank\">LinkedIn</a>"
"</div>"
"</div>"

/* Education */
"<div class=\"section\">"
"<div class=\"section-title\">Education</div>"
"<div class=\"edu-row\">"
"<span class=\"school\">Sahyadri College of Engineering &amp; Management</span>"
"<span class=\"year\">2023 &#8212; 2027</span>"
"</div>"
"<div class=\"edu-degree\">B.Tech in Computer Science &amp; Engineering (AI &amp; ML)</div>"
"</div>"

/* Skills */
"<div class=\"section\">"
"<div class=\"section-title\">Technical Skills</div>"
"<div class=\"skills-grid\">"
"<div class=\"skill-row\"><span class=\"label\">Languages:</span> <span class=\"value\">C, Python, Java</span></div>"
"<div class=\"skill-row\"><span class=\"label\">Core CS:</span> <span class=\"value\">Operating Systems, DBMS, Computer Networks</span></div>"
"<div class=\"skill-row\"><span class=\"label\">Systems / Backend:</span> <span class=\"value\">Syscalls, Virtual File Systems, REST APIs, Flask, Linux, WebAssembly</span></div>"
"<div class=\"skill-row\"><span class=\"label\">ML &amp; AI:</span> <span class=\"value\">PyTorch, TensorFlow, CNNs, TFLite, RAG (LlamaIndex), Vector Databases</span></div>"
"</div>"
"</div>"

/* Projects */
"<div class=\"section\">"
"<div class=\"section-title\">Projects</div>"

"<div class=\"project\">"
"<div class=\"project-header\">"
"<span class=\"project-title\">Opportunistic Distributed Deep Learning on Personal Devices</span>"
"<span class=\"project-tag\"> &#8212; Major Project (In Progress)</span>"
"</div>"
"<div class=\"project-tech\">Python, PyTorch, FastAPI</div>"
"<ul>"
"<li>Designing an asynchronous distributed training framework using a centralized controller and heterogeneous, unreliable workers</li>"
"<li>Decomposed training into time-bounded gradient computation tasks to leverage idle personal devices such as laptops and smartphones</li>"
"<li>Implementing staleness-aware gradient aggregation and adaptive batch sizing based on device throughput</li>"
"<li>Targeting wall-clock training speedup over single-device baselines under real-world execution constraints</li>"
"</ul>"
"</div>"

"<div class=\"project\">"
"<div class=\"project-header\">"
"<span class=\"project-title\">RuneOS &#8212; Browser-Based Experimental Operating System (Version 1)</span>"
"</div>"
"<div class=\"project-tech\">C, WebAssembly, JavaScript</div>"
"<ul>"
"<li>Implemented a monolithic kernel with syscall-style interfaces, process table, and cooperative round-robin scheduler</li>"
"<li>Built a tree-based virtual file system with directories, files, and pseudo filesystems such as <code>/proc</code> and <code>/kernel</code></li>"
"<li>Developed a shell and browser-based desktop UI layered strictly on kernel APIs</li>"
"</ul>"
"</div>"

"<div class=\"project\">"
"<div class=\"project-header\">"
"<span class=\"project-title\">Arecanut Disease Classification &amp; Edge ML and UAV Deployment</span>"
"</div>"
"<div class=\"project-tech\">Python, TensorFlow, TFLite, React Native</div>"
"<ul>"
"<li>Built and trained a CNN for arecanut disease classification using real-world agricultural imagery</li>"
"<li>Evaluated domain transfer on UAV-captured images, observing ~90% effective accuracy under distribution shift</li>"
"<li>Converted the TensorFlow model to TFLite and deployed inference via UAV pipeline and React Native app</li>"
"</ul>"
"</div>"

"<div class=\"project\">"
"<div class=\"project-header\">"
"<span class=\"project-title\">Agentic AI Assistant with Execution and RAG</span>"
"</div>"
"<div class=\"project-tech\">Python, LlamaIndex</div>"
"<ul>"
"<li>Designed a tool-using AI agent capable of writing and executing code for mathematical and technical tasks</li>"
"<li>Implemented scoped command execution, database operations, and persistent note storage</li>"
"<li>Integrated retrieval-augmented generation (RAG) using vector embeddings to ground responses in domain-specific knowledge</li>"
"</ul>"
"</div>"

"</div>"

/* Download */
"<div class=\"download-bar\">"
"<a href=\"assets/MBZUAI_Resume_Template-2.pdf\" download>&#11015; Download PDF</a>"
"</div>"

"</div>"
"</body>"
"</html>";

const char *get_resume_html(void) {
    return resume_html;
}
