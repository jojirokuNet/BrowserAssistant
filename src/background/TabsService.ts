/**
 * @file Service that prepares data about the current tab for the popup.
 */
import browser from 'webextension-polyfill';

import { CONTENT_MESSAGES } from '../lib/types';
import { log } from '../lib/logger';
import { getErrorMessage } from '../lib/errors';
import { CONTENT_SCRIPT_NAME } from '../lib/consts';
import { tabs, type PreparedTab } from '../lib/tabs';
import notifier from '../lib/notifier';

import filteringPause from './filteringPause';

/**
 * Manages interaction with tabs.
 */
class TabsService {
    /**
     * Subscribes to tab update and activation events to refresh tab state.
     */
    constructor() {
        browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' || changeInfo.status === 'loading') {
                const hostname = filteringPause.getUrlHostname(tab.url);

                if (filteringPause.hostnameToTimeoutMap[hostname] < 0) {
                    filteringPause.deleteHostnameTimeout(tab.url);
                }

                if (tab && tab.active) {
                    notifier.notifyListeners(notifier.types.TAB_UPDATED, tabs.prepareTab(tab));
                }
            }
        });

        browser.tabs.onActivated.addListener(async ({ tabId }) => {
            let tab;
            try {
                tab = await browser.tabs.get(tabId);
            } catch (e) {
                log.debug(getErrorMessage(e));
                return; // ignore errors happening when we try to get removed tabs
            }
            if (tab && tab.active) {
                notifier.notifyListeners(notifier.types.TAB_ACTIVATED, tabs.prepareTab(tab));
            }
        });
    }

    /**
     * Sends message to the tab, previously executing there content script.
     * @param tabId Id of the tab to send the message to.
     * @param type Type of the message to send.
     * @param data Data to pass with the message.
     * @returns Promise resolved with the response from the tab.
     */
    sendMessage = async (tabId: number | undefined, type: string, data?: any): Promise<any> => {
        // The tabId casts keep today's runtime unchanged: callers can
        // pass undefined (PreparedTab.id), which flows into the browser
        // APIs exactly as before.
        await browser.scripting.executeScript({
            target: { tabId: tabId as number },
            files: [CONTENT_SCRIPT_NAME],
        });

        const response = await browser.tabs.sendMessage(tabId as number, {
            type,
            data,
        });
        return response;
    };

    /**
     * Retrieves referrer from content script.
     * @param tab Tab to retrieve the referrer from.
     * @returns Referrer of the tab, or an empty string on failure.
     */
    getReferrer = async (tab: PreparedTab): Promise<string> => {
        try {
            const response = await this.sendMessage(tab.id, CONTENT_MESSAGES.GET_REFERRER);
            return response;
        } catch (e) {
            return '';
        }
    };

    /**
     * Sends message to init assistant on the page, and passes it callback name.
     * @param tabId Id of the tab to init the assistant on.
     */
    initAssistant = async (tabId: number | undefined): Promise<void> => {
        const data = { addRuleCallbackName: CONTENT_MESSAGES.ADD_RULE };
        try {
            await this.sendMessage(tabId, CONTENT_MESSAGES.INIT_ASSISTANT, data);
        } catch (e) {
            log.debug(getErrorMessage(e));
        }
    };
}

export const tabsService = new TabsService();
