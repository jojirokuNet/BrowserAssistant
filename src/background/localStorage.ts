/**
 * @file No-op localStorage mock kept for the migration service.
 */
// TODO remove local storage because there is no localStorage in the service worker
// Make it after a few versions after 1.4 released

/**
 * Minimal subset of the Storage API the mock pretends to implement.
 */
interface StorageMock {
    setItem(key: string, data: string): unknown;
    getItem(key: string): unknown;
}

const localStorageMock: StorageMock = {
    // Zero-parameter bodies stay lint-clean (no unused params) while
    // remaining assignable to the interface signatures, exactly like
    // today's empty `setItem: () => {}` / `getItem: () => {}`.
    setItem: () => undefined,
    getItem: () => undefined,
};

/**
 * Wrapper around localStorage api
 * Used to set and get data from the storage.
 */
class LocalStorage {
    /**
     * In-memory storage mock wrapped by this class.
     */
    storage: StorageMock;

    /**
     * Creates the wrapper around the in-memory storage mock.
     */
    constructor() {
        this.storage = localStorageMock;
    }

    /**
     * Saves data in the storage by key.
     * @param key Key to save the data under.
     * @param data Data to save.
     * @returns Result of the storage operation.
     */
    set(key: string, data: string) {
        return this.storage.setItem(key, data);
    }

    /**
     * Returns data from the storage by key.
     * @param key Key to read the data by.
     * @returns Data stored under the key.
     */
    get(key: string) {
        return this.storage.getItem(key);
    }
}

export const localStorage = new LocalStorage();
