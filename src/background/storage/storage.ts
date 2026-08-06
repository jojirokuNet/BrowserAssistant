/**
 * @file Wraps browser.storage.local with a key-value interface.
 */
import browser from 'webextension-polyfill';

/**
 * Wraps browser.storage.local with a key-value get/set interface.
 */
export class Storage {
    /**
     * Browser storage instance wrapped by this class.
     */
    storage: typeof browser.storage.local;

    /**
     * Creates the storage wrapper around the given browser storage.
     * @param storage Browser storage instance to wrap.
     */
    constructor(storage: typeof browser.storage.local) {
        this.storage = storage;
    }

    /**
     * Stores the value under the given key.
     * @param key Storage key.
     * @param value Value to store.
     */
    async set(key: string, value: any) {
        await this.storage.set({ [key]: value });
    }

    /**
     * Returns the value stored under the given key.
     * @param key Storage key.
     * @returns The stored value.
     */
    async get(key: string) {
        const storedValue = await this.storage.get(key);
        return storedValue[key];
    }
}
