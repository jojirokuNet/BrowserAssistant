/**
 * @file Sends one-shot messages to the background and awaits responses.
 */
import browser from 'webextension-polyfill';
import { nanoid } from 'nanoid';

import {
    POPUP_MESSAGES,
    BACKGROUND_MESSAGES,
    FEEDBACK_ACTIONS,
} from '../lib/types';
import { browserApi } from '../lib/browserApi';
import type { PreparedTab } from '../lib/tabs';

import type { RootStore } from './stores';

/**
 * App state as reported by the background (see state.getAppState):
 * the locale is always resolved there.
 */
export interface AppState {
    isInstalled: boolean;
    isRunning: boolean;
    isProtectionEnabled: boolean;
    isLicenseExpired: boolean;
    locale: string;
    isAuthorized: boolean;
    feedbackAction?: string;
}

export interface UpdateStatusInfo {
    isAppUpToDate: boolean;
    isValidatedOnHost: boolean;
}

/**
 * Filtering state of the current tab; originalCertStatus arrives as a
 * raw app string which the settings store maps into
 * ORIGINAL_CERT_STATUS.
 */
export interface CurrentFilteringState {
    isFilteringEnabled: boolean;
    isHttpsFilteringEnabled: boolean;
    originalCertStatus: string;
    originalCertIssuer: string;
    isPageFilteredByUserFilter: boolean;
    canChangeFilteringStatus: boolean;
}

/**
 * Response of GET_POPUP_DATA (see background/getPopupData). Some
 * branches omit fields and the store's destructuring tolerates it — a
 * pre-existing quirk, so only hostError is marked optional here.
 */
export interface PopupData {
    referrer: string;
    currentFilteringState: CurrentFilteringState | null;
    updateStatusInfo: UpdateStatusInfo;
    appState: AppState;
    isFilteringPauseSupported: boolean;
    showReloadButtonFlag: boolean;
    hostError?: string;
}

export interface AppStateResponse {
    appState: AppState;
    updateStatusInfo: UpdateStatusInfo;
}

/**
 * Message received from the background over the long-lived port (see
 * background/longLivedMessageService). Typed as loosely as the
 * background's own IncomingMessage.
 */
interface PortMessage {
    type: string;
    popupId?: string;
    data?: any;
}

const sendMessage = async <T>(type: string, data?: unknown): Promise<T> => {
    return browserApi.runtime.sendMessage({ type, data });
};

export const messagesSender = {
    getLocale: (): Promise<string> => {
        return sendMessage(POPUP_MESSAGES.GET_APP_LOCALE);
    },
    getPopupData: (tab: PreparedTab): Promise<PopupData> => {
        return sendMessage(POPUP_MESSAGES.GET_POPUP_DATA, { tab });
    },
    getUrlFilteringState: (
        tab: PreparedTab,
        forceStart = false,
    ): Promise<CurrentFilteringState | null> => {
        return sendMessage(POPUP_MESSAGES.GET_CURRENT_FILTERING_STATE, { tab, forceStart });
    },
    getAppState: (): Promise<AppStateResponse> => {
        return sendMessage(POPUP_MESSAGES.GET_APP_STATE);
    },
    initAssistant: (tabId: number | undefined): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.INIT_ASSISTANT, { tabId });
    },
    setProtectionStatus: (isEnabled: boolean): Promise<AppState> => {
        return sendMessage(POPUP_MESSAGES.SET_PROTECTION_STATUS, { isEnabled });
    },
    reportSite: (url: string, referrer: string): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.REPORT_SITE, { url, referrer });
    },
    removeCustomRules: (url: string): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.REMOVE_CUSTOM_RULES, { url });
    },
    openFilteringLog: (): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.OPEN_FILTERING_LOG);
    },
    openSettings: (): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.OPEN_SETTINGS);
    },
    setFilteringStatus: (url: string, isEnabled: boolean, isHttpsEnabled: boolean): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.SET_FILTERING_STATUS, { url, isEnabled, isHttpsEnabled });
    },
    openOriginalCert: (domain: string, port: number): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.OPEN_ORIGINAL_CERT, { domain, port });
    },
    updateApp: (): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.UPDATE_APP);
    },
    pauseFiltering: (tab: PreparedTab): Promise<void> => {
        return sendMessage(POPUP_MESSAGES.PAUSE_FILTERING, { tab });
    },
    getConsentRequired: (): Promise<boolean> => {
        return sendMessage(POPUP_MESSAGES.GET_CONSENT_REQUIRED);
    },
};

/**
 * Creates long lived connection between popup and background page.
 * @param rootStore Root store of the popup.
 * @returns Function that closes the connection.
 */
export const createLongLivedConnection = (rootStore: RootStore): (() => void) => {
    const { settingsStore } = rootStore;

    const popupId = `popup_${nanoid(7)}`;

    const messageHandler = async (message: PortMessage): Promise<void> => {
        switch (message.type) {
            case BACKGROUND_MESSAGES.CLOSE_POPUP: {
                if (message.popupId === popupId) {
                    window.close();
                }
                break;
            }
            case POPUP_MESSAGES.STATE_UPDATED: {
                // TODO move back feedbackAction check for updatePopupData
                //  when windows and mac apps will release new feedbackActions
                await settingsStore.updatePopupData();

                const { appState, updateStatusInfo } = message.data;
                if (appState.feedbackAction === FEEDBACK_ACTIONS.UPDATE_APPLICATION_APP_ONLY) {
                    settingsStore.setCurrentAppState(appState);
                    settingsStore.setUpdateStatusInfo(updateStatusInfo);
                }
                break;
            }
            case POPUP_MESSAGES.UPDATE_FILTERING_PAUSE_TIMEOUT: {
                const { currentTabHostname } = settingsStore;
                const filteringPauseTimeoutMs = message.data.filteringPauseMap[currentTabHostname];

                if (filteringPauseTimeoutMs === undefined) {
                    break;
                }

                if (filteringPauseTimeoutMs >= 0) {
                    await settingsStore.setFilteringPauseTimeoutMs(filteringPauseTimeoutMs);
                } else {
                    await settingsStore.updatePopupData();
                }
                break;
            }
            default:
                break;
        }
    };

    const port = browser.runtime.connect({ name: popupId });
    port.onMessage.addListener(messageHandler);

    const onUnload = (): void => {
        port.onMessage.removeListener(messageHandler);
        port.disconnect();
    };

    return onUnload;
};
