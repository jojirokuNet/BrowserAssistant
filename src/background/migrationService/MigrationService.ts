/**
 * @file Migrates stored data between extension versions.
 */
import { compare } from 'compare-versions';

import { localStorage } from '../localStorage';
import { storage } from '../storage';
import { log } from '../../lib/logger';
import { consent } from '../consent';
import { browserApi } from '../../lib/browserApi';
import { APP_VERSION_KEY } from '../../lib/types';

const FIREFOX_CONSENT_MIGRATION_VERSION = '1.2.2';
const STORAGE_DATA_MIGRATION_VERSION = '1.3.15';

/**
 * Migrates stored data when the extension updates to a newer version.
 */
export class MigrationService {
    /**
     * Runs the storage migrations required between the previous and current version.
     * @param previousVersion Previously stored extension version.
     */
    async migrate(previousVersion: string | undefined) {
        // consent setting moved from local storage to
        // browser storage after version 1.2.2 in firefox only
        // (the `as string` casts keep today's runtime: compare receives
        // exactly what it received before)
        if (browserApi.utils.isFirefoxBrowser
            && compare(previousVersion as string, FIREFOX_CONSENT_MIGRATION_VERSION, '<=')) {
            await this.storageMigrationForFirefox();
        }

        if (compare(previousVersion as string, STORAGE_DATA_MIGRATION_VERSION, '<=')) {
            await this.localStorageDataMigration();
        }
    }

    /**
     * Migration from local storage to browser storage.
     */
    storageMigrationForFirefox = async () => {
        // The consent key exists only on the Firefox implementation (it
        // is `declare`d on the abstract class for this Firefox-only
        // path); the localStorage mock returns undefined today — the
        // casts preserve the exact runtime flow.
        const isConsentRequired = JSON.parse(
            localStorage.get(consent.CONSENT_REQUIRED_STORAGE_KEY as string) as string,
        );
        if (isConsentRequired !== undefined) {
            log.debug('Migrate consent setting from local storage to browser storage');
            await consent.setConsentRequired(isConsentRequired);
        }
    };

    /**
     * Migrates data from local storage to browser storage.
     * There is only app version data to migrate.
     */
    localStorageDataMigration = async () => {
        const appVersion = localStorage.get(APP_VERSION_KEY);
        await storage.set(APP_VERSION_KEY, appVersion);
        log.debug('App version data migrated from local storage to browser storage');
    };
}
