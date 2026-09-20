/**
 * ai-worker.js — RuneOS AI Inference Worker
 * 
 * Runs RWKV-4-Pile-169M via ONNX Runtime Web in a Web Worker.
 * Uses transformers.js for tokenization and embeddings (RAG).
 * Streams tokens back to the main thread as they are generated.
 * 
 * RWKV is a recurrent architecture — inference is token-by-token
 * with hidden state carried between steps (no KV cache).
 * 
 * Protocol:
 *   Main → Worker: { type: 'init', vectorsData }
 *   Main → Worker: { type: 'generate', prompt, maxTokens, systemPrompt }
 *   Worker → Main: { type: 'progress', progress, loaded, total }
 *   Worker → Main: { type: 'ready' }
 *   Worker → Main: { type: 'token', token }           — streaming token
 *   Worker → Main: { type: 'done' }                   — generation finished
 *   Worker → Main: { type: 'error', error }
 */

/* ── RWKV-4-169M architecture constants ── */
const N_LAYER = 12;
const N_EMBD  = 768;
const CTX_LEN = 1024;

/* ── State ── */
let ort = null;
let session = null;
let tokenizer = null;
let featureExtractor = null;
let vectorDB = [];

self.onmessage = async function (e) {
    const { type } = e.data;

    if (type === 'init') {
        await initModel(e.data.vectorsData);
    } else if (type === 'generate') {
        await generate(e.data.prompt, e.data.maxTokens || 200, e.data.systemPrompt || '');
    }
};

/* ── Sampling utilities ── */

function softmax(logits) {
    let max = -Infinity;
    for (let i = 0; i < logits.length; i++) {
        if (logits[i] > max) max = logits[i];
    }
    const exps = new Float32Array(logits.length);
    let sum = 0;
    for (let i = 0; i < logits.length; i++) {
        exps[i] = Math.exp(logits[i] - max);
        sum += exps[i];
    }
    for (let i = 0; i < exps.length; i++) {
        exps[i] /= sum;
    }
    return exps;
}

function sampleTopP(logits, temperature = 0.85, topP = 0.8) {
    // Apply temperature
    if (temperature !== 1.0) {
        for (let i = 0; i < logits.length; i++) {
            logits[i] /= temperature;
        }
    }

    const probs = softmax(logits);

    // Sort indices by probability descending
    const indices = Array.from({ length: probs.length }, (_, i) => i);
    indices.sort((a, b) => probs[b] - probs[a]);

    // Find cutoff for top-p
    let cumulative = 0;
    let cutoffIdx = indices.length;
    for (let i = 0; i < indices.length; i++) {
        cumulative += probs[indices[i]];
        if (cumulative > topP) {
            cutoffIdx = i + 1;
            break;
        }
    }

    // Zero out everything below cutoff
    const filtered = new Float32Array(probs.length);
    let filteredSum = 0;
    for (let i = 0; i < cutoffIdx; i++) {
        filtered[indices[i]] = probs[indices[i]];
        filteredSum += probs[indices[i]];
    }

    // Renormalize
    for (let i = 0; i < filtered.length; i++) {
        filtered[i] /= filteredSum;
    }

    // Sample from distribution
    let r = Math.random();
    for (let i = 0; i < filtered.length; i++) {
        r -= filtered[i];
        if (r <= 0) return i;
    }
    return indices[0]; // fallback
}

function padLeftWithZeros(arr, size) {
    const result = new Int32Array(size);
    const offset = size - arr.length;
    for (let i = 0; i < arr.length; i++) {
        result[offset + i] = arr[i];
    }
    return result;
}

/* ── Model initialization ── */

