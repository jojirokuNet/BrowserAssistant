/**
 * @file Shared i18n instance for the current browser locale.
 */
import browser from 'webextension-polyfill';

import type { I18nInterface } from '@adguard/translate';

export const i18n: I18nInterface = {
    getMessage: browser.i18n.getMessage,
    getUILanguage: browser.i18n.getUILanguage as I18nInterface['getUILanguage'],
    getBaseMessage: (key: string) => key,
    getBaseUILanguage: () => 'en',
};
