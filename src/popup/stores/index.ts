import { createContext } from 'react';

import { configure } from 'mobx';

import SettingsStore from './settingsStore';
import UiStore from './uiStore';
import TranslationStore from './translationStore';

// Do not allow property change outside of store actions
configure({ enforceActions: 'observed' });

export class RootStore {
    uiStore: UiStore;

    settingsStore: SettingsStore;

    translationStore: TranslationStore;

    constructor() {
        this.uiStore = new UiStore(this);
        this.settingsStore = new SettingsStore(this);
        this.translationStore = new TranslationStore(this);
    }
}

const StoreContext = createContext(new RootStore());

export default StoreContext;

export const StoreConsumer = StoreContext.Consumer;
