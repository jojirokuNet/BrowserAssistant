import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';
import browser from 'webextension-polyfill';

import { FEEDBACK_ACTIONS } from '../lib/types';
import notifier from '../lib/notifier';
import {
    getFormattedProtocol,
    getUrlProps,
    isHttp,
} from '../lib/helpers';
import { PROTOCOLS } from '../popup/stores/consts';
import { log } from '../lib/logger';
import type { PreparedTab } from '../lib/tabs';

import versions from './versions';
import { Api } from './api';
import { longLivedMessageService } from './longLivedMessageService';

/**
 * App state received from the desktop app. The installed/running/protection
 * flags are required; the rest is optional per the app.
 */
interface AppState {
    isInstalled: boolean;
    isRunning: boolean;
    isProtectionEnabled: boolean;
    isLicenseExpired: boolean;
    locale: string | null;
    isAuthorized: boolean;
    feedbackAction: string;
}

/**
 * App state as exposed to consumers: the locale is always resolved,
 * falling back to the browser UI language.
 */
type ResolvedAppState = Omit<AppState, 'locale'> & { locale: string };

interface UpdateStatusInfo {
    isAppUpToDate: boolean;
    isValidatedOnHost: boolean;
}

interface HostInfo {
    platform: string;
    version: string;
}

interface UrlInfo {
    isHttpsFilteringEnabled: boolean;
    isFilteringEnabled: boolean;
    isSecured: boolean;
    canChangeFilteringStatus: boolean;
}

/**
 * This class handles app state
 * All requests to the native host should be made through this class
 */
class State {
    appState: AppState = {
        /**
         * Required flag, that determines whether the AdGuard app is installed on the computer
         */
        isInstalled: false,
        /**
         * Required flag, that determines whether the AdGuard app is running
         */
        isRunning: false,
        /**
         * Required flag, that determines whether the protection is enabled
         */
        isProtectionEnabled: false,
        /**
         * Required flag determining whether the license has expired
         */
        isLicenseExpired: false,
        /**
         * Optional parameter from the app
         */
        locale: null,
        /**
         * Optional parameter from the app, consider true unless is set to the false
         */
        isAuthorized: true,

        /**
         *  String that determines what action application wants browser assistant to do
         */
        feedbackAction: FEEDBACK_ACTIONS.UPDATE_APPLICATION_APP_ONLY,
    };

    updateStatusInfo: UpdateStatusInfo = {
        /**
         * Parameter that determines if the extension API version is up-to-date with the app API version
         */
        isAppUpToDate: true,
        /**
         * Flag that determines whether the extension's API, specified by request's parameters,
         * is successfully validated on the host's side
         */
        isValidatedOnHost: true,
    };

    hostInfo: HostInfo = {
        platform: '',
        version: '',
    };

    urlInfo: UrlInfo = {
        isHttpsFilteringEnabled: false,
        isFilteringEnabled: false,
        isSecured: false,
        canChangeFilteringStatus: true,
    };

    /**
     * Written by setFilteringStatus and never read anywhere — today's
     * dynamic-property assignment preserved as a declared field (the
     * apparent mix-up with isFilteringEnabled is a pre-existing quirk,
     * not fixed here per the no-refactor rule).
     */
    isEnabled?: boolean;

    /**
     * Native host API implementation (NativeHostApi, or StubHostApi when
     * manually switched in ./api); assigned in init().
     */
    api!: InstanceType<typeof Api>;

    set isHttpsFilteringEnabled(isHttpsFilteringEnabled: boolean) {
        this.urlInfo.isHttpsFilteringEnabled = isHttpsFilteringEnabled;
    }

    set isFilteringEnabled(isFilteringEnabled: boolean) {
        this.urlInfo.isFilteringEnabled = isFilteringEnabled;
    }

    set isSecured(isSecured: boolean) {
        this.urlInfo.isSecured = isSecured;
    }

    set canChangeFilteringStatus(canChangeFilteringStatus: boolean) {
        this.urlInfo.canChangeFilteringStatus = canChangeFilteringStatus;
    }

    updateSecured = (currentUrl: string | undefined): void => {
        // The cast keeps today's runtime unchanged: invalid or missing
        // input flows through getUrlProps exactly as before.
        const { protocol } = getUrlProps(currentUrl as string);

        this.isSecured = getFormattedProtocol(protocol) === PROTOCOLS.SECURED;
    };

