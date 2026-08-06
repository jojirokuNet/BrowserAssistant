/**
 * @file Exports the popup root store.
 */
import { createContext } from 'react';

import { configure } from 'mobx';

import SettingsStore from './settingsStore';
import UiStore from './uiStore';
import TranslationStore from './translationStore';

// Do not allow property change outside of store actions
configure({ enforceActions: 'observed' });

/**
 * Root MobX store of the popup, composing the UI, settings and translation
 * stores.
 */
export class RootStore {
    /**
     * UI store of the popup.
     */
    uiStore: UiStore;

    /**
     * Settings store of the popup.
     */
    settingsStore: SettingsStore;

    /**
     * Translation store of the popup.
     */
    translationStore: TranslationStore;

    /**
     * Creates the root store with the UI, settings and translation stores.
     */
    constructor() {
        this.uiStore = new UiStore(this);
        this.settingsStore = new SettingsStore(this);
        this.translationStore = new TranslationStore(this);
    }
}

const StoreContext = createContext(new RootStore());

export default StoreContext;

export const StoreConsumer = StoreContext.Consumer;
