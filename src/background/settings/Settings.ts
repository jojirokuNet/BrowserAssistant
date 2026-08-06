/**
 * @file Settings store persisted to browser storage.
 */
import throttle from 'lodash/throttle';

import { SETTINGS } from '../../lib/types';
import type { Storage } from '../storage/storage';

const DEFAULT_SETTINGS = {
    [SETTINGS.CONTEXT_MENU_ENABLED]: true,
};

/**
 * Caches application settings and persists them to browser storage.
 */
export class Settings {
    /**
     * Storage key under which the settings are persisted.
     */
    STORAGE_KEY = 'settings';

    /**
     * In order to not call storage too often we throttle calls to it.
     */
    SAVE_TIMEOUT = 500;

    /**
     * Settings cache, assigned in init() from storage merged over defaults.
     */
    settings!: Record<string, any>;

    /**
     * Storage used to persist the settings.
     */
    storage: Storage;

    /**
     * Creates the settings service with the given storage.
     * @param storage Storage to persist the settings to.
     */
    constructor(storage: Storage) {
        this.storage = storage;
    }

    /**
     * Gets settings from storage and merges them with default settings.
     */
    async init() {
        const settingsFromStorage = await this.storage.get(this.STORAGE_KEY);

        this.settings = settingsFromStorage ?? DEFAULT_SETTINGS;
    }

    /**
     * Throttled writer that saves the settings to storage.
     */
    persist = throttle(async () => {
        await this.storage.set(this.STORAGE_KEY, this.settings);
    }, this.SAVE_TIMEOUT);

    /**
     * Updates the setting in the cache and schedules a throttled persist.
     * @param key Setting key.
     * @param value New setting value.
     */
    setSetting(key: string, value: any) {
        this.settings[key] = value;
        this.persist();
    }

    /**
     * Returns the current value of the setting.
     * @param key Setting key.
     * @returns The current setting value.
     */
    getSetting(key: string) {
        return this.settings[key];
    }

    /**
     * Checks whether the context menu is enabled in the settings.
     * @returns True if the context menu is enabled.
     */
    contextMenuEnabled() {
        return this.getSetting(SETTINGS.CONTEXT_MENU_ENABLED);
    }
}