    /**
     * Handles init message response and updates app setup
     */
    initMessageHandler = (response: any): void => {
        const { parameters, appState } = response;
        const {
            isValidatedOnHost, apiVersion, version, platform,
        } = parameters;
        const isAppUpToDate = versions.apiVersion <= apiVersion;
        this.setAppState(appState);
        this.setUpdateStatusInfo(isAppUpToDate, isValidatedOnHost);
        this.setHostInfo(platform, version);
    };

    /**
     * Listens messages sent by native host without request
     */
    nativeHostMessagesHandler = async (message: any): Promise<void> => {
        if (!message || !message.appState) {
            return;
        }

        this.setAppState(message.appState);
    };

    init = (): void => {
        this.api = new Api(this.nativeHostMessagesHandler, this.initMessageHandler);
    };

    /**
     * Returns current app state
     */
    getAppState = (): ResolvedAppState => {
        let { locale } = this.appState;
        // if no locale use browser locale
        if (!locale) {
            locale = browser.i18n.getUILanguage();
        }

        return {
            ...this.appState,
            locale,
        };
    };

    /**
     * Returns update status info
     */
    getUpdateStatusInfo(): UpdateStatusInfo {
        return this.updateStatusInfo;
    }

    /**
     * Validates app state, sets app state and notifies external modules that state has changed
     */
    setAppState = (appState: Partial<AppState> = {}): void => {
        const {
            isInstalled,
            isRunning,
            isProtectionEnabled,
            isLicenseExpired,
            locale,
            isAuthorized,
        } = appState;

        let { feedbackAction = FEEDBACK_ACTIONS.UPDATE_APPLICATION_APP_ONLY } = appState;

        if ([isInstalled, isRunning, isProtectionEnabled].some((state) => state === undefined)) {
            // eslint-disable-next-line max-len
            const message = `isInstalled=${isInstalled}, isRunning=${isRunning}, isProtectionEnabled=${isProtectionEnabled}`;
            throw new Error(`All states should be defined: received ${message}`);
        }

        /**
         * Validate feedbackAction values, set to default if not found among known actions
         */
        if (!Object.values(FEEDBACK_ACTIONS).includes(feedbackAction)) {
            log.debug(`Extension doesn't know about this feedback action: ${feedbackAction}`);
            feedbackAction = FEEDBACK_ACTIONS.UPDATE_APPLICATION_APP_ONLY;
        }

        // The assertion preserves today's runtime: the guard above
        // throws before any of the three required flags can be
        // undefined, while isLicenseExpired may legitimately be
        // overwritten with undefined (pre-existing quirk, unchanged).
        const nextAppState = {
            ...this.appState,
            isInstalled,
            isRunning,
            isProtectionEnabled,
            isLicenseExpired,
            feedbackAction,
        } as AppState;

        if (locale !== undefined) {
            nextAppState.locale = locale;
        }

        if (isAuthorized !== undefined) {
            nextAppState.isAuthorized = isAuthorized;
        }

        const appStateChanged = !isEqual(this.appState, nextAppState);

        if (appStateChanged) {
            this.appState = { ...this.appState, ...nextAppState };
        }

        // Notify modules only when appState changes or feedbackAction asks
        // to update filtering state
        if (appStateChanged || feedbackAction === FEEDBACK_ACTIONS.UPDATE_FILTERING_STATUS) {
            this.notifyModules();
        }
    };

    NOTIFY_TIMEOUT_MS = 40;

    /**
     * Notifies modules about state changes
     * Throttle function, so we can call it whenever we want
     */
    notifyModules = throttle(async (tab?: PreparedTab): Promise<void> => {
        // Notify browser action tab about changed state
        notifier.notifyListeners(notifier.types.STATE_UPDATED, tab);

        // Notify popup about changed state
        longLivedMessageService.notifyPopupStateUpdated(
            this.getAppState(),
            this.getUpdateStatusInfo(),
        );
    }, this.NOTIFY_TIMEOUT_MS, { leading: false });

    /**
     * Sets update status info and notifies external modules when it changes
     */
    setUpdateStatusInfo = (isAppUpToDate: boolean, isValidatedOnHost: boolean): void => {
        const nextUpdateStatusInfo: UpdateStatusInfo = {
            isAppUpToDate,
            isValidatedOnHost,
        };

        // Notify modules only when updateStatusInfo changes
        if (!isEqual(this.updateStatusInfo, nextUpdateStatusInfo)) {
            this.updateStatusInfo = { ...this.updateStatusInfo, ...nextUpdateStatusInfo };
            this.notifyModules();
        }
    };

