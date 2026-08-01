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

class SettingsStore {
    rootStore: RootStore;

    currentUrl = '';

    currentTitle = '';

    referrer = '';

    originalCertIssuer = '';

    isPageFilteredByUserFilter = false;

    isHttpsFilteringEnabled = false;

    isFilteringEnabled = false;

    canChangeFilteringStatus = true;

    isInstalled = false;

    isRunning = false;

    isProtectionEnabled = false;

    isLicenseExpired = false;

    originalCertStatus = ORIGINAL_CERT_STATUS.VALID;

    isAppUpToDate = false;

    isValidatedOnHost = false;

    isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;

    isAuthorized = false;

    hostError: string | null = null;

    filteringPauseTimeout = 0;

    isFilteringPauseSupported = false;

    showReloadButtonFlag = false;

    consentRequired = true;

    loadingConsent = true;

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
            filteringPauseTimeout: observable,
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
            setFilteringPauseTimeout: action,
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

    get filteringPauseTimer(): string {
        const filteringPauseTimeoutSec = (this.filteringPauseTimeout / 1000).toString(10);
        return `00:${filteringPauseTimeoutSec.padStart(2, '0')}`;
    }

    get shouldShowFilteringPauseTimer(): boolean {
        return this.filteringPauseTimeout > 0;
    }

    get currentTabHostname(): string {
        return getUrlProps(this.currentUrl).hostname || this.currentUrl;
    }

    get currentPort(): number {
        return getUrlProps(this.currentUrl).port;
    }

    get currentProtocol() {
        const { protocol } = getUrlProps(this.currentUrl);
        return getFormattedProtocol(protocol);
    }

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

    get pageInfo(): string {
        return this.pageProtocol.isExtension ? this.currentTitle : this.currentTabHostname;
    }

    setFilteringPauseSupported = (isFilteringPauseSupported: boolean): void => {
        this.isFilteringPauseSupported = isFilteringPauseSupported;
    };

    setFilteringPauseTimeout = async (filteringPauseTimeout: number): Promise<void> => {
        runInAction(() => {
            this.filteringPauseTimeout = filteringPauseTimeout;
        });
        const tab = await this.getCurrentTab();
        await this.updatePopupData(tab);
    };

    setShowReloadButtonFlag = (showReloadButtonFlag: boolean): void => {
        this.showReloadButtonFlag = showReloadButtonFlag;
    };

    setUpdateStatusInfo = (statusInfo: UpdateStatusInfo): void => {
        const { isAppUpToDate, isValidatedOnHost } = statusInfo;

        this.isAppUpToDate = isAppUpToDate;
        this.isValidatedOnHost = isValidatedOnHost;
    };

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

    setConsentRequired = (consentRequired: boolean): void => {
        this.loadingConsent = false;
        this.consentRequired = consentRequired;
    };

    setLoadingConsent = (state: boolean): void => {
        this.loadingConsent = state;
    };

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

    openDownloadPage = async (): Promise<void> => {
        await tabs.openPage(DOWNLOAD_LINK);
    };

    /**
     * Reloads current tab
     */
    reloadCurrentTab = async (): Promise<void> => {
        const tab = await tabs.getCurrentTab();
        await tabs.reloadTab(tab);
    };

    /**
     * Reloads active and similar tabs
     */
    reloadActiveAndSimilarTabs = async (): Promise<void> => {
        const tabsToReload = await tabs.getActiveAndSimilarTabs();
        tabsToReload.forEach((tab) => {
            tabs.reloadTab(tab);
        });
    };

    reloadPageAfterSwitcherTransition = (): void => {
        setTimeout(async () => {
            await this.reloadActiveAndSimilarTabs();
        }, SWITCHER_TRANSITION_TIME);
    };

    setHttpsFiltering = async (isHttpsFilteringEnabled: boolean): Promise<void> => {
        this.isHttpsFilteringEnabled = isHttpsFilteringEnabled;
        await this.setFilteringStatus();
        this.reloadPageAfterSwitcherTransition();
    };

    setFiltering = async (isFilteringEnabled: boolean): Promise<void> => {
        this.isFilteringEnabled = isFilteringEnabled;
        await this.setFilteringStatus();
        this.reloadPageAfterSwitcherTransition();
    };

    setInstalled = (isInstalled: boolean): void => {
        this.isInstalled = isInstalled;
    };

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

    get isAppWorking(): boolean {
        return [
            this.isInstalled,
            this.isRunning,
            this.isProtectionEnabled,
            this.isAppUpToDate,
            this.isValidatedOnHost,
        ].every((state) => state === true);
    }

    updateExtension = (): void => {
        tabs.openPage(EXTENSION_DOWNLOAD_LINK);
    };

    /**
     * Starts assistant
     */
    initAssistant = async (): Promise<void> => {
        const tab = await this.getCurrentTab();
        await messagesSender.initAssistant(tab.id);
        window.close();
    };

    /**
     * Switches protection status
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

    getCurrentTab = async (): Promise<PreparedTab> => {
        const tab = await tabs.getCurrentTab();
        runInAction(() => {
            // update current url just in case; the cast keeps today's
            // runtime unchanged when the tab has no url
            this.currentUrl = tab.url as string;
        });
        return tab;
    };

    openFilteringLog = async (): Promise<void> => {
        try {
            await messagesSender.openFilteringLog();
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

    reportSite = async (): Promise<void> => {
        try {
            await messagesSender.reportSite(this.currentUrl, this.referrer);
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

    contactSupport = async (): Promise<void> => {
        try {
            await tabs.openPage(SUPPORT_LINK);
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

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

    openSettings = async (): Promise<void> => {
        try {
            await messagesSender.openSettings();
            window.close();
        } catch (error) {
            log.error(error);
        }
    };

    openOriginalCert = async (): Promise<void> => {
        const { hostname, port } = getUrlProps(this.currentUrl);

        try {
            await messagesSender.openOriginalCert(hostname, port);
        } catch (error) {
            log.error(error);
        }
    };

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

    updateApp = async (): Promise<void> => {
        try {
            await messagesSender.updateApp();
        } catch (error) {
            log.error(error);
        }
    };

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

    pauseFiltering = async (): Promise<void> => {
        this.setShowReloadButtonFlag(false);
        const tab = await this.getCurrentTab();
        await messagesSender.pauseFiltering(tab);
        const filteringStatus = await messagesSender.getUrlFilteringState(tab);
        this.setUrlFilteringState(filteringStatus);
    };

    get hasHostError(): boolean {
        return this.hostError !== null;
    }
}

export default SettingsStore;
