import { describe, it } from 'vitest';
import { scenarios } from './scenarios.js';
describe('Pure engine contracts (dependency-injected counter; not BPE validation)', () => { for (const scenario of scenarios)
    it(scenario.name, scenario.run); });
