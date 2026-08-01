// !IMPORTANT!
// export './ConsentAbstract' is replaced during webpack compilation
// with NormalModuleReplacementPlugin to proper browser implementation
// from './ConsentChrome' or './ConsentFirefox'
/**
 * Abstract consent class
 */
export default class ConsentAbstract {
    /**
     * Storage key present only on the Firefox implementation. Declared
     * (never emitted) so the Firefox-only path in MigrationService
     * type-checks against the build-time-substituted instance.
     */
    declare CONSENT_REQUIRED_STORAGE_KEY?: string;

    /**
     * Returns true if consent is required
     */
    async isConsentRequired(): Promise<boolean> {
        throw new Error('Not implemented');
    }

    /**
     * Sets consent value
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setConsentRequired(value: boolean): void {
        throw new Error('Not implemented');
    }
}
