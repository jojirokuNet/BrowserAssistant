import {
    action,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';
import browser from 'webextension-polyfill';

import { OPTIONS_UI_MESSAGES, SETTINGS } from '../../lib/types';

import type { OptionsUiStore } from './index';

export class SettingsStore {
    rootStore: OptionsUiStore;

    contextEnabled = true;

    settingsReceived = false;

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

    async getSettings(): Promise<void> {
        this.settingsReceived = false;
        const contextEnabled = await this.getSetting(SETTINGS.CONTEXT_MENU_ENABLED);
        runInAction(() => {
            this.settingsReceived = true;
            this.contextEnabled = contextEnabled;
        });
    }

    async setContextMenuState(state: boolean): Promise<void> {
        await this.setSetting(SETTINGS.CONTEXT_MENU_ENABLED, state);
        runInAction(() => {
            this.contextEnabled = state;
        });
    }

    async getSetting(key: string): Promise<any> {
        return browser.runtime.sendMessage({
            type: OPTIONS_UI_MESSAGES.GET_SETTING,
            data: {
                key,
            },
        });
    }

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
