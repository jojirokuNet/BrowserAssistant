/**
 * @file Store holding the popup state received from the background.
 */
import {
    action,
    computed,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';

import {
    ORIGINAL_CERT_STATUS,
    PROTOCOLS,
    SWITCHER_TRANSITION_TIME,
} from '../consts';
import {
    DOWNLOAD_LINK,
    EXTENSION_DOWNLOAD_LINK,
    SUPPORT_LINK,
} from '../../../lib/consts';
import { tabs, type PreparedTab } from '../../../lib/tabs';
import {
    messagesSender,
    type AppState,
    type CurrentFilteringState,
    type UpdateStatusInfo,
} from '../../messageService';
import {
    getFormattedProtocol,
    getUrlProps,
    isExtensionProtocol,
} from '../../../lib/helpers';
import { log } from '../../../lib/logger';
import type { RootStore } from '..';

/**
 * MobX store of the popup settings and the current tab state.
 */
class SettingsStore {
    /**
     * Root store of the popup.
     */
    rootStore: RootStore;

    /**
     * Url of the current tab.
     */
    currentUrl = '';

    /**
     * Title of the current tab.
     */
    currentTitle = '';

    /**
     * Referrer of the current tab.
     */
    referrer = '';

    /**
     * Issuer of the original certificate of the current site.
     */
    originalCertIssuer = '';

    /**
     * Whether the current page is filtered by a user filter.
     */
    isPageFilteredByUserFilter = false;

    /**
     * Whether HTTPS filtering is enabled for the current tab.
     */
    isHttpsFilteringEnabled = false;

    /**
     * Whether filtering is enabled for the current tab.
     */
    isFilteringEnabled = false;

    /**
     * Whether the filtering status can be changed for the current tab.
     */
    canChangeFilteringStatus = true;

    /**
     * Whether the application is installed.
     */
    isInstalled = false;

    /**
     * Whether the application is running.
     */
    isRunning = false;

    /**
     * Whether protection is enabled.
     */
    isProtectionEnabled = false;

    /**
     * Whether the application license is expired.
     */
    isLicenseExpired = false;

    /**
     * Status of the original certificate of the current site.
     */
    originalCertStatus = ORIGINAL_CERT_STATUS.VALID;

    /**
     * Whether the application version is up to date.
     */
    isAppUpToDate = false;

    /**
     * Whether the app state was validated on the host.
     */
    isValidatedOnHost = false;

    /**
     * Whether the extension runs in Firefox.
     */
    isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;

    /**
     * Whether the user is authorized.
     */
    isAuthorized = false;

    /**
     * Error message reported by the host, if any.
     */
    hostError: string | null = null;

    /**
     * Remaining filtering pause time in milliseconds.
     */
    filteringPauseTimeoutMs = 0;

    /**
     * Whether the host supports filtering pause.
     */
    isFilteringPauseSupported = false;

    /**
     * Whether the reload button flag is shown.
     */
    showReloadButtonFlag = false;

    /**
     * Whether user consent is required.
     */
    consentRequired = true;

    /**
     * Whether the consent state is being loaded.
     */
    loadingConsent = true;

    /**
     * Creates the settings store of the popup.
     * @param rootStore Root store of the popup.
     */
    constructor(rootStore: RootStore) {
        makeObservable(this, {
            currentUrl: observable,
            currentTitle: observable,
            referrer: observable,
            originalCertIssuer: observable,
            isPageFilteredByUserFilter: observable,
            isHttpsFilteringEnabled: observable,
            isFilteringEnabled: observable,
            canChangeFilteringStatus: observable,
            isInstalled: observable,
            isRunning: observable,
            isProtectionEnabled: observable,
            isLicenseExpired: observable,
            originalCertStatus: observable,
            isAppUpToDate: observable,
            isValidatedOnHost: observable,
            isFirefox: observable,
            isAuthorized: observable,
            hostError: observable,
            filteringPauseTimeoutMs: observable,
            isFilteringPauseSupported: observable,
            showReloadButtonFlag: observable,
            consentRequired: observable,
            loadingConsent: observable,
            filteringPauseTimer: computed,
            shouldShowFilteringPauseTimer: computed,
            currentTabHostname: computed,
            currentPort: computed,
            currentProtocol: computed,
            pageProtocol: computed,
            pageInfo: computed,
            isAppWorking: computed,
            hasHostError: computed,
            setFilteringPauseSupported: action,
            setFilteringPauseTimeoutMs: action,
            setShowReloadButtonFlag: action,
            setUpdateStatusInfo: action,
            updatePopupData: action,
            setConsentRequired: action,
            setLoadingConsent: action,
            getPopupData: action,
            openDownloadPage: action,
            setHttpsFiltering: action,
            setFiltering: action,
            setInstalled: action,
            setUrlFilteringState: action,
            setCurrentAppState: action,
            updateExtension: action,
            getCurrentTab: action,
        });
        this.rootStore = rootStore;
    }

    /**
     * Returns the remaining filtering pause time as a timer string.
     * @returns The pause timer string in the mm:ss format.
     */
    get filteringPauseTimer(): string {
        const filteringPauseTimeoutSec = (this.filteringPauseTimeoutMs / 1000).toString(10);
        return `00:${filteringPauseTimeoutSec.padStart(2, '0')}`;
    }

    /**
     * Checks whether the filtering pause timer should be shown.
     * @returns True if the filtering pause timeout is active.
     */
    get shouldShowFilteringPauseTimer(): boolean {
        return this.filteringPauseTimeoutMs > 0;
    }

    /**
     * Returns the hostname of the current tab url.
     * @returns The current tab hostname.
     */
    get currentTabHostname(): string {
        return getUrlProps(this.currentUrl).hostname || this.currentUrl;
    }

    /**
     * Returns the port of the current tab url.
     * @returns The current tab port number.
     */
    get currentPort(): number {
        return getUrlProps(this.currentUrl).port;
    }

    /**
     * Returns the formatted protocol of the current tab url.
     * @returns The formatted current protocol.
     */
    get currentProtocol() {
        const { protocol } = getUrlProps(this.currentUrl);
        return getFormattedProtocol(protocol);
    }

    /**
     * Returns the protocol properties of the current tab url.
     * @returns Object describing the current page protocol.
     */
    get pageProtocol() {
        const { protocol } = getUrlProps(this.currentUrl);
        return ({
            isHttp: this.currentProtocol === PROTOCOLS.HTTP,
            isHttps: this.currentProtocol === PROTOCOLS.HTTPS,
            isSecured: this.currentProtocol === PROTOCOLS.SECURED,
            isExtension: this.currentProtocol === PROTOCOLS.SECURED
                && isExtensionProtocol(protocol),
        });
    }

    /**
     * Returns the title of an extension page or the hostname of a regular page.
     * @returns The page info string.
     */
    get pageInfo(): string {
        return this.pageProtocol.isExtension ? this.currentTitle : this.currentTabHostname;
    }

    /**
     * Sets whether the host supports filtering pause.
     * @param isFilteringPauseSupported Whether filtering pause is supported.
     */
    setFilteringPauseSupported = (isFilteringPauseSupported: boolean): void => {
        this.isFilteringPauseSupported = isFilteringPauseSupported;
    };

    /**
     * Sets the filtering pause timeout in the store.
     * @param filteringPauseTimeoutMs Remaining pause time in milliseconds.
     */
    setFilteringPauseTimeoutMs = async (filteringPauseTimeoutMs: number): Promise<void> => {
        runInAction(() => {
            this.filteringPauseTimeoutMs = filteringPauseTimeoutMs;
        });
        const tab = await this.getCurrentTab();
        await this.updatePopupData(tab);
    };

    /**
     * Sets whether the reload button flag is shown.
     * @param showReloadButtonFlag Whether the flag is shown.
     */
    setShowReloadButtonFlag = (showReloadButtonFlag: boolean): void => {
        this.showReloadButtonFlag = showReloadButtonFlag;
    };

    /**
     * Updates the app update status info.
     * @param statusInfo Update status info to apply.
     */
    setUpdateStatusInfo = (statusInfo: UpdateStatusInfo): void => {
        const { isAppUpToDate, isValidatedOnHost } = statusInfo;

        this.isAppUpToDate = isAppUpToDate;
        this.isValidatedOnHost = isValidatedOnHost;
    };

    /**
     * Refreshes the popup data from the current tab.
     * @param tab Prepared tab to use, or the current tab when omitted.
     */
    updatePopupData = async (tab?: PreparedTab): Promise<void> => {
        const currentTab = tab || await this.getCurrentTab();
        const popupData = await messagesSender.getPopupData(currentTab);
        if (popupData.hostError) {
            runInAction(() => {
                // Narrowing does not persist into the closure; the cast
                // keeps today's assignment unchanged
                this.hostError = popupData.hostError as string;
                this.rootStore.uiStore.setExtensionLoading(false);
            });
            return;
        }

        const {
            referrer,
            currentFilteringState,
            updateStatusInfo,
            appState,
            isFilteringPauseSupported,
            showReloadButtonFlag,
        } = popupData;

        runInAction(() => {
            this.referrer = referrer;
            this.setUrlFilteringState(currentFilteringState);
            this.setCurrentAppState(appState);
            this.setUpdateStatusInfo(updateStatusInfo);
            this.setFilteringPauseSupported(isFilteringPauseSupported);
            this.setShowReloadButtonFlag(showReloadButtonFlag);
        });
    };

    /**
     * Sets whether consent is required.
     * @param consentRequired Whether consent is required.
     */
    setConsentRequired = (consentRequired: boolean): void => {
        this.loadingConsent = false;
        this.consentRequired = consentRequired;
    };

    /**
     * Sets whether the consent state is being loaded.
     * @param state Whether consent is loading.
     */
    setLoadingConsent = (state: boolean): void => {
        this.loadingConsent = state;
    };

    /**
     * Loads the consent state and the popup data into the store.
     */
    getPopupData = async (): Promise<void> => {
        // first check consent
        this.setLoadingConsent(true);
        const consentRequired = await messagesSender.getConsentRequired();
        this.setConsentRequired(consentRequired);
        this.setLoadingConsent(false);
        if (consentRequired) {
            return;
        }

        // second get locale to show messages as faster as possible,
        // for consent screen it is not important as it uses browser locale
        const locale = await messagesSender.getLocale();
        this.rootStore.translationStore.setLocale(locale);
        this.rootStore.uiStore.setExtensionLoading(true);
        const tab = await this.getCurrentTab();
        await this.updatePopupData(tab);

        runInAction(() => {
            // Casts keep today's runtime unchanged when the tab has no
            // url or title
            this.currentUrl = tab.url as string;
            this.currentTitle = tab.title as string;
            // Stop showing loading screen only when all popup data is received
            this.rootStore.uiStore.setExtensionLoading(false);
        });
    };

    /**
     * Opens the application download page.
     */
    openDownloadPage = async (): Promise<void> => {
        await tabs.openPage(DOWNLOAD_LINK);
    };

    /**
     * Reloads current tab.
     */
    reloadCurrentTab = async (): Promise<void> => {
        const tab = await tabs.getCurrentTab();
        await tabs.reloadTab(tab);
    };

    /**
     * Reloads active and similar tabs.
     */
    reloadActiveAndSimilarTabs = async (): Promise<void> => {
        const tabsToReload = await tabs.getActiveAndSimilarTabs();
        tabsToReload.forEach((tab) => {
            tabs.reloadTab(tab);
        });
    };

    /**
     * Reloads the active tab after the switcher transition.
     */
    reloadPageAfterSwitcherTransition = (): void => {
        setTimeout(async () => {
            await this.reloadActiveAndSimilarTabs();
        }, SWITCHER_TRANSITION_TIME);
    };

    /**
     * Applies the HTTPS filtering status for the current tab.
     * @param isHttpsFilteringEnabled Whether HTTPS filtering is enabled.
     */
    setHttpsFiltering = async (isHttpsFilteringEnabled: boolean): Promise<void> => {
        this.isHttpsFilteringEnabled = isHttpsFilteringEnabled;
        await this.setFilteringStatus();
        this.reloadPageAfterSwitcherTransition();
    };

    /**
     * Applies the filtering status for the current tab.
     * @param isFilteringEnabled Whether filtering is enabled.
     */
    setFiltering = async (isFilteringEnabled: boolean): Promise<void> => {
        this.isFilteringEnabled = isFilteringEnabled;
        await this.setFilteringStatus();
        this.reloadPageAfterSwitcherTransition();
    };

    /**
     * Sets whether the application is installed.
     * @param isInstalled Whether the application is installed.
     */
    setInstalled = (isInstalled: boolean): void => {
        this.isInstalled = isInstalled;
    };

    /**
     * Updates the filtering state of the current url.
     * @param currentFilteringState Filtering state to apply.
     */
    setUrlFilteringState = (currentFilteringState: CurrentFilteringState | null): void => {
        if (!currentFilteringState) {
            return;
        }

        const {
            isFilteringEnabled,
            isHttpsFilteringEnabled,
            originalCertStatus,
            isPageFilteredByUserFilter,
            originalCertIssuer,
            canChangeFilteringStatus,
        } = currentFilteringState;

        this.isFilteringEnabled = isFilteringEnabled;
        this.isHttpsFilteringEnabled = isHttpsFilteringEnabled;
        // Indexing cast mirrors the PROTOCOLS lookup in lib/helpers: the
        // app's raw cert-status string is uppercased into the status map
        this.originalCertStatus = ORIGINAL_CERT_STATUS[
            originalCertStatus.toUpperCase() as keyof typeof ORIGINAL_CERT_STATUS
        ];
        this.originalCertIssuer = originalCertIssuer;
        this.isPageFilteredByUserFilter = isPageFilteredByUserFilter;
        this.canChangeFilteringStatus = canChangeFilteringStatus;
    };

    /**
     * Applies the given app state to the store.
     * @param appState App state to apply.
     */
    setCurrentAppState = (appState: AppState): void => {
        const {
            isInstalled,
            isRunning,
            isProtectionEnabled,
            isLicenseExpired,
            locale,
            isAuthorized,
        } = appState;
        this.isInstalled = isInstalled;
        this.isProtectionEnabled = isProtectionEnabled;
        this.isLicenseExpired = isLicenseExpired;
        this.isRunning = isRunning;
        this.isAuthorized = isAuthorized;
        this.rootStore.translationStore.setLocale(locale);
    };

    /**
     * Checks whether the application is fully working on the current tab.
     * @returns True if every required app state flag is set.
     */
    get isAppWorking(): boolean {
        return [
            this.isInstalled,
            this.isRunning,
            this.isProtectionEnabled,
            this.isAppUpToDate,
            this.isValidatedOnHost,
        ].every((state) => state === true);
    }

    /**
     * Opens the extension download page.
     */
    updateExtension = (): void => {
        tabs.openPage(EXTENSION_DOWNLOAD_LINK);
    };

    /**
     * Starts assistant.
     */
    initAssistant = async (): Promise<void> => {
        const tab = await this.getCurrentTab();
        await messagesSender.initAssistant(tab.id);
        window.close();
    };

    /**
     * Switches protection status.
     * @param isEnabled Whether the protection should be enabled.
     */
    setProtectionStatus = async (isEnabled: boolean): Promise<void> => {
        const { uiStore } = this.rootStore;
        try {
            uiStore.setExtensionPending(true);
            const tab = await this.getCurrentTab();
            const appState = await messagesSender.setProtectionStatus(isEnabled);
            const urlFilteringState = await messagesSender.getUrlFilteringState(tab);
            runInAction(async () => {
                this.setCurrentAppState(appState);
                this.setUrlFilteringState(urlFilteringState);
                uiStore.setExtensionPending(false);
            });
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Returns the prepared data of the current tab.
     * @returns The prepared current tab data.
     */
    getCurrentTab = async (): Promise<PreparedTab> => {
        const tab = await tabs.getCurrentTab();
        runInAction(() => {
            // update current url just in case; the cast keeps today's
            // runtime unchanged when the tab has no url
            this.currentUrl = tab.url as string;
        });
        return tab;
    };

    /**
     * Opens the filtering log and closes the popup.
     */
    openFilteringLog = async (): Promise<void> => {
        try {
            await messagesSender.openFilteringLog();
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Reports the current site and closes the popup.
     */
    reportSite = async (): Promise<void> => {
        try {
            await messagesSender.reportSite(this.currentUrl, this.referrer);
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Opens the support page and closes the popup.
     */
    contactSupport = async (): Promise<void> => {
        try {
            await tabs.openPage(SUPPORT_LINK);
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Removes custom rules for the current url.
     */
    removeCustomRules = async (): Promise<void> => {
        const { uiStore } = this.rootStore;
        try {
            uiStore.setExtensionPending(true);
            const tab = await this.getCurrentTab();
            await messagesSender.removeCustomRules(this.currentUrl);
            const urlFilteringState = await messagesSender.getUrlFilteringState(tab);
            this.setUrlFilteringState(urlFilteringState);
            uiStore.setExtensionPending(false);

            await this.reloadActiveAndSimilarTabs();
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Opens the settings page and closes the popup.
     */
    openSettings = async (): Promise<void> => {
        try {
            await messagesSender.openSettings();
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Opens the original certificate of the current site.
     */
    openOriginalCert = async (): Promise<void> => {
        const { hostname, port } = getUrlProps(this.currentUrl);

        try {
            await messagesSender.openOriginalCert(hostname, port);
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Toggles the filtering status for the current tab.
     */
    setFilteringStatus = async (): Promise<void> => {
        try {
            await messagesSender.setFilteringStatus(
                this.currentUrl,
                this.isFilteringEnabled,
                this.isHttpsFilteringEnabled,
            );
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Updates the application.
     */
    updateApp = async (): Promise<void> => {
        try {
            await messagesSender.updateApp();
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Starts the application.
     */
    startApp = async (): Promise<void> => {
        try {
            this.rootStore.uiStore.setExtensionPending(true);
            const tab = await this.getCurrentTab();
            const currentFilteringState = await messagesSender.getUrlFilteringState(tab, true);
            const response = await messagesSender.getAppState();
            runInAction(() => {
                this.setUrlFilteringState(currentFilteringState);
                this.setCurrentAppState(response.appState);
                this.setUpdateStatusInfo(response.updateStatusInfo);
                this.rootStore.uiStore.setExtensionPending(false);
            });
        } catch (error) {
            log.error(error);
        }
    };

    /**
     * Pauses filtering for the current tab.
     */
    pauseFiltering = async (): Promise<void> => {
        this.setShowReloadButtonFlag(false);
        const tab = await this.getCurrentTab();
        await messagesSender.pauseFiltering(tab);
        const filteringStatus = await messagesSender.getUrlFilteringState(tab);
        this.setUrlFilteringState(filteringStatus);
    };

    /**
     * Checks whether the host reported an error.
     * @returns True if a host error is present.
     */
    get hasHostError(): boolean {
        return this.hostError !== null;
    }
}

export default SettingsStore;
