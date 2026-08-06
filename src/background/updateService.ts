/**
 * @file Tracks extension install and update events with their versions.
 */
import browser from 'webextension-polyfill';

import { log } from '../lib/logger';
import { APP_VERSION_KEY } from '../lib/types';

import { storage } from './storage';
import { localStorage } from './localStorage';

/**
 * Versions resolved from the runtime.onInstalled event.
 */
interface InstalledEventVersions {
    currentVersion: string;
    previousVersion: string | undefined;
}

/**
 * Install/update run information handed to the onInstalled callback.
 * PreviousVersion is optional to match the shape index.ts declares.
 */
interface RunInfo {
    currentVersion: string;
    previousVersion?: string;
    isFirstRun: boolean;
    isUpdate: boolean;
}

/**
 * Service with data about current app state.
 */
class UpdateService {
    /**
     * Milliseconds to wait for the installed event before falling back to storage.
     */
    WAIT_FROM_INSTALLED_EVENT_TIMEOUT_MS = 50;

    /**
     * Version of the extension after the install or update event.
     */
    currentVersion!: string;

    /**
     * Version of the extension before the install or update event.
     */
    previousVersion!: string | undefined;

    /**
     * Whether the event is the first run of the extension.
     */
    isFirstRun!: boolean;

    /**
     * Whether the event is an extension update.
     */
    isUpdate!: boolean;

    /**
     * OnInstalled doesn't fire event on reload from developers tools
     * that is why we use fallback from storage.
     * @returns Versions from the installed event, or null on timeout.
     */
    getVersionsFromInstalledEvent = async (): Promise<InstalledEventVersions | null> => {
        return new Promise<InstalledEventVersions | null>((resolve) => {
            browser.runtime.onInstalled.addListener((details) => {
                const currentVersion = this.getAppVersionFromManifest();
                const { previousVersion } = details;
                resolve({
                    currentVersion,
                    previousVersion,
                });
            });
            setTimeout(() => {
                resolve(null);
            }, this.WAIT_FROM_INSTALLED_EVENT_TIMEOUT_MS);
        });
    };

    /**
     * Returns the versions stored in the storage.
     * @returns Object with the current and previous versions.
     */
    getVersionInfoFromStorage = async () => {
        const previousVersion = await this.getAppVersionFromStorage();
        const currentVersion = this.getAppVersionFromManifest();
        return {
            currentVersion,
            previousVersion,
        };
    };

    /**
     * Resolves the install run info and invokes the given callback.
     * @param onInstalled Callback invoked with the run info.
     */
    init = async (onInstalled: (runInfo: RunInfo) => void): Promise<void> => {
        let versions = await this.getVersionsFromInstalledEvent();
        if (!versions) {
            versions = await this.getVersionInfoFromStorage();
            log.debug('Versions retrieved from storage', versions);
        } else {
            log.debug('Versions retrieved from installed event', versions);
        }

        this.currentVersion = versions.currentVersion;
        this.previousVersion = versions.previousVersion;

        this.isFirstRun = (this.currentVersion !== this.previousVersion && !this.previousVersion);
        this.isUpdate = !!(this.currentVersion !== this.previousVersion && this.previousVersion);

        await this.setAppVersionInStorage(this.currentVersion);

        const runInfo = {
            currentVersion: this.currentVersion,
            previousVersion: this.previousVersion,
            isFirstRun: this.isFirstRun,
            isUpdate: this.isUpdate,
        };

        onInstalled(runInfo);
    };

    /**
     * Returns the app version from the storage with a localStorage fallback.
     * @returns The stored app version.
     */
    getAppVersionFromStorage = async () => {
        // TODO remove localStorage fallback after some time,
        //  we use it because in the previous version 1.3.13 we used localStorage
        return await storage.get(APP_VERSION_KEY) ?? localStorage.get(APP_VERSION_KEY);
    };

    /**
     * Returns the app version from the extension manifest.
     * @returns The manifest version.
     */
    getAppVersionFromManifest = (): string => {
        return browser.runtime.getManifest().version;
    };

    /**
     * Stores the given app version in the storage.
     * @param appVersion App version to store.
     * @returns Promise resolved when the version is stored.
     */
    setAppVersionInStorage = async (appVersion: string): Promise<void> => {
        return storage.set(APP_VERSION_KEY, appVersion);
    };
}

export const updateService = new UpdateService();
