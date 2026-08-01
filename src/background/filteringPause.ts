import { FILTERING_PAUSE_VERSION_SUPPORT_SINCE } from '../lib/consts';
import { compareSemver, getUrlProperties } from '../lib/helpers';
import notifier from '../lib/notifier';

import { longLivedMessageService } from './longLivedMessageService';
import state from './state';

const FILTERING_PAUSE_TIMEOUT_MS = 30000;
const FILTERING_PAUSE_TIMER_TICK_MS = 1000;

/**
 * Handles filtering pause after the popup button "Do not filter for 30 seconds" is clicked
 */
class FilteringPause {
    hostnameToTimeoutMap: Record<string, number> = {};

    getUrlHostname = (url: string | undefined): string => {
        // The casts keep today's runtime unchanged: getUrlProperties
        // receives the url exactly as before (valid or not), and returns
        // a URL for valid input — the same `as URL` pattern helpers.ts
        // itself uses in getUrlProps.
        return (getUrlProperties(url as string) as URL).hostname;
    };

    setHostnameTimeout = (url: string | undefined, timeout: number): void => {
        const hostname = this.getUrlHostname(url);
        this.hostnameToTimeoutMap[hostname] = timeout;
    };

    getHostnameTimeout = (url: string | undefined): number | undefined => {
        const hostname = this.getUrlHostname(url);
        return this.hostnameToTimeoutMap[hostname];
    };

    deleteHostnameTimeout = (url: string | undefined): void => {
        const hostname = this.getUrlHostname(url);
        delete this.hostnameToTimeoutMap[hostname];
    };

    resetHostnameTimeout = (url: string | undefined): void => {
        this.setHostnameTimeout(url, 0);
    };

    resetAllHostnameTimeout = (): void => {
        this.hostnameToTimeoutMap = Object.keys(this.hostnameToTimeoutMap)
            .reduce((acc: Record<string, number>, hostname) => {
                acc[hostname] = 0;
                return acc;
            }, {});
    };

    clearHostnameTimeout = async (url: string | undefined): Promise<void> => {
        this.resetHostnameTimeout(url);
        this.notifyPopup();
        this.deleteHostnameTimeout(url);
    };

    isFilteringPauseSupported = (): boolean => {
        const { version, platform } = state.hostInfo;
        if (!platform) {
            return false;
        }
        // A runtime platform string cannot index the two-key const
        // object without this widening cast; behavior unchanged.
        const supportSince = FILTERING_PAUSE_VERSION_SUPPORT_SINCE as Record<string, string>;
        const minSupportVersion = supportSince[platform.toUpperCase()];
        return compareSemver(version, minSupportVersion) >= 0;
    };

    showReloadButtonFlag = (url: string | undefined): boolean => {
        const timeout = this.getHostnameTimeout(url);

        if (timeout === undefined) {
            return false;
        }

        return timeout < 0;
    };

    notifyPopup = (): void => {
        longLivedMessageService.notifyPopupFilteringPauseTimeout(this.hostnameToTimeoutMap);
    };

    handleFilteringPause = async (url: string | undefined): Promise<void> => {
        if (!this.isFilteringPauseSupported()) {
            return;
        }

        this.setHostnameTimeout(url, FILTERING_PAUSE_TIMEOUT_MS);
        // state.pauseFiltering expects a string; today's callers can pass
        // undefined (PreparedTab.url) — the cast keeps that flow.
        await state.pauseFiltering(url as string, (FILTERING_PAUSE_TIMEOUT_MS / 1000).toString());

        const timerId = setInterval(async () => {
            const timeout = this.getHostnameTimeout(url);

            // The undefined check below intentionally runs after this
            // comparison (today `undefined < 0` is false) — the cast
            // preserves the original evaluation order.
            if ((timeout as number) < 0) {
                // Notify to toggle the icon to the enabled state
                notifier.notifyListeners(notifier.types.STATE_UPDATED);
                clearTimeout(timerId);
            }

            if (timeout === undefined) {
                clearTimeout(timerId);
                return;
            }

            this.notifyPopup();

            this.setHostnameTimeout(url, timeout - FILTERING_PAUSE_TIMER_TICK_MS);
        }, FILTERING_PAUSE_TIMER_TICK_MS);
    };
}

const filteringPause = new FilteringPause();

export default filteringPause;
