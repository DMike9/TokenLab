export type Encoding = 'o200k_base' | 'cl100k_base' | 'r50k_base';
export type Method = 'baseline' | 'minify' | 'deduplicate' | 'lexical' | 'stopwords' | 'importance' | 'similarity' | 'hybrid';
export type Transform = 'linear' | 'square' | 'sqrt' | 'log' | 'exp' | 'sigmoid' | 'softmax';
export interface Weights {
    relevance: number;
    information: number;
    instruction: number;
    entity: number;
    structure: number;
    redundancy: number;
}
export interface Settings {
    encoding: Encoding;
    budget: number;
    transform: Transform;
    cutoff: number;
    temperature: number;
    steepness: number;
    center: number;
    semanticFloor: number;
    redundancyThreshold: number;
    ngramSize: number;
    minimumRepetitions: number;
    protectedTerms: string[];
    weights: Weights;
    useEmbeddings: boolean;
}
export const DEFAULTS: Settings = {
    encoding: 'o200k_base', budget: 0.65, transform: 'linear', cutoff: 0.25, temperature: 0.25, steepness: 10, center: 0.5,
    semanticFloor: 0.95, redundancyThreshold: 1, ngramSize: 3, minimumRepetitions: 2, protectedTerms: [], useEmbeddings: false,
    weights: { relevance: 0.25, information: 0.25, instruction: 0.2, entity: 0.15, structure: 0.15, redundancy: 0.3 },
};
export interface Span {
    start: number;
    end: number;
    text: string;
    reason: string;
}
export interface Chunk {
    index: number;
    start: number;
    end: number;
    text: string;
    reasons: string[];
}
export interface Decision {
    index: number;
    text: string;
    originalScore: number;
    transformedScore: number;
    kept: boolean;
    protected: boolean;
    reason: string;
    tokens: number;
}
export interface Metrics {
    originalTokens: number;
    compressedTokens: number;
    savedTokens: number;
    savingsPercent: number;
    rate: number | null;
    factor: number | null;
    originalCharacters: number;
    compressedCharacters: number;
    removedCharacters: number;
    originalWords: number;
    compressedWords: number;
    removedWords: number;
    protectedTotal: number;
    protectedRetained: number;
    protectionRate: number | null;
}
export interface Similarity {
    cosine: number;
    dot: number;
    euclidean: number;
    manhattan: number;
    model: string;
    revision: string;
    dtype: string;
    originalChunks: number;
    compressedChunks: number;
    aggregation: string;
    elapsedMs: number;
}
export interface StrategyOutput {
    text: string;
    decisions: Decision[];
    notes: string[];
    budgetMet: boolean | null;
    attempts?: number;
}
export interface Stage {
    method: Method;
    beforeTokens: number;
    afterTokens: number;
    notes: string[];
}
export interface TokenInfo {
    id: number;
    index: number;
    text: string;
    partialUtf8: boolean;
}
export interface Run {
    id: string;
    timestamp: string;
    engineVersion: string;
    inputHash: string;
    outputHash: string;
    original: string;
    compressed: string;
    methods: Method[];
    settings: Settings;
    metrics: Metrics;
    similarity: Similarity | null;
    similarityError: string | null;
    decisions: Decision[];
    notes: string[];
    budgetMet: boolean | null;
    compressionMs: number;
    totalMs: number;
    stages: Stage[];
}
export type Count = (text: string) => number;
export type Embed = (text: string) => Promise<{
    vector: number[];
    chunks: number;
}>;
export interface Context {
    count: Count;
    settings: Settings;
    embed?: Embed;
    progress?: (message: string) => void;
}
export interface Strategy {
    id: Method;
    name: string;
    description: string;
    warning?: string;
    compress: (text: string, context: Context) => Promise<StrategyOutput>;
}
export const MAX_CHARACTERS = 60000;