async function initModel(vectorsJsonString) {
    try {
        /* ── Load ONNX Runtime Web ── */
        self.postMessage({ type: 'progress', progress: 5, loaded: 0, total: 1 });

        // Import ONNX Runtime Web
        importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js');
        ort = self.ort;

        // Configure ONNX Runtime
        ort.env.wasm.proxy = false; // We're already in a worker
        if (self.crossOriginIsolated) {
            ort.env.wasm.numThreads = Math.max(1, Math.floor(navigator.hardwareConcurrency / 2));
        }

        /* ── Load transformers.js for tokenizer + embeddings ── */
        const transformers = await import(
            'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.1'
        );
        const { AutoTokenizer, pipeline, env } = transformers;

        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.useBrowserCache = true;

        /* ── Parse Vector DB ── */
        if (vectorsJsonString) {
            try {
                vectorDB = JSON.parse(vectorsJsonString);
                console.log('[AI Worker] Loaded Vector DB:', vectorDB.length, 'chunks');
            } catch (e) {
                console.warn('[AI Worker] Failed to parse vectors data', e);
            }
        }

        /* ── Load RWKV tokenizer ── */
        self.postMessage({ type: 'progress', progress: 15, loaded: 0, total: 1 });
        console.log('[AI Worker] Loading RWKV tokenizer...');

        const rwkvModelId = '/assets/models/RWKV/rwkv-4-169m-pile';
        tokenizer = await AutoTokenizer.from_pretrained(rwkvModelId);
        console.log('[AI Worker] Tokenizer loaded');

        /* ── Load RWKV ONNX session ── */
        self.postMessage({ type: 'progress', progress: 25, loaded: 0, total: 1 });
        console.log('[AI Worker] Loading RWKV ONNX model...');

        const modelUrl = '/assets/models/RWKV/rwkv-4-169m-pile/169m/rwkv-4-pile-169m.onnx';

        // Fetch with progress tracking
        const response = await fetch(modelUrl);
        if (!response.ok) throw new Error(`Failed to fetch model: ${response.status}`);

        const contentLength = parseInt(response.headers.get('content-length') || '0');
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;

            const progress = contentLength > 0
                ? 25 + (loaded / contentLength) * 55
                : 50;
            self.postMessage({
                type: 'progress',
                progress: Math.min(progress, 80),
                loaded: loaded,
                total: contentLength
            });
        }

        // Combine chunks into a single ArrayBuffer
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const modelData = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            modelData.set(chunk, offset);
            offset += chunk.length;
        }

        console.log('[AI Worker] Model downloaded, creating ONNX session...');
        self.postMessage({ type: 'progress', progress: 85, loaded: loaded, total: contentLength });

        // Create ONNX session from buffer
        session = await ort.InferenceSession.create(modelData.buffer, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        });

        console.log('[AI Worker] ONNX session created');
        console.log('[AI Worker] Input names:', session.inputNames);
        console.log('[AI Worker] Output names:', session.outputNames);

        /* ── Load Feature Extractor for RAG ── */
        self.postMessage({ type: 'progress', progress: 90, loaded: 0, total: 1 });
        const embedModelId = '/assets/models/Xenova/all-MiniLM-L6-v2';
        try {
            featureExtractor = await pipeline('feature-extraction', embedModelId, {
                dtype: 'fp32',
                device: 'wasm'
            });
            console.log('[AI Worker] Feature extractor loaded');
        } catch (e) {
            console.warn('[AI Worker] Feature extractor failed to load:', e);
        }

        /* ── Warm up with a single token ── */
        self.postMessage({ type: 'progress', progress: 95, loaded: 0, total: 1 });
        try {
            await runRWKVToken(0, createInitialState());
            console.log('[AI Worker] Warm-up complete');
        } catch (e) {
            console.warn('[AI Worker] Warm-up failed:', e);
        }

        self.postMessage({ type: 'progress', progress: 100, loaded: 1, total: 1 });
        self.postMessage({ type: 'ready' });

    } catch (err) {
        console.error('[AI Worker] Init error:', err);
        self.postMessage({ type: 'error', error: err.message || String(err) });
    }
}

/* ── RWKV state management ── */

function createInitialState() {
    const xx_att_d = new Float32Array(N_LAYER * N_EMBD);
    const aa_att_d = new Float32Array(N_LAYER * N_EMBD);
    const bb_att_d = new Float32Array(N_LAYER * N_EMBD);
    const pp_att_d = new Float32Array(N_LAYER * N_EMBD).fill(-1e30);
    const xx_ffn_d = new Float32Array(N_LAYER * N_EMBD);

    return {
        xx_att: new ort.Tensor('float32', xx_att_d, [N_LAYER, N_EMBD]),
        aa_att: new ort.Tensor('float32', aa_att_d, [N_LAYER, N_EMBD]),
        bb_att: new ort.Tensor('float32', bb_att_d, [N_LAYER, N_EMBD]),
        pp_att: new ort.Tensor('float32', pp_att_d, [N_LAYER, N_EMBD]),
        xx_ffn: new ort.Tensor('float32', xx_ffn_d, [N_LAYER, N_EMBD]),
    };
}

