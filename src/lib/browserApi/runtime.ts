import browser from 'webextension-polyfill';

/**
 * This function moved into separate nativeHostApi file, in order to hide unhandled promise errors
 */
// eslint-disable-next-line consistent-return
const sendMessage = async (...args: any[]): Promise<any> => {
    try {
        return await browser.runtime.sendMessage(...(args as [any, any?]));
    } catch (error) {
        // eslint-disable-next-line no-void
        void browser.runtime.lastError;
    }
};

export const getUrl = (url: string): string => browser.runtime.getURL(url);

export const runtime = {
    sendMessage,
};
