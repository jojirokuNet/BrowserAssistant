import browser from 'webextension-polyfill';
import { nanoid } from 'nanoid';

import { log } from '../../lib/logger';
import versions from '../versions';
import {
    ADG_PREFIX,
    ASSISTANT_TYPES,
    CUSTOM_REQUEST_PREFIX,
    HOST_TYPES,
    REQUEST_TYPES,
} from '../../lib/types';
import { consent } from '../consent';
import { getErrorMessage } from '../../lib/errors';

import AbstractApi, {
    InitMessageHandler,
    InitParams,
    MessageListener,
    RequestParams,
} from './AbstractApi';

/**
 * Module implements methods used to communicate with native host via native messaging
 * https://developer.chrome.com/apps/nativeMessaging
 */
export class NativeHostApi extends AbstractApi {
    listeners: MessageListener[] = [];

    port!: browser.Runtime.Port;

    initMessageHandler!: InitMessageHandler;

    constructor(nativeHostMessagesHandler: MessageListener, initMessageHandler: InitMessageHandler) {
        super();
        this.initModule(nativeHostMessagesHandler, initMessageHandler);
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
        log.debug(`Received response: ${incomingMessage.requestId}`, incomingMessage);

        // Ignore requests without identifying prefix ADG
        if (!incomingMessage.requestId.startsWith(ADG_PREFIX)) {
            return;
        }

        // Ignore requests with single request prefix, they have their own handlers
        if (incomingMessage.requestId.includes(CUSTOM_REQUEST_PREFIX)) {
            return;
        }

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

    getError = (port: browser.Runtime.Port): string | browser.Runtime.PortErrorType | undefined => {
        return browser.runtime.lastError?.message || port.error;
    };

    disconnectHandler = (port: browser.Runtime.Port): void => {
        const error = this.getError(port);

        if (error) {
            log.error(error);
        }
    };

    /**
     * Connect to the native host
     */
    connect = async (): Promise<void> => {
        log.info('Connecting to the native host');
        // if the extension was connected to the native host in mv3 then it will not die after 30 seconds as usually
        this.port = browser.runtime.connectNative(HOST_TYPES.browserExtensionHost);

        this.port.onMessage.addListener(this.incomingMessageHandler);

        this.port.onDisconnect.addListener(this.disconnectHandler);

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
        this.port.disconnect();
        this.port.onMessage.removeListener(this.incomingMessageHandler);
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
        const isConsentRequired = await consent.isConsentRequired();
        if (isConsentRequired && params.type !== REQUEST_TYPES.init) {
            throw new Error('Requests to native host can be send only after consent agreement received');
        }

        try {
            return await this.makeRequestOnce(params);
        } catch (e) {
            // Prevent reconnection for init requests, to avoid infinite loop, since reconnect calls init request
            // https://github.com/AdguardTeam/BrowserAssistant/issues/115
            if (tryReconnect && params.type !== REQUEST_TYPES.init) {
                log.debug(
                    'Was unable to send request with params:',
                    params,
                    'due to error:',
                    getErrorMessage(e),
                );
                try {
                    await this.reconnect();
                    // After reconnection, retry the request without attempting further reconnections.
                    return await this.makeRequestOnce(params);
                } catch (e) {
                    log.debug('Was unable to reconnect to the native host due to error:', getErrorMessage(e));
                    throw e;
                }
            }
            throw e;
        }
    };

    makeRequestOnce = async (params: RequestParams): Promise<any> => {
        // Requests can be executed too long time on application launch
        const RESPONSE_TIMEOUT_MS = 1000 * 60 * 5;

        const HOST_RESPONSE_TYPES = {
            OK: 'ok',
            ERROR: 'error',
        };

        // Use CUSTOM_REQUEST_PREFIX in order to ignore this requests in the incomingMessageHandler
        const id = `${ADG_PREFIX}_${CUSTOM_REQUEST_PREFIX}_${nanoid()}`;

        log.info(`Sending request: ${id}`, params);

        return new Promise<any>((resolve, reject) => {
            let timerId: ReturnType<typeof setTimeout>;

            const errorHandler = (port: browser.Runtime.Port): void => {
                const error = this.getError(port);

                if (error) {
                    reject(error);
                }
            };

            const messageHandler = (message: any): void => {
                const { requestId, result } = message;

                if (id === requestId) {
                    this.port.onMessage.removeListener(messageHandler);
                    this.port.onDisconnect.removeListener(errorHandler);
                    clearTimeout(timerId);

                    if (result === HOST_RESPONSE_TYPES.OK) {
                        resolve(message);
                        return;
                    }

                    if (result === HOST_RESPONSE_TYPES.ERROR) {
                        reject(new Error(`Native host responded with message: ${message.data}.`));
                    }
                }
            };

            this.port.onMessage.addListener(messageHandler);
            this.port.onDisconnect.addListener(errorHandler);

            timerId = setTimeout(() => {
                this.port.onMessage.removeListener(messageHandler);
                this.port.onDisconnect.removeListener(errorHandler);
                reject(new Error('Native host is not responding too long'));
            }, RESPONSE_TIMEOUT_MS);

            try {
                this.port.postMessage({ id, ...params });
            } catch (e) {
                reject(e);
            }
        });
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

    /**
     * Sets protections status of the app
     */
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

    addRule = (ruleText: string): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.addRule,
        parameters: { ruleText },
    });

    removeCustomRules = (url: string): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.removeCustomRules,
            parameters: { url },
        });
    };

    openOriginalCert = (domain: string, port: number): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.openOriginalCert,
        parameters: { domain, port },
    });

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