    /**
     * Sets host info
     */
    setHostInfo = (platform: string, version: string): void => {
        this.hostInfo = {
            platform,
            version,
        };
    };

    /**
     * Checks if app is working
     */
    isAppWorking(): boolean {
        return [
            this.appState.isInstalled,
            this.appState.isRunning,
            this.appState.isProtectionEnabled,
            this.updateStatusInfo.isAppUpToDate,
            this.updateStatusInfo.isValidatedOnHost,
        ].every((state) => state === true);
    }

    /**
     * Returns app locale key
     */
    getLocale(): string {
        return this.appState.locale || browser.i18n.getUILanguage();
    }

    /**
     * Returns current filtering state or null if url is not http
     */
    getCurrentFilteringState = async (tab?: { url?: string }, forceStart = false): Promise<any> => {
        const url = tab?.url;
        this.updateSecured(url);

        // Do not send empty urls or non http urls, see - AG-2360, except for forceStart
        if (!forceStart && !(url && isHttp(url))) {
            return null;
        }

        // Casts keep today's runtime unchanged: with forceStart the app
        // receives the url exactly as before, valid or not.
        const { port } = getUrlProps(url as string);

        const response = await this.api.getCurrentFilteringState(url as string, port, forceStart);

        const { appState, parameters } = response;
        if (!parameters) {
            return null;
        }
        const {
            isFilteringEnabled,
            isHttpsFilteringEnabled,
        } = parameters;

        let { canChangeFilteringStatus } = parameters;

        this.setAppState(appState);
        this.isFilteringEnabled = isFilteringEnabled;
        this.isHttpsFilteringEnabled = isHttpsFilteringEnabled;
        if (canChangeFilteringStatus === undefined) {
            canChangeFilteringStatus = true; // by default consider that this flag is true
        }
        this.canChangeFilteringStatus = canChangeFilteringStatus;

        return { ...parameters, canChangeFilteringStatus };
    };

    setProtectionStatus = async (isEnabled: boolean): Promise<any> => {
        const response = await this.api.setProtectionStatus(isEnabled);
        this.setAppState(response.appState);
        return response.appState;
    };

    getCurrentAppState = async (): Promise<any> => {
        const appState = await this.api.getCurrentAppState();
        this.setAppState(appState);
        return appState;
    };

    setFilteringStatus = async (
        isEnabled: boolean,
        isHttpsEnabled: boolean,
        url: string | undefined,
    ): Promise<void> => {
        this.isEnabled = isEnabled;
        this.isHttpsFilteringEnabled = isHttpsEnabled;

        const response = await this.api.setFilteringStatus(
            isEnabled,
            isHttpsEnabled,
            // The native-host contract expects a string; contextMenu.ts
            // passes PreparedTab's optional url today — runtime unchanged.
            url as string,
        );
        this.setAppState(response.appState);
    };

    removeCustomRules = async (url: string): Promise<void> => {
        const response = await this.api.removeCustomRules(url);
        this.setAppState(response.appState);
    };

    openOriginalCert = async (domain: string, port: number): Promise<void> => {
        const response = await this.api.openOriginalCert(domain, port);
        this.setAppState(response.appState);
    };

    reportSite = async (url: string | undefined, referrer: string): Promise<any> => {
        const response = await this.api.reportSite(url as string, referrer);
        this.setAppState(response.appState);
        return response.parameters.reportUrl;
    };

    openFilteringLog = async (): Promise<void> => {
        const response = await this.api.openFilteringLog();
        this.setAppState(response.appState);
    };

    openSettings = async (): Promise<void> => {
        const response = await this.api.openSettings();
        this.setAppState(response.appState);
    };

    updateApp = async (): Promise<void> => {
        const response = await this.api.updateApp();
        this.setAppState(response.appState);
    };

    addRule = async (ruleText: string): Promise<void> => {
        const response = await this.api.addRule(ruleText);
        this.setAppState(response.appState);
    };

    pauseFiltering = async (url: string, timeout: string): Promise<void> => {
        const response = await this.api.pauseFiltering(url, timeout);
        this.setAppState(response.appState);
    };
}

export default new State();
