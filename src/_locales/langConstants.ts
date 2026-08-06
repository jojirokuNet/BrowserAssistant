/**
 * DO NOT IMPORT ANYTHING ELSE IN THIS FILE, BECAUSE IT IS ALSO USED
 * IN THE EXTENSION CODEBASE — keep it limited to the twosky config.
 * @file Locale constants shared with the twosky configuration.
 */
import twoskyConfig from '../../.twosky.json';

const [config] = twoskyConfig;

export const BASE_LOCALE = config.base_locale;
export const LANGUAGES = config.languages;
export const FILENAME = 'messages.json';
