import browser from 'webextension-polyfill';

import { lazyGet } from '../helpers';

type BrowserName = 'YaBrowser' | 'EdgeChromium' | 'Opera' | 'Firefox' | 'Chrome';

interface Utils {
    readonly browser: BrowserName;
    readonly isFirefoxBrowser: boolean;
    isVivaldiPromise?: Promise<boolean>;
    isVivaldiBrowser(): Promise<boolean>;
}

export const utils: Utils = {
    get browser() {
        return lazyGet(utils, 'browser', () => {
            let browserName: BrowserName;
            let { userAgent } = navigator;
            userAgent = userAgent.toLowerCase();
            if (userAgent.indexOf('yabrowser') >= 0) {
                browserName = 'YaBrowser';
            } else if (userAgent.indexOf('edg') >= 0) {
                browserName = 'EdgeChromium';
            } else if (userAgent.indexOf('opera') >= 0
                || userAgent.indexOf('opr') >= 0) {
                browserName = 'Opera';
            } else if (userAgent.indexOf('firefox') >= 0) {
                browserName = 'Firefox';
            } else {
                browserName = 'Chrome';
            }
            return browserName;
        });
    },

    get isFirefoxBrowser() {
        return this.browser === 'Firefox';
    },

    /**
     * Method to detect if browser is vivaldi.
     */
    async isVivaldiBrowser() {
        if (this.isVivaldiPromise === undefined) {
            this.isVivaldiPromise = new Promise<boolean>(async (resolve) => {
                try {
                    const tabs = await browser.tabs.query({});
                    if (tabs.length > 0 && Object.prototype.hasOwnProperty.call(tabs[0], 'vivExtData')) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    console.error('Error querying tabs:', error);
                    resolve(false);
                }
            });
        }
        return this.isVivaldiPromise;
    },
};
