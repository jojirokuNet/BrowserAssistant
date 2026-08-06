/**
 * @file Chrome implementation of the consent manager.
 */
import ConsentAbstract from './ConsentAbstract';

/**
 * Manages user consent with policies.
 */
export default class ConsentChrome extends ConsentAbstract {
    /**
     * Always returns false for chrome.
     * @returns Whether the user consent is required.
     */
    async isConsentRequired(): Promise<boolean> {
        return false;
    }

    /**
     * Sets consent value. No-op for chrome.
     * @param value Consent value to set.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setConsentRequired(value: boolean): void {
    }
}
