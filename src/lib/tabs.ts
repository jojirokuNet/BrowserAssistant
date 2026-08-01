import browser, { Tabs } from 'webextension-polyfill';

import { log } from './logger';

export type PreparedTab = {
    url?: string;
    id?: number;
    title?: string;
};

/**
 * Extracts only usable data from tab
 */
const prepareTab = (tab: Tabs.Tab): PreparedTab => {
    const { url, id, title } = tab;
    return {
        url,
        id,
        title,
    };
};

/**
 * Returns current tab
 * Call from browser action popup in order to get correct tab
 */
const getCurrentTab = async (): Promise<PreparedTab> => {
    const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
    });
    return prepareTab(tabs[0]);
};

/**
 * Returns all active tabs
 */
const getActiveTabs = async (): Promise<PreparedTab[]> => {
    const activeTabs = await browser.tabs.query({ active: true });
    return activeTabs.map((tab) => prepareTab(tab));
};

/**
 * Returns active tab
 */
const getActiveTab = async (): Promise<PreparedTab> => {
    const [tab] = await getActiveTabs();
    return tab;
};

/**
 * Returns all tabs with hostname similar to current active tab
 */
const getActiveAndSimilarTabs = async (): Promise<PreparedTab[]> => {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!activeTab) {
        log.debug('Unable to get active tab');
        return [];
    }

    const { url } = activeTab;
    if (!url) {
        log.debug('Active tab has no url');
        return [];
    }
    const urlObject = new URL(url);
    const { origin } = urlObject;

    const allTabs = await browser.tabs.query({});
    return allTabs
        .filter((tab) => (tab.url as string).startsWith(origin))
        .map((tab) => prepareTab(tab));
};

/**
 * Opens required url
 */
const openPage = async (url: string): Promise<void> => {
    if (!url) {
        throw new Error(`Open page requires url, received, ${url}`);
    }
    await browser.tabs.create({ url });
};

/**
 * Reloads required tab
 */
const reloadTab = async (tab: PreparedTab): Promise<void> => {
    try {
        await browser.tabs.reload(tab.id);
    } catch (error) {
        log.error(error);
    }
};

/**
 * Opens postinstall page
 */
const openPostInstallPage = async (): Promise<void> => {
    const postInstallPageUrl = browser.runtime.getURL('post-install.html');
    await openPage(postInstallPageUrl);
};

/**
 * Closes post install page if found
 */
const closePostInstall = async (): Promise<void> => {
    const postInstallPageUrl = browser.runtime.getURL('post-install.html');
    const tabs = await browser.tabs.query({});
    const postInstallTabs = tabs.filter((tab) => tab.url?.includes(postInstallPageUrl));
    postInstallTabs.forEach((tab) => {
        browser.tabs.remove(tab.id as number);
    });
};

export const tabs = {
    prepareTab,
    getCurrentTab,
    getActiveTabs,
    getActiveTab,
    getActiveAndSimilarTabs,
    openPage,
    reloadTab,
    openPostInstallPage,
    closePostInstall,
};
