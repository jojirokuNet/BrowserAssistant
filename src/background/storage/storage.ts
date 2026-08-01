import browser from 'webextension-polyfill';

export class Storage {
    storage: typeof browser.storage.local;

    constructor(storage: typeof browser.storage.local) {
        this.storage = storage;
    }

    async set(key: string, value: any) {
        await this.storage.set({ [key]: value });
    }

    async get(key: string) {
        const storedValue = await this.storage.get(key);
        return storedValue[key];
    }
}
