/**
 * @file Vitest configuration for the unit test suites.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // The suites exercise logic and JSON locale data only;
        // no DOM is required.
        environment: 'node',
        // Discover the TypeScript suites under tests/.
        include: ['tests/**/*.test.ts'],
    },
});
