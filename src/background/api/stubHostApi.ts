import { nanoid } from 'nanoid';

import { log } from '../../lib/logger';
import versions from '../versions';
import {
    ADG_PREFIX,
    ASSISTANT_TYPES,
    CUSTOM_REQUEST_PREFIX,
    REQUEST_TYPES,
} from '../../lib/types';

import AbstractApi, {
    InitMessageHandler,
    InitParams,
    MessageListener,
    RequestParams,
} from './AbstractApi';

let hostData = {
    result: 'ok',
    version: '7.3.2496',
    apiVersion: '3',
    isValidatedOnHost: true,
    reportUrl: 'https://link.adtidy.org/forward.html?action=report&from=popup&app=browser_assistant&url=http://example.org',
    appState: {
        isRunning: true,
        isProtectionEnabled: true,
        isLicenseExpired: false,
        isInstalled: true,
        isAuthorized: true,
        locale: 'ru',
    },
    currentFilteringState: {
        isFilteringEnabled: true,
        isHttpsFilteringEnabled: true,
        isPageFilteredByUserFilter: false,
        blockedAdsCount: 180,
        totalBlockedCount: 1234,
        originalCertIssuer: 'RapidSSL RSA CA',
        originalCertStatus: 'valid',
    },
};

type StubCallback = (prop: string, value: any) => void;

const observer = (() => {
    const callbacks: StubCallback[] = [];
    const subscribe = (cb: StubCallback): void => {
        if (callbacks.includes(cb)) {
            return;
        }
        callbacks.push(cb);
    };

    const notify = (prop: string, value: any): void => {
        callbacks.forEach((cb) => {
            cb(prop, value);
        });
    };

    /**
     * Checks if value isPrimitive
     */
    const isPrimitive = (value: unknown): boolean => {
        return (value !== Object(value));
    };

    /**
     * Traces sets to the properties in the object
     */
    const traceChanges = (obj: any): any => {
        // eslint-disable-next-line no-restricted-syntax
        for (const key of Object.keys(obj)) {
            if (!isPrimitive(obj[key])) {
                // eslint-disable-next-line no-param-reassign
                obj[key] = traceChanges(obj[key]);
            }
        }

        const handler = {
            // The set trap intentionally returns nothing (preserved from
            // the original); `any` satisfies ProxyHandler's boolean
            // return without adding a real return statement.
            set(...args: [any, string, any]): any {
                const [, prop, value] = args;
                notify(prop, value);
                Reflect.set(...args);
            },
        };

        return new Proxy(obj, handler);
    };

    return {
        subscribe,
        notify,
        traceChanges,
    };
})();

declare const global: Record<string, unknown>;

hostData = observer.traceChanges(hostData);
global.hostData = hostData;

/**
 * Async function waiting for timeout
 */
const sleep = (timeout: number): Promise<void> => {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
};

/**
 * Generates response similar to the real native host response
 * async - boolean flag to generate non async response,
 *  used to handle subscribed changes
 */
const generateResponse = async (type: string, async = true): Promise<any> => {
    if (async) {
        await sleep(500);
    }

    const response = {
        id: nanoid(),
    };

    switch (type) {
        case REQUEST_TYPES.init: {
            return {
                ...response,
                appState: hostData.appState,
                parameters: {
                    version: hostData.version,
                    apiVersion: hostData.apiVersion,
                    isValidatedOnHost: hostData.isValidatedOnHost,
                },
            };
        }
        case REQUEST_TYPES.getCurrentAppState: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.getCurrentFilteringState: {
            return {
                ...response,
                appState: hostData.appState,
                parameters: hostData.currentFilteringState,
            };
        }
        case REQUEST_TYPES.setProtectionStatus: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.setFilteringStatus: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.addRule: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        // REQUEST_TYPES has no `removeRule` member, so this case evaluates
        // to `undefined` and is unreachable for real requests — a
        // pre-existing quirk preserved via the cast, not fixed.
        case (REQUEST_TYPES as Record<string, string | undefined>).removeRule: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.removeCustomRules: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.openOriginalCert: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.reportSite: {
            return {
                ...response,
                parameters: {
                    reportUrl: hostData.reportUrl,
                },
            };
        }
        case REQUEST_TYPES.openFilteringLog: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.openSettings: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.updateApp: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        case REQUEST_TYPES.pauseFiltering: {
            return {
                ...response,
                appState: hostData.appState,
            };
        }
        default:
            log.error(`Incorrect request type received: "${type}"`);
            throw new Error(`Incorrect request type received: "${type}"`);
    }
};

export class StubHostApi extends AbstractApi {
    listeners: MessageListener[] = [];

    initMessageHandler!: InitMessageHandler;

    constructor(nativeHostMessagesHandler: MessageListener, initMessageHandler: InitMessageHandler) {
        super();
        this.initModule(nativeHostMessagesHandler, initMessageHandler);
        // add stubHostApi to global to debug via background page's console
        global.stubHostApi = this;
    }

    async initModule(
        nativeHostMessagesHandler: MessageListener,
        initMessageHandler: InitMessageHandler,
    ): Promise<void> {
        this.addMessageListener(nativeHostMessagesHandler);
        this.addInitMessageHandler(initMessageHandler);
        try {
            await this.connect();
        } catch (e) {
            log.debug(e);
        }
    }

