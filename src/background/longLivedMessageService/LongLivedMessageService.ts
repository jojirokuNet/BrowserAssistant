/**
 * @file Long-lived port service that pushes state updates to the popup.
 */
import browser from 'webextension-polyfill';

import { BACKGROUND_MESSAGES, POPUP_MESSAGES } from '../../lib/types';
import { log } from '../../lib/logger';

let openedPort: browser.Runtime.Port | null = null;

/**
 * Sets opened port.
 * @param value Port to store, or null to clear.
 */
const setOpenedPort = (value: browser.Runtime.Port | null): void => {
    openedPort = value;
};

/**
 * Manages the long-lived port that pushes state updates to the popup.
 */
export class LongLivedMessageService {
    /**
     * Stores the port and closes the previously opened popup if any.
     * @param port Port opened by the popup.
     */
    init(port: browser.Runtime.Port): void {
        if (openedPort) {
            // close previously opened popup to avoid situation of two opened popups
            openedPort.postMessage({
                type: BACKGROUND_MESSAGES.CLOSE_POPUP,
                popupId: openedPort.name,
            });
        }

        setOpenedPort(port);

        port.onDisconnect.addListener(async () => {
            log.debug(`Popup with id "${port.name}" closed`);
            if (port === openedPort) {
                setOpenedPort(null);
            }
        });
    }

    /**
     * Sends the updated application state to the popup over the opened port.
     * @param appState Updated application state.
     * @param updateStatusInfo Updated update status info.
     */
    notifyPopupStateUpdated(appState: any, updateStatusInfo: any): void {
        if (!openedPort) {
            return;
        }

        openedPort.postMessage({
            type: POPUP_MESSAGES.STATE_UPDATED,
            data: {
                appState,
                updateStatusInfo,
            },
        });
    }

    /**
     * Sends the filtering pause timeout map to the popup over the opened port.
     * @param hostnameToTimeoutMap Map of hostnames to their pause timeout.
     */
    notifyPopupFilteringPauseTimeout(hostnameToTimeoutMap: Record<string, number>): void {
        if (!openedPort) {
            return;
        }

        openedPort.postMessage({
            type: POPUP_MESSAGES.UPDATE_FILTERING_PAUSE_TIMEOUT,
            data: {
                filteringPauseMap: hostnameToTimeoutMap,
            },
        });
    }
}
