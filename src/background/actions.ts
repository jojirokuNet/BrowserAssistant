/**
 * @file Handles user actions from the popup and forwards them to the host.
 */
import browser from 'webextension-polyfill';

import { log } from '../lib/logger';
import { getErrorMessage } from '../lib/errors';
import { browserApi } from '../lib/browserApi';

import { Prefs } from './prefs';

type SetIconDetailsType = browser.Action.SetIconDetailsType;

const setIcon = async (details: SetIconDetailsType) => {
    try {
        await browserApi.action.setIcon(details);
    } catch (e) {
        log.debug(getErrorMessage(e));
    }
};

/**
 * Sets the enabled icon, twice: once for the general browser action and
 * once for the tab browser action when a tab id is provided.
 * @param tabId Tab to show the enabled icon on.
 */
const setIconEnabled = async (tabId: number) => {
    const details: SetIconDetailsType = { path: Prefs.ICONS.ENABLED };
    await setIcon(details);
    if (tabId) {
        details.tabId = tabId;
        await setIcon(details);
    }
};

/**
 * Sets the disabled icon, twice: once for the general browser action and
 * once for the tab browser action when a tab id is provided.
 * @param tabId Tab to show the disabled icon on.
 */
const setIconDisabled = async (tabId: number) => {
    const details: SetIconDetailsType = { path: Prefs.ICONS.DISABLED };
    await setIcon(details);
    if (tabId) {
        details.tabId = tabId;
        await setIcon(details);
    }
};

const actions = {
    setIconEnabled,
    setIconDisabled,
};

export default actions;