    /**
     * Distributes messages to the listeners
     */
    incomingMessageHandler = async (incomingMessage: any): Promise<void> => {
        log.debug(`response ${incomingMessage.id}`, incomingMessage);

        // Call listener callbacks
        if (this.listeners.length > 0) {
            this.listeners.forEach((listener) => {
                listener.call(null, incomingMessage);
            });
        }
    };

    /**
     * Adds listener to the listeners list
     */
    addMessageListener = (listener: MessageListener): void => {
        this.listeners = [...this.listeners, listener];
    };

    /**
     * Removes listener from listeners list
     */
    removeMessageListener = (listener: MessageListener): void => {
        this.listeners = this.listeners.filter((l) => l !== listener);
    };

    /**
     * Is called on connection or reconnection
     */
    addInitMessageHandler = (handler: InitMessageHandler): void => {
        this.initMessageHandler = handler;
    };

    /**
     * Connect to the native host
     */
    connect = async (): Promise<void> => {
        observer.subscribe(async () => {
            const message = await generateResponse(REQUEST_TYPES.getCurrentAppState, false);
            this.incomingMessageHandler(message);
        });
        await this.sendInitialRequest(false);
    };

    sendInitialRequest = async (shouldReconnect: boolean): Promise<void> => {
        const { version, apiVersion, userAgent } = versions;
        const response = await this.init({ version, userAgent, apiVersion }, shouldReconnect);
        this.initMessageHandler(response);
    };

    /**
     * Disconnect from the native host
     */
    disconnect = (): void => {
        log.debug('Disconnecting from native host');
    };

    /**
     * Reconnect to the native host
     */
    reconnect = async (): Promise<void> => {
        log.debug('Trying to reconnect to native host...');
        this.disconnect();
        await this.connect();
    };

    /**
     * Makes request with reconnection by default
     * tryReconnect - by default function retries to reconnect
     */
    makeRequest = async (params: RequestParams, tryReconnect = true): Promise<any> => {
        try {
            return await this.makeRequestOnce(params);
        } catch (e) {
            if (tryReconnect) {
                log.debug('Was unable to send request');
                try {
                    await this.reconnect();
                    return await this.makeRequestOnce(params);
                } catch (e) {
                    log.debug('Was unable to reconnect to the native host');
                    throw e;
                }
            }
            throw (e);
        }
    };

    makeRequestOnce = async (params: RequestParams): Promise<any> => {
        const id = `${ADG_PREFIX}_${CUSTOM_REQUEST_PREFIX}_${nanoid()}`;
        log.info(`Sending request: ${id}`, params);
        const { type } = params;
        return generateResponse(type);
    };

    /**
     * Sends initial request to the native host
     */
    init = ({ version, userAgent, apiVersion }: InitParams, tryReconnect = false): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.init,
            parameters: {
                version,
                apiVersion,
                userAgent,
                type: ASSISTANT_TYPES.nativeAssistant,
            },
        }, tryReconnect);
    };

    /**
     * Returns current app state
     */
    getCurrentAppState = async (): Promise<any> => {
        const response = await this.makeRequest({
            type: REQUEST_TYPES.getCurrentAppState,
        });
        if (!response || !response.appState) {
            throw new Error('Wrong data scheme received');
        }
        return response.appState;
    };

    /**
     * Returns filtering state for url, used to get state of current tab
     */
    getCurrentFilteringState = (url: string, port: number, forceStartApp = false): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.getCurrentFilteringState,
            parameters: { url, port, forceStartApp },
        });
    };

    setProtectionStatus = (isEnabled: boolean): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.setProtectionStatus,
        parameters: { isEnabled },
    });

    /**
     * Sets filtering status
     */
    setFilteringStatus = (isEnabled: boolean, isHttpsEnabled: boolean, url: string): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.setFilteringStatus,
            parameters: { isEnabled, isHttpsEnabled, url },
        });
    };

    /**
     * Sends request to add rule in the app
     */
    addRule = (ruleText: string): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.addRule,
        parameters: { ruleText },
    });

    /**
     * Sends request to remove all custom rules for the current url
     */
    removeCustomRules = (url: string): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.removeCustomRules,
            parameters: { url },
        });
    };

    /**
     * Sends request to the app to open window with certificate description
     */
    openOriginalCert = (domain: string, port: number): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.openOriginalCert,
        parameters: { domain, port },
    });

    /**
     * Sends request to the app to generate report url
     */
    reportSite = (url: string, referrer: string): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.reportSite,
        parameters: {
            url,
            referrer,
            userAgent: versions.userAgent,
        },
    });

    /**
     * Sends message to open filtering log
     */
    openFilteringLog = (): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.openFilteringLog,
    });

    /**
     * Sends message to open settings
     */
    openSettings = (): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.openSettings,
    });

    /**
     * Sends message to update app
     */
    updateApp = (): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.updateApp,
    });

    /**
     * Sends message to pause filtering
     */
    pauseFiltering = (url: string, timeout: string): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.pauseFiltering,
        parameters: { url, timeout },
    });
}
