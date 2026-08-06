/**
 * @file Handles user actions from the popup and forwards them to the host.
 */
import browser from 'webextension-polyfill';

import { log } from '../lib/logger';
import { getErrorMessage } from '../lib/errors';
import { browserApi } from '../lib/browserApi';

import { Prefs } from './prefs';

type SetIconDetailsType = browser.Action.SetIconDetailsType;

/**
 * Applies a browser-action icon and logs browser API failures.
 * @param details Icon path and optional tab scope.
 * @returns Promise settled after the browser API call.
 */
const setIcon = async (details: SetIconDetailsType) => {
    try {
        await browserApi.action.setIcon(details);
    } catch (e) {
        log.debug(getErrorMessage(e));
    }
};

/**
 * Resolves icon resources for the requested filtering state.
 * @param isEnabled Whether filtering is enabled.
 * @returns Icon path map.
 */
const getIconPath = (isEnabled: boolean) => (
    isEnabled ? Prefs.ICONS.ENABLED : Prefs.ICONS.DISABLED
);

/**
 * Updates the default icon inherited by tabs without an override.
 * @param isEnabled Whether the application is working.
 * @returns Promise settled after the icon update.
 */
const setDefaultIcon = async (isEnabled: boolean) => {
    await setIcon({ path: getIconPath(isEnabled) });
};

/**
 * Updates only the tab override owned by a filtering result.
 * @param tabId Tab whose override should be updated.
 * @param isEnabled Whether filtering is enabled for the tab.
 * @returns Promise settled after the icon update.
 */
const setTabIcon = async (tabId: number, isEnabled: boolean) => {
    await setIcon({ path: getIconPath(isEnabled), tabId });
};

const actions = {
    setDefaultIcon,
    setTabIcon,
};

export default actions;
