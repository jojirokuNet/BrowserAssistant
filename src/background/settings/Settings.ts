import throttle from 'lodash/throttle';

import { SETTINGS } from '../../lib/types';
import type { Storage } from '../storage/storage';

const DEFAULT_SETTINGS = {
    [SETTINGS.CONTEXT_MENU_ENABLED]: true,
};

export class Settings {
    STORAGE_KEY = 'settings';

    /**
     * In order to not call storage too often we throttle calls to it
     */
    SAVE_TIMEOUT = 500;

    /**
     * Settings cache, assigned in init() from storage merged over defaults
     */
    settings!: Record<string, any>;

    storage: Storage;

    constructor(storage: Storage) {
        this.storage = storage;
    }

    /**
     * Gets settings from storage and merges them with default settings
     */
    async init() {
        const settingsFromStorage = await this.storage.get(this.STORAGE_KEY);

        this.settings = settingsFromStorage ?? DEFAULT_SETTINGS;
    }

    persist = throttle(async () => {
        await this.storage.set(this.STORAGE_KEY, this.settings);
    }, this.SAVE_TIMEOUT);

    setSetting(key: string, value: any) {
        this.settings[key] = value;
        this.persist();
    }

    getSetting(key: string) {
        return this.settings[key];
    }

    contextMenuEnabled() {
        return this.getSetting(SETTINGS.CONTEXT_MENU_ENABLED);
    }
}
