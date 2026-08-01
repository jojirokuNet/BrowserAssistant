import ConsentAbstract from './ConsentAbstract';

/**
 * Manages user consent with policies
 */
export default class ConsentChrome extends ConsentAbstract {
    /**
     * Always returns false for chrome
     */
    async isConsentRequired(): Promise<boolean> {
        return false;
    }

    /**
     * Sets consent value
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setConsentRequired(value: boolean): void {
    }
}
