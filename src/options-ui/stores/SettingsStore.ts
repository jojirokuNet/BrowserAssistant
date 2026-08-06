/**
 * @file Settings store of the options page.
 */
import {
    action,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';
import browser from 'webextension-polyfill';

import { OPTIONS_UI_MESSAGES, SETTINGS } from '../../lib/types';

import type { OptionsUiStore } from './index';

/**
 * MobX store of the options page settings.
 */
export class SettingsStore {
    /**
     * Root store of the options page.
     */
    rootStore: OptionsUiStore;

    /**
     * Whether the context menu is enabled.
     */
    contextEnabled = true;

    /**
     * Whether the settings were received from the background page.
     */
    settingsReceived = false;

    /**
     * Creates the settings store of the options page.
     * @param rootStore Root store of the options page.
     */
    constructor(rootStore: OptionsUiStore) {
        makeObservable(this, {
            contextEnabled: observable,
            settingsReceived: observable,
            getSettings: action,
            setContextMenuState: action,
            getSetting: action,
            setSetting: action,
        });
        this.rootStore = rootStore;
    }

    /**
     * Loads the current settings from the background and updates the store.
     */
    async getSettings(): Promise<void> {
        this.settingsReceived = false;
        const contextEnabled = await this.getSetting(SETTINGS.CONTEXT_MENU_ENABLED);
        runInAction(() => {
            this.settingsReceived = true;
            this.contextEnabled = contextEnabled;
        });
    }

    /**
     * Updates the context menu setting in the background and in the store.
     * @param state Whether the context menu is enabled.
     */
    async setContextMenuState(state: boolean): Promise<void> {
        await this.setSetting(SETTINGS.CONTEXT_MENU_ENABLED, state);
        runInAction(() => {
            this.contextEnabled = state;
        });
    }

    /**
     * Requests the current value of the setting from the background page.
     * @param key Setting key.
     * @returns Promise resolved with the current setting value.
     */
    async getSetting(key: string): Promise<any> {
        return browser.runtime.sendMessage({
            type: OPTIONS_UI_MESSAGES.GET_SETTING,
            data: {
                key,
            },
        });
    }

    /**
     * Sends the new setting value to the background page.
     * @param key Setting key.
     * @param value New setting value.
     * @returns Promise resolved with the background response.
     */
    async setSetting(key: string, value: unknown): Promise<any> {
        return browser.runtime.sendMessage({
            type: OPTIONS_UI_MESSAGES.SET_SETTING,
            data: {
                key,
                value,
            },
        });
    }
}
