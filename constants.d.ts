/**
 * Type declarations for ./constants.js. The root module intentionally
 * remains JavaScript as root-level tool configuration; with allowJs
 * removed, tsc resolves the `import ... from '../constants'` in
 * scripts/manifest.*.ts through this file, while ts-node still loads
 * constants.js at runtime.
 * Keep in sync with ./constants.js.
 */
export declare const MIN_SUPPORTED_VERSION: {
    /** Same for Google Chrome and Microsoft Edge (Chromium-based). */
    CHROMIUM: number;

    FIREFOX: number;

    /**
     * No Opera-specific build; Opera 74 is equivalent to the supported
     * Chromium 88 (see ./constants.js for the full note).
     */
    OPERA: number;
};
