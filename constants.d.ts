/**
 * Type declarations for ./constants.js. The root module intentionally
 * remains JavaScript as root-level tool configuration. With allowJs
 * removed, tsc resolves the `../constants` import in scripts/manifest.*.ts
 * through this file, while ts-node still loads constants.js at runtime.
 * Keep in sync with ./constants.js.
 * @file Type declarations for the ./constants.js module.
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
