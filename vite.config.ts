import { defineConfig } from 'vite';
export default defineConfig({
    base: './',
    // Worker-only lazy imports otherwise trigger a first-use optimizer reload and erase the session.
    optimizeDeps: { include: ['gpt-tokenizer/encoding/o200k_base', 'gpt-tokenizer/encoding/cl100k_base', 'gpt-tokenizer/encoding/r50k_base', '@huggingface/transformers'] },
    server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } } },
    preview: { port: 4173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } } },
    worker: { format: 'es' },
    build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
