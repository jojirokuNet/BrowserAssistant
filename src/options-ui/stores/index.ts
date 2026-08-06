/**
 * @file Exports the options page store.
 */
import { createContext } from 'react';

import { configure } from 'mobx';

import { SettingsStore } from './SettingsStore';

// Do not allow property change outside of store actions
configure({ enforceActions: 'observed' });

/**
 * Root MobX store of the options page.
 */
export class OptionsUiStore {
    /**
     * Settings store of the options page.
     */
    settingsStore: SettingsStore;

    /**
     * Creates the root store with its settings store.
     */
    constructor() {
        this.settingsStore = new SettingsStore(this);
    }
}

export const optionsUiStore = createContext(new OptionsUiStore());