async function runRWKVToken(tokenId, state) {
    // Pad context to CTX_LEN with zeros on the left, token at the end
    const idx_d = new Int32Array(CTX_LEN);
    idx_d[CTX_LEN - 1] = tokenId;
    const idx = new ort.Tensor('int32', idx_d, [CTX_LEN]);

    const feeds = {
        idx: idx,
        xx_att: state.xx_att,
        aa_att: state.aa_att,
        bb_att: state.bb_att,
        pp_att: state.pp_att,
        xx_ffn: state.xx_ffn,
    };

    const results = await session.run(feeds);

    return {
        logits: results.x,  // output logits
        state: {
            xx_att: results.xx_att_r,
            aa_att: results.aa_att_r,
            bb_att: results.bb_att_r,
            pp_att: results.pp_att_r,
            xx_ffn: results.xx_ffn_r,
        }
    };
}

/* ── Text generation ── */

async function generate(prompt, maxTokens, systemPrompt) {
    if (!session || !tokenizer) {
        self.postMessage({ type: 'error', error: 'Model not loaded' });
        return;
    }

    try {
        console.log('[AI Worker] Generate called:', prompt.slice(0, 50));
        let augmentedPrompt = prompt;

        // Perform RAG if Vector DB exists
        if (vectorDB.length > 0 && featureExtractor) {
            try {
                console.log('[AI Worker] Running RAG lookup...');
                const output = await featureExtractor(prompt, { pooling: 'mean', normalize: true });
                const promptEmbedding = Array.from(output.data);

                const similarities = vectorDB.map(v => {
                    let dotProduct = 0;
                    for (let i = 0; i < promptEmbedding.length; i++) {
                        dotProduct += promptEmbedding[i] * v.embedding[i];
                    }
                    return { text: v.text, score: dotProduct };
                });

                similarities.sort((a, b) => b.score - a.score);
                const topChunks = similarities.slice(0, 3).map(s => s.text).join('\n\n');
                augmentedPrompt = topChunks + '\n\n' + prompt;
                console.log('[AI Worker] RAG complete, context added');
            } catch (e) {
                console.warn('[AI Worker] RAG search failed', e);
            }
        }

        // Format as a simple instruction prompt for RWKV
        // RWKV-4-Pile responds well to plain text prompts
        const fullPrompt = systemPrompt
            ? `${systemPrompt}\n\nUser: ${augmentedPrompt}\n\nAssistant:`
            : `User: ${augmentedPrompt}\n\nAssistant:`;

        // Tokenize the prompt
        const encoded = await tokenizer(fullPrompt, { add_special_tokens: false });
        const promptTokens = Array.from(encoded.input_ids.data);
        console.log('[AI Worker] Prompt tokens:', promptTokens.length);

        // Initialize RWKV state
        let state = createInitialState();
        let lastLogits = null;

        // Process prompt tokens (prefill phase)
        for (let i = 0; i < promptTokens.length; i++) {
            const result = await runRWKVToken(promptTokens[i], state);
            state = result.state;
            lastLogits = result.logits;
        }

        // Generate new tokens
        let generatedTokens = [];
        const endTokens = new Set([0, 1]); // EOS / padding tokens

        for (let i = 0; i < maxTokens; i++) {
            if (!lastLogits) break;

            // Sample next token from logits
            const logitsData = Array.from(lastLogits.data);
            const nextToken = sampleTopP(logitsData, 0.85, 0.8);

            // Check for end tokens or common stop sequences
            if (endTokens.has(nextToken)) break;

            generatedTokens.push(nextToken);

            // Decode and stream the new token
            const tokenText = tokenizer.decode([nextToken], { skip_special_tokens: true });

            // Stop on "User:" or double newlines (conversation boundary)
            const fullDecoded = tokenizer.decode(generatedTokens, { skip_special_tokens: true });
            if (fullDecoded.includes('\nUser:') || fullDecoded.includes('\n\nUser')) {
                // Remove the "User:" part from output
                const cleanText = fullDecoded.split('\nUser:')[0].split('\n\nUser')[0];
                // We've already been streaming, so just break
                break;
            }

            if (tokenText) {
                self.postMessage({ type: 'token', token: tokenText });
            }

            // Run next step
            const result = await runRWKVToken(nextToken, state);
            state = result.state;
            lastLogits = result.logits;
        }

        // Send final result
        const responseText = tokenizer.decode(generatedTokens, { skip_special_tokens: true })
            .split('\nUser:')[0]
            .split('\n\nUser')[0]
            .trim();

        self.postMessage({ type: 'result', text: responseText });
        self.postMessage({ type: 'done' });

    } catch (err) {
        console.error('[AI Worker] Generate error:', err);
        self.postMessage({ type: 'error', error: err.message || String(err) });
    }
}
