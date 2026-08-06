/**
 * @file Firefox implementation of the consent manager.
 */
import { storage } from '../storage';

import ConsentAbstract from './ConsentAbstract';

/**
 * Manages user consent with policies.
 */
export default class ConsentFirefox extends ConsentAbstract {
    /**
     * Key used to store consent flag in the storage.
     */
    CONSENT_REQUIRED_STORAGE_KEY = 'consent.required';

    /**
     * Flag with consent required state.
     */
    consentRequired: boolean | null = null;

    /**
     * Checks whether user consent is required, loading it from storage on the first call.
     * @returns True when consent is required.
     */
    isConsentRequired = async (): Promise<boolean> => {
        if (this.consentRequired === null) {
            this.consentRequired = await this.getFromStorage();
        }
        return !!this.consentRequired;
    };

    /**
     * Stores whether consent is required in memory and in storage.
     * @param value Whether consent is required.
     */
    setConsentRequired = async (value: boolean): Promise<void> => {
        this.consentRequired = value;
        await storage.set(this.CONSENT_REQUIRED_STORAGE_KEY, value);
    };

    /**
     * Reads the consent flag from storage, falling back to false on error.
     * @returns The stored consent flag.
     */
    getFromStorage = async (): Promise<any> => {
        let result;
        try {
            result = await storage.get(this.CONSENT_REQUIRED_STORAGE_KEY);
        } catch (e) {
            result = false;
        }
        return result;
    };
}
