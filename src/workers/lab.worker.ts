import type { Method, Settings, StudyKind } from '../engine/types.js';
import { MAX_CHARACTERS } from '../engine/types.js';
import { inspectTokens, getTokenizer } from '../tokenizer/index.js';
import { protectedSpans } from '../engine/protection.js';
import { calculateMetrics } from '../engine/metrics.js';
import { runExperiment } from '../engine/runner.js';
import { runStudy } from '../engine/studies.js';
import { initializeEmbeddings, clearEmbeddingTextCache } from '../similarity/embedding.js';
interface Request {
    id: number;
    action: 'analyze' | 'run' | 'study' | 'embeddings' | 'clear';
    studyKind?: StudyKind;
    text?: string;
    methods?: Method[];
    settings: Settings;
}
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<Request>) => {
    const request = event.data;
    queue = queue.then(async () => {
        const { id, action, settings, text = '' } = request;
        const progress = (message: string) => self.postMessage({ id, progress: message });
        try {
            if (text.length > MAX_CHARACTERS)
                throw new Error(`Maximum input length is ${MAX_CHARACTERS.toLocaleString()} UTF-16 code units.`);
            let result: unknown;
            if (action === 'embeddings') {
                await initializeEmbeddings(progress);
                result = true;
            }
            else if (action === 'clear') {
                clearEmbeddingTextCache();
                result = true;
            }
            else if (action === 'analyze') {
                progress('Loading the selected BPE encoding…');
                const tokenizer = await getTokenizer(settings.encoding);
                result = { input: text, encoding: settings.encoding, protectedTerms: [...settings.protectedTerms], ...inspectTokens(text, tokenizer), metrics: calculateMetrics(text, text, tokenizer.count, settings.protectedTerms), protection: protectedSpans(text, settings.protectedTerms) };
            }
            else if (action === 'study')
                result = await runStudy(text, request.studyKind!, settings, runExperiment, progress);
            else
                result = await runExperiment(text, request.methods ?? ['baseline'], settings, progress);
            self.postMessage({ id, result });
        }
        catch (error) {
            self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
        }
    });
};
