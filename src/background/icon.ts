/**
 * @file Updates the browser action icon from the filtering state.
 */
import throttle from 'lodash/throttle';
import browser from 'webextension-polyfill';

import { getErrorMessage } from '../lib/errors';
import { log } from '../lib/logger';
import notifier from '../lib/notifier';
import { tabs, type PreparedTab } from '../lib/tabs';

import actions from './actions';
import { ContextMenu } from './contextMenu';
import state from './state';

/**
 * Checks whether two tab snapshots identify the same page.
 * @param left First tab snapshot.
 * @param right Second tab snapshot.
 * @returns True when both snapshots have the same tab id and URL.
 */
const isSameTab = (
    left: PreparedTab | null | undefined,
    right: PreparedTab | null | undefined,
): boolean => left?.id === right?.id && left?.url === right?.url;

/**
 * Updates visible icons while limiting native reads to the focused tab.
 */
class Icon {
    /**
     * Subscribes to tab, window, and state events and throttles icon updates.
     */
    constructor() {
        const ICON_THROTTLE_TIMEOUT_MS = 50;
        this.updateIcon = throttle(this.updateIcon, ICON_THROTTLE_TIMEOUT_MS);

        notifier.addSpecifiedListener(notifier.types.TAB_ACTIVATED, this.handleTabEvent);
        notifier.addSpecifiedListener(notifier.types.TAB_UPDATED, this.handleTabEvent);
        notifier.addSpecifiedListener(notifier.types.STATE_UPDATED, this.handleStateEvent);
        browser.windows.onFocusChanged.addListener(this.handleWindowFocus);
    }

    /**
     * Resolves the active tab of the requested or last-focused window.
     * @param windowId Window to query, or undefined to query the last-focused window.
     * @returns Active tab of the selected window, or null when none exists.
     */
    getFocusedTab = async (windowId?: number): Promise<browser.Tabs.Tab | null> => {
        const windowQuery: browser.Tabs.QueryQueryInfoType = windowId === undefined
            ? { lastFocusedWindow: true }
            : { windowId };
        const [tab] = await browser.tabs.query({ active: true, ...windowQuery });
        return tab || null;
    };

    /**
     * Refreshes the icon when an event still belongs to the focused tab.
     * @param eventTab Tab snapshot supplied by a tab event.
     * @param windowId Window selected by a focus event.
     * @returns Promise settled after the event has been handled.
     */
    handleTabEvent = async (eventTab?: PreparedTab, windowId?: number): Promise<void> => {
        try {
            const currentTab = await this.getFocusedTab(windowId);
            if (currentTab && (!eventTab || isSameTab(eventTab, currentTab))) {
                this.updateIcon(currentTab);
            }
        } catch (error) {
            log.debug(getErrorMessage(error));
        }
    };

    /**
     * Refreshes the active tab when a browser window receives focus.
     * @param windowId Id of the newly focused window.
     * @returns Promise settled after the refresh starts, or null when no window is focused.
     */
    handleWindowFocus = (windowId: number): Promise<void> | null => {
        if (windowId === browser.windows.WINDOW_ID_NONE) {
            return null;
        }

        return this.handleTabEvent(undefined, windowId);
    };

    /**
     * Updates the default icon and the visible tab overrides after a state event.
     * @returns Promise settled after the visible icon scopes have been updated.
     */
    handleStateEvent = async (): Promise<void> => {
        const isAppWorking = state.isAppWorking();
        await actions.setDefaultIcon(isAppWorking);

        if (isAppWorking) {
            await this.handleTabEvent();
            return;
        }

        try {
            const activeTabs = await tabs.getActiveTabs();
            if (state.isAppWorking()) {
                return;
            }

            await Promise.all(activeTabs.map((tab) => (
                actions.setTabIcon(tab.id as number, false)
            )));
            await ContextMenu.controlledUpdate();
        } catch (error) {
            log.debug(getErrorMessage(error));
        }
    };

    /**
     * Updates the tab icon when the native response still belongs to the focused page.
     * @param tab Focused tab snapshot to update.
     * @returns Promise settled after the tab icon and context menu have been updated.
     */
    updateIcon = async (tab: PreparedTab): Promise<void> => {
        try {
            let isFilteringEnabled = false;
            if (state.isAppWorking()) {
                const filteringState = await state.getCurrentFilteringState(tab);

                if (!isSameTab(tab, await this.getFocusedTab())) {
                    return;
                }

                state.setUrlInfo(tab.url, filteringState);
                isFilteringEnabled = state.isAppWorking()
                    && (filteringState?.isFilteringEnabled ?? true);
            }

            await actions.setTabIcon(tab.id as number, isFilteringEnabled);
            await ContextMenu.controlledUpdate();
        } catch (error) {
            log.debug(getErrorMessage(error));
        }
    };
}

export default new Icon();
