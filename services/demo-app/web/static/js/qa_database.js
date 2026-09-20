// qa_database.js — ELIZA-style Intent Rules and Reflections

window.ELIZA_REFLECTIONS = {
    "am": "are",
    "was": "were",
    "i": "you",
    "i'd": "you would",
    "i've": "you have",
    "i'll": "you will",
    "my": "your",
    "are": "am",
    "you've": "I have",
    "you'll": "I will",
    "your": "my",
    "yours": "mine",
    "you": "I",
    "me": "you"
};

window.ELIZA_RULES = [
    // 1. Core Identity & Creator (Shubham Chowta)
    {
        pattern: /(?:who is|about) (?:shubham|him|the creator|the dev)/i,
        responses: [
            "Shubham Chowta is a Systems Engineer specializing in distributed systems, ML infrastructure, and low-level engineering. He built Rune-os entirely from scratch to showcase his skills."
        ]
    },
    {
        pattern: /where (?:did|does) (?:shubham|he) (?:study|go to school|graduate)/i,
        responses: [
            "Shubham studied at the National Institute of Technology Karnataka (NITK)."
        ]
    },
    {
        pattern: /what (?:are|is) (?:his|shubham's) skills/i,
        responses: [
            "Shubham is skilled in C/C++, Rust, WebAssembly, Python, PyTorch, CUDA, and modern web technologies."
        ]
    },

    // 2. Rune-os (This website)
    {
        pattern: /(?:what is|about) (?:runeos|this website|this os)/i,
        responses: [
            "Rune-os is a browser-native operating system. It features a custom C kernel compiled to WebAssembly, a custom memory allocator, and a virtual filesystem—all running right here in your browser."
        ]
    },
    {
        pattern: /how (?:did|was) (?:he|shubham) (?:build|make) (?:this|runeos)/i,
        responses: [
            "Rune-os was built using C for the kernel (compiled to WebAssembly via Emscripten), vanilla JavaScript for the window manager and shell, and modern CSS for the dynamic visual environment."
        ]
    },
    {
        pattern: /(?:what is|about) the (?:wallpaper|background|scene|environment)/i,
        responses: [
            "The desktop environment is a multi-layered CSS scene orchestrated by a custom EnvironmentEngine. It syncs with the OS clock for day/night cycles and uses CSS 3D transforms for parallax."
        ]
    },

    // 3. Projects
    {
        pattern: /(?:what are|list|list out|tell me about) (?:the |your |shubham's )?projects/i,
        responses: [
            "Shubham has built several projects: the DL Framework (C/CUDA), Arecanut Disease Detection (CV/PyTorch), AR Shirt (WebAR), GEM (RL), and this browser-native OS. You can read about them in the Projects folder!"
        ]
    },
    {
        pattern: /(?:what is|about) (?:the )?(?:dl framework|dl_framework|deep learning framework)/i,
        responses: [
            "The DL Framework is an autodiff tensor library built from scratch in C with CUDA support, similar to PyTorch internals. It features custom forward/backward passes and optimized memory management."
        ]
    },
    {
        pattern: /(?:what is|about) (?:the )?(?:arecanut|disease detection)/i,
        responses: [
            "The Arecanut Disease Detection project uses advanced Computer Vision and deep learning to identify diseases in arecanut crops from aerial drone imagery, helping farmers catch outbreaks early."
        ]
    },
    {
        pattern: /(?:what is|about) (?:the )?(?:ar shirt|ar_shirt|augmented reality)/i,
        responses: [
            "The AR Shirt project is a physics-based cloth simulation running in augmented reality, designed for virtual try-ons with highly realistic collision detection."
        ]
    },
    {
        pattern: /(?:what is|about) (?:gem|general environment models)/i,
        responses: [
            "GEM (General Environment Models) is a reinforcement learning framework exploring highly generalized agents that can adapt to vastly different simulated environments."
        ]
    },
    // 4. Contact
    {
        pattern: /(?:contact|email|hire|reach) (?:shubham|him|you)/i,
        responses: [
            "You can contact Shubham by clicking the Contact (Mail) icon in the dock, or you can open the Resume app for his direct contact details."
        ]
    },

    // 5. ELIZA conversational patterns
    {
        pattern: /I need (.*)/i,
        responses: [
            "Why do you need {0}?",
            "Would it really help you to get {0}?",
            "Are you sure you need {0}?"
        ]
    },
    {
        pattern: /Why don'?t you (.*)/i,
        responses: [
            "Do you really believe I don't {0}?",
            "Perhaps I will {0} in good time.",
            "Should you {0} yourself?"
        ]
    },
    {
        pattern: /Why can'?t I (.*)/i,
        responses: [
            "Do you think you should be able to {0}?",
            "If you could {0}, what would you do?",
            "I don't know -- why can't you {0}?"
        ]
    },
    {
        pattern: /I can'?t (.*)/i,
        responses: [
            "How do you know you can't {0}?",
            "Perhaps you could {0} if you tried.",
            "What would it take for you to {0}?"
        ]
    },
    {
        pattern: /I am (.*)/i,
        responses: [
            "Did you come to me because you are {0}?",
            "How long have you been {0}?",
            "How do you feel about being {0}?"
        ]
    },
    {
        pattern: /I\'?m (.*)/i,
        responses: [
            "How does being {0} make you feel?",
            "Do you enjoy being {0}?",
            "Why do you tell me you're {0}?"
        ]
    },
    {
        pattern: /Are you (.*)/i,
        responses: [
            "Why does it matter whether I am {0}?",
            "Would you prefer it if I were not {0}?",
            "Perhaps you believe I am {0}."
        ]
    },
    {
        pattern: /What (.*)/i,
        responses: [
            "Why do you ask?",
            "How would an answer to that help you?",
            "What do you think?"
        ]
    },
    {
        pattern: /How (.*)/i,
        responses: [
            "How do you suppose?",
            "Perhaps you can answer your own question.",
            "What is it you're really asking?"
        ]
    },
    {
        pattern: /Because (.*)/i,
        responses: [
            "Is that the real reason?",
            "What other reasons come to mind?",
            "Does that reason apply to anything else?"
        ]
    },
    {
        pattern: /(.*) sorry (.*)/i,
        responses: [
            "There are many times when no apology is needed.",
            "What feelings do you have when you apologize?"
        ]
    },
    {
        pattern: /Hello(.*)/i,
        responses: [
            "Hello! I'm Cache, the AI assistant for Rune-os. You can ask me about Shubham's projects or just chat.",
            "Hi there! Welcome to Rune-os. What's on your mind?"
        ]
    },
    {
        pattern: /Hi(.*)/i,
        responses: [
            "Hi! I'm Cache. How can I help you explore Rune-os today?",
            "Hello! Welcome. Ask me anything about Shubham or his work."
        ]
    },
    {
        pattern: /I think (.*)/i,
        responses: [
            "Do you doubt {0}?",
            "Do you really think so?",
            "But you're not sure {0}?"
        ]
    },
    {
        pattern: /(.*) friend (.*)/i,
        responses: [
            "Tell me more about your friends.",
            "When you think of a friend, what comes to mind?",
            "Why don't you tell me about a childhood friend?"
        ]
    },
    {
        pattern: /Yes/i,
        responses: [
            "You seem quite sure.",
            "OK, but can you elaborate a bit?"
        ]
    },
    {
        pattern: /No/i,
        responses: [
            "Why not?",
            "You are being a bit negative.",
            "Are you saying no just to be negative?"
        ]
    },
    {
        pattern: /(.*) computer(.*)/i,
        responses: [
            "Are you really talking about me?",
            "Does it seem strange to talk to a computer?",
            "How do computers make you feel?"
        ]
    },
    {
        pattern: /Is it (.*)/i,
        responses: [
            "Do you think it is {0}?",
            "Perhaps it's {0} -- what do you think?",
            "If it were {0}, what would you do?"
        ]
    },
    {
        pattern: /It is (.*)/i,
        responses: [
            "You seem very certain.",
            "If I told you that it probably isn't {0}, what would you feel?"
        ]
    },
    {
        pattern: /Can you (.*)/i,
        responses: [
            "What makes you think I can't {0}?",
            "If I could {0}, then what?",
            "Why do you ask if I can {0}?"
        ]
    },
    {
        pattern: /Can I (.*)/i,
        responses: [
            "Perhaps you don't want to {0}.",
            "Do you want to be able to {0}?",
            "If you could {0}, would you?"
        ]
    },
    {
        pattern: /You are (.*)/i,
        responses: [
            "Why do you think I am {0}?",
            "Does it please you to think that I'm {0}?",
            "Perhaps you would like me to be {0}."
        ]
    },
    {
        pattern: /You\'?re (.*)/i,
        responses: [
            "Why do you say I am {0}?",
            "Why do you think I am {0}?",
            "Are we talking about you, or me?"
        ]
    },
    {
        pattern: /I don'?t (.*)/i,
        responses: [
            "Don't you really {0}?",
            "Why don't you {0}?",
            "Do you want to {0}?"
        ]
    },
    {
        pattern: /I feel (.*)/i,
        responses: [
            "Good, tell me more about these feelings.",
            "Do you often feel {0}?",
            "When do you usually feel {0}?",
            "When you feel {0}, what do you do?"
        ]
    },
    {
        pattern: /I have (.*)/i,
        responses: [
            "Why do you tell me that you've {0}?",
            "Have you really {0}?",
            "Now that you have {0}, what will you do next?"
        ]
    },
    {
        pattern: /I would (.*)/i,
        responses: [
            "Could you explain why you would {0}?",
            "Why would you {0}?",
            "Who else knows that you would {0}?"
        ]
    },
    {
        pattern: /Is there (.*)/i,
        responses: [
            "Do you think there is {0}?",
            "It's likely that there is {0}.",
            "Would you like there to be {0}?"
        ]
    },
    {
        pattern: /My (.*)/i,
        responses: [
            "I see, your {0}.",
            "Why do you say that your {0}?",
            "When your {0}, how do you feel?"
        ]
    },
    {
        pattern: /You (.*)/i,
        responses: [
            "We should be discussing you, not me.",
            "Why do you say that about me?",
            "Why do you care whether I {0}?"
        ]
    },
    {
        pattern: /Why (.*)/i,
        responses: [
            "Why don't you tell me the reason why {0}?",
            "Why do you think {0}?"
        ]
    },
    {
        pattern: /I want (.*)/i,
        responses: [
            "What would it mean to you if you got {0}?",
            "Why do you want {0}?",
            "What would you do if you got {0}?",
            "If you got {0}, then what would you do?"
        ]
    },
    {
        pattern: /(.*) mother(.*)/i,
        responses: [
            "Tell me more about your mother.",
            "What was your relationship with your mother like?",
            "How do you feel about your mother?",
            "How does this relate to your feelings today?",
            "Good family relations are important."
        ]
    },
    {
        pattern: /(.*) father(.*)/i,
        responses: [
            "Tell me more about your father.",
            "How did your father make you feel?",
            "How do you feel about your father?",
            "Does your relationship with your father relate to your feelings today?",
            "Do you have trouble showing affection with your family?"
        ]
    },
    {
        pattern: /(.*) child(.*)/i,
        responses: [
            "Did you have close friends as a child?",
            "What is your favorite childhood memory?",
            "Do you remember any dreams or nightmares from childhood?",
            "Did the other children sometimes tease you?",
            "How do you think your childhood experiences relate to your feelings today?"
        ]
    },
    {
        pattern: /(.*)\?/i,
        responses: [
            "I'm not entirely sure, but I can tell you about Shubham's projects and skills!",
            "Why do you ask? (I'm an AI assistant focused on Shubham's portfolio, so my general knowledge is limited!)",
            "That's an interesting question. Have you checked out the DL Framework or AR Shirt projects yet?"
        ]
    },
    {
        pattern: /(.*)/i,
        responses: [
            "I'm still learning! If you're looking for information about Shubham, try asking 'What are your skills?' or 'Tell me about your projects.'",
            "Could you rephrase that? Or you can ask me about the DL framework, Rune-os, or Shubham's background.",
            "Interesting. Speaking of which, have you checked out Shubham's resume yet?",
            "I'm an AI daemon built to guide you through this portfolio. What would you like to explore next?"
        ]
    }
];
