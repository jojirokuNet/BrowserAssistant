import { createIntl } from 'react-intl';

import {
    action,
    computed,
    makeObservable,
    observable,
} from 'mobx';
import browser from 'webextension-polyfill';

import messagesMap from '../../../_locales';
import { BASE_LOCALE } from '../../../_locales/langConstants';
import type { RootStore } from '..';

import checkLocale from './checkLocale';

const browserLocale = browser.i18n.getUILanguage();

class TranslationStore {
    rootStore: RootStore;

    locale: string | null = null;

    constructor(rootStore: RootStore) {
        makeObservable(this, {
            locale: observable,
            setLocale: action,
            isReadyToDisplayMessages: computed,
            i18n: computed,
        });
        this.rootStore = rootStore;
    }

    setLocale = (locale: string): void => {
        this.locale = locale;
    };

    get isReadyToDisplayMessages(): boolean {
        return !!this.locale;
    }

    /**
     * Returns locale in the next order
     * 1. Returns application locale if has translations
     * 2. Returns browser locale if has translations
     * 3. Returns base locale
     */
    getLocale = (): { locale: string } => {
        let result = checkLocale(messagesMap, this.locale);

        if (result.suitable) {
            return { locale: result.locale };
        }

        result = checkLocale(messagesMap, browserLocale);
        return result.suitable ? { locale: result.locale } : { locale: BASE_LOCALE };
    };

    get i18n() {
        const result = this.getLocale();

        const defaultMessages = messagesMap[BASE_LOCALE];
        const currentLocaleMessages = messagesMap[result.locale];

        // messages with fallback to base locale
        const messages = Object.keys(defaultMessages).reduce((acc: Record<string, string>, key) => {
            acc[key] = currentLocaleMessages?.[key] || defaultMessages[key];
            return acc;
        }, {});

        // createIntl doesn't accept locales codes longer than 2 chars
        // and here it is not important, so we left only two chars
        const locale = result.locale.slice(0, 2);
        return createIntl({
            locale,
            messages,
        });
    }

    translate = (id: string): string => this.i18n.formatMessage({ id });
}

export default TranslationStore;
