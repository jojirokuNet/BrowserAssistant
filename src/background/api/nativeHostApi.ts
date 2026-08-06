/**
 * @file Native messaging implementation of the host API.
 */
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
 * Message received from the native host.
 */
type NativeHostMessage = {
    /**
     * Identifier used to correlate a response with its request.
     */
    requestId?: string;

    /**
     * Describes whether the native-host request succeeded.
     */
    result?: string;

    /**
     * Carries the native-host response payload.
     */
    data?: unknown;
};

/**
 * Rejects a pending request after its owning port becomes unavailable.
 * @param message Diagnostic used to reject the request.
 */
type PendingRequestAbort = (message: string) => void;

/**
 * Handles a message emitted by a native messaging port.
 * @param message Native-host message to handle.
 */
type PortMessageHandler = (message: NativeHostMessage) => void;

/**
 * Resources owned by a native messaging port.
 */
type PortState = {
    /**
     * Listener registered for messages from the port.
     */
    messageHandler: PortMessageHandler;

    /**
     * Callbacks that reject requests still waiting on the port.
     */
    pendingRequests: Set<PendingRequestAbort>;
};

/**
 * Native-host response statuses.
 */
const HOST_RESPONSE_TYPES = {
    OK: 'ok',
    ERROR: 'error',
} as const;

/**
 * Internal transport diagnostics used to reject promises and write logs.
 * The popup only checks whether a host error exists, so these are not user-facing strings.
 */
const NATIVE_HOST_ERRORS = {
    PORT_DISCONNECTED: 'Native host port disconnected',
    PORT_DISCONNECTED_DURING_INIT: 'Native host port disconnected during initialization',
    CONNECTION_REPLACED: 'Native host connection was replaced',
    PORT_NOT_CONNECTED: 'Native host port is disconnected',
    RESPONSE_TIMEOUT: 'Native host is not responding too long',
} as const;

/**
 * Implements communication with the native host through native messaging.
 * Initial connection and reconnect use the same single-flight promise. Every
 * request captures its exact port, so cleanup from an old port cannot affect
 * its replacement.
 */
export class NativeHostApi extends AbstractApi {
    /**
     * Subscribers for unsolicited native-host messages.
     */
    listeners: MessageListener[] = [];

    /**
     * Applies the initialization response after each successful connection.
     */
    initMessageHandler!: InitMessageHandler;

    /**
     * Currently active native messaging port.
     */
    port: browser.Runtime.Port | null = null;

    /**
     * Shared initial-connection or reconnect operation awaited by ordinary requests.
     */
    connectionPromise: Promise<browser.Runtime.Port | null> | null = null;

    /**
     * Per-port listeners and pending request abort callbacks.
     */
    portStates: WeakMap<browser.Runtime.Port, PortState> = new WeakMap();

    /**
     * Publishes a connection operation as the current single-flight promise.
     * An older operation cannot clear a newer one when it settles.
     * @param promise Connection operation to publish.
     * @returns The published connection operation.
     */
    trackConnection = (
        promise: Promise<browser.Runtime.Port | null>,
    ): Promise<browser.Runtime.Port | null> => {
        this.connectionPromise = promise;

        // A settled older connection must not clear a newer single-flight operation.
        const clear = () => {
            if (this.connectionPromise === promise) {
                this.connectionPromise = null;
            }
        };
        promise.then(clear, clear);

        return promise;
    };

    /**
     * Creates the API and starts its initial native-host connection.
     * @param nativeHostMessagesHandler Listener for messages from the native host.
     * @param initMessageHandler Handler for the init message response.
     */
    constructor(nativeHostMessagesHandler: MessageListener, initMessageHandler: InitMessageHandler) {
        super();
        this.trackConnection(this.initModule(nativeHostMessagesHandler, initMessageHandler));
    }

    /**
     * Registers native-host handlers and opens the initial connection.
     * Initial failure is logged and represented by a resolved null port so a later request can retry.
     * @param nativeHostMessagesHandler Listener for messages from the native host.
     * @param initMessageHandler Handler for the init message response.
     * @returns The initialized port, or null when the initial connection fails.
     */
    async initModule(
        nativeHostMessagesHandler: MessageListener,
        initMessageHandler: InitMessageHandler,
    ): Promise<browser.Runtime.Port | null> {
        this.addMessageListener(nativeHostMessagesHandler);
        this.addInitMessageHandler(initMessageHandler);
        try {
            return await this.connect();
        } catch (e) {
            log.debug(getErrorMessage(e));
            return null;
        }
    }

    /**
     * Distributes messages to the listeners.
     * @param incomingMessage Message received from the native host.
     */
    incomingMessageHandler = async (incomingMessage: NativeHostMessage): Promise<void> => {
        const requestId = incomingMessage?.requestId;
        log.debug(`Received response: ${requestId}`, incomingMessage);

        // Ignore requests without identifying prefix ADG
        if (typeof requestId !== 'string' || !requestId.startsWith(ADG_PREFIX)) {
            return;
        }

        // Ignore requests with single request prefix, they have their own handlers
        if (requestId.includes(CUSTOM_REQUEST_PREFIX)) {
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
     * Adds listener to the listeners list.
     * @param listener Listener to add.
     */
    addMessageListener = (listener: MessageListener): void => {
        this.listeners = [...this.listeners, listener];
    };

    /**
     * Removes listener from listeners list.
     * @param listener Listener to remove.
     */
    removeMessageListener = (listener: MessageListener): void => {
        this.listeners = this.listeners.filter((l) => l !== listener);
    };

    /**
     * Is called on connection or reconnection.
     * @param handler Handler to call on connection or reconnection.
     */
    addInitMessageHandler = (handler: InitMessageHandler): void => {
        this.initMessageHandler = handler;
    };

    /**
     * Returns a Chromium runtime error or a Firefox native-port error.
     * @param port Port to read the error from.
     * @returns The diagnostic, or undefined when no diagnostic is available.
     */
    getError = (port: browser.Runtime.Port): string | browser.Runtime.PortErrorType | undefined => {
        return browser.runtime.lastError?.message || port.error;
    };

    /**
     * Releases resources owned by a specific port and rejects all of its pending requests.
     * Cleanup is idempotent so stale callbacks cannot affect a replacement port.
     * @param port Port whose resources should be released.
     * @param message Internal rejection reason.
     * @returns Whether the port was still owned and cleaned up.
     */
    cleanupPort = (port: browser.Runtime.Port, message: string): boolean => {
        const state = this.portStates.get(port);
        if (!state) {
            return false;
        }

        // Remove ownership first: abort callbacks may immediately request a reconnect.
        this.portStates.delete(port);
        [...state.pendingRequests].forEach((abort) => abort(message));
        port.onMessage.removeListener(state.messageHandler);
        port.onDisconnect.removeListener(this.disconnectHandler);

        return true;
    };

    /**
     * Handles browser-reported native-port disconnects, including Firefox disconnects
     * that do not provide diagnostic text.
     * @param port Disconnected port.
     */
    disconnectHandler = (port: browser.Runtime.Port): void => {
        if (!this.portStates.has(port)) {
            return;
        }

        const diagnostic = this.getError(port);
        if (diagnostic) {
            log.error(getErrorMessage(diagnostic));
        }

        this.cleanupPort(
            port,
            diagnostic ? getErrorMessage(diagnostic) : NATIVE_HOST_ERRORS.PORT_DISCONNECTED,
        );
    };

    /**
     * Opens and initializes a native-host port, making it active only for this connection attempt.
     * @returns The initialized native messaging port.
     * @throws When the port disconnects or its initialization request fails.
     */
    connect = async (): Promise<browser.Runtime.Port> => {
        log.info('Connecting to the native host');
        // If the extension is connected to the native host in MV3, it will not die after 30 seconds as usual.
        const port = browser.runtime.connectNative(HOST_TYPES.browserExtensionHost);

        const messageHandler: PortMessageHandler = (message) => {
            if (this.port !== port || !this.portStates.has(port)) {
                return;
            }

            this.incomingMessageHandler(message).catch((error) => {
                log.debug(getErrorMessage(error));
            });
        };
        this.portStates.set(port, {
            messageHandler,
            pendingRequests: new Set<PendingRequestAbort>(),
        });
        port.onMessage.addListener(messageHandler);
        port.onDisconnect.addListener(this.disconnectHandler);
        this.port = port;

        try {
            await this.sendInitialRequest(false);

            if (this.port !== port || !this.portStates.has(port)) {
                throw new Error(NATIVE_HOST_ERRORS.PORT_DISCONNECTED_DURING_INIT);
            }

            return port;
        } catch (error) {
            this.disconnect(port);
            throw error;
        }
    };

    /**
     * Sends the protocol initialization request and applies its response.
     * @param shouldReconnect Whether the initialization request may reconnect.
     */
    sendInitialRequest = async (shouldReconnect: boolean): Promise<void> => {
        const { version, apiVersion, userAgent } = versions;
        const response = await this.init({ version, userAgent, apiVersion }, shouldReconnect);
        await this.initMessageHandler(response);
    };

    /**
     * Disconnects a specific port and rejects requests still owned by it.
     * Cleanup of an old port never changes a newer active port.
     * @param port Port to disconnect.
     */
    disconnect = (port?: browser.Runtime.Port | null): void => {
        if (!port) {
            return;
        }

        log.debug('Disconnecting from native host');
        const wasConnected = this.cleanupPort(port, NATIVE_HOST_ERRORS.CONNECTION_REPLACED);
        if (this.port === port) {
            this.port = null;
        }

        if (!wasConnected) {
            return;
        }

        try {
            port.disconnect();
        } catch (error) {
            log.debug(getErrorMessage(error));
        }
    };

    /**
     * Joins an existing connection operation or replaces the failed port once.
     * @param failedPort Port captured by the failed request.
     * @returns The initialized active port.
     */
    reconnect = async (
        failedPort?: browser.Runtime.Port | null,
    ): Promise<browser.Runtime.Port | null> => {
        log.debug('Trying to reconnect to native host...');

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        if (failedPort && this.port !== failedPort) {
            return this.port;
        }

        this.disconnect(failedPort || this.port);
        return this.trackConnection(this.connect());
    };

    /**
     * Waits until initial connection or reconnect initialization completes.
     * The init request itself bypasses the wait because it creates that operation.
     * @param params Native request parameters.
     * @returns The port available for the request.
     */
    waitForPort = async (params: RequestParams): Promise<browser.Runtime.Port | null> => {
        if (params.type === REQUEST_TYPES.init) {
            return this.port;
        }

        while (this.connectionPromise) {
            await this.connectionPromise;
        }

        return this.port;
    };

    /**
     * Sends a request through the initialized port and retries it once after a shared reconnect.
     * @param params Native request parameters.
     * @param tryReconnect Whether a failed non-init request may reconnect.
     * @returns The native-host response.
     * @throws When consent is required or both request attempts fail.
     */
    makeRequest = async (params: RequestParams, tryReconnect = true): Promise<any> => {
        const isConsentRequired = await consent.isConsentRequired();
        if (isConsentRequired && params.type !== REQUEST_TYPES.init) {
            throw new Error('Requests to native host can be send only after consent agreement received');
        }

        const port = await this.waitForPort(params);

        try {
            return await this.makeRequestOnce(params, port);
        } catch (error) {
            // Prevent reconnection for init requests, to avoid infinite loop, since reconnect calls init request
            // https://github.com/AdguardTeam/BrowserAssistant/issues/115
            if (tryReconnect && params.type !== REQUEST_TYPES.init) {
                log.debug(
                    'Was unable to send request with params:',
                    params,
                    'due to error:',
                    getErrorMessage(error),
                );

                try {
                    const reconnectedPort = await this.reconnect(port);
                    // Retry directly so a failure cannot create a third connection.
                    return await this.makeRequestOnce(params, reconnectedPort);
                } catch (retryError) {
                    log.debug(
                        'Native host reconnect or request retry failed:',
                        getErrorMessage(retryError),
                    );
                    throw retryError;
                }
            }

            throw error;
        }
    };

    /**
     * Executes one request attempt on the exact captured port.
     * @param params Native request parameters.
     * @param port Port that owns the request listeners and timer.
     * @returns The native-host response.
     * @throws When the provided port is no longer connected.
     */
    makeRequestOnce = async (
        params: RequestParams,
        port?: browser.Runtime.Port | null,
    ): Promise<any> => {
        const state = port ? this.portStates.get(port) : undefined;
        if (!port || !state) {
            throw new Error(NATIVE_HOST_ERRORS.PORT_NOT_CONNECTED);
        }

        // Requests can be executed too long time on application launch
        const RESPONSE_TIMEOUT_MS = 1000 * 60 * 5;

        // Use CUSTOM_REQUEST_PREFIX in order to ignore this requests in the incomingMessageHandler
        const id = `${ADG_PREFIX}_${CUSTOM_REQUEST_PREFIX}_${nanoid()}`;
        log.info(`Sending request: ${id}`, params);

        return new Promise<any>((resolve, reject) => {
            let settled = false;
            let timerId: ReturnType<typeof setTimeout>;
            let abort: PendingRequestAbort;
            let messageHandler: PortMessageHandler;

            const cleanup = (): void => {
                port.onMessage.removeListener(messageHandler);
                state.pendingRequests.delete(abort);
                clearTimeout(timerId);
            };

            const settle = (callback: (value: any) => void, value: any): void => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                callback(value);
            };

            abort = (message) => {
                settle(reject, new Error(message));
            };

            messageHandler = (message) => {
                const { requestId, result } = message;

                if (id === requestId) {
                    if (result === HOST_RESPONSE_TYPES.OK) {
                        settle(resolve, message);
                        return;
                    }

                    if (result === HOST_RESPONSE_TYPES.ERROR) {
                        settle(reject, new Error(
                            `Native host responded with message: ${message.data}.`,
                        ));
                    }
                }
            };

            port.onMessage.addListener(messageHandler);
            state.pendingRequests.add(abort);

            timerId = setTimeout(() => {
                settle(reject, new Error(NATIVE_HOST_ERRORS.RESPONSE_TIMEOUT));
            }, RESPONSE_TIMEOUT_MS);

            try {
                port.postMessage({ id, ...params });
            } catch (error) {
                settle(reject, error);
            }
        });
    };

    /**
     * Sends initial request to the native host.
     * @param initParams Parameters of the init request.
     * @param tryReconnect Whether to retry the request on reconnection.
     * @returns Promise resolved with the native host response.
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
     * Returns current app state.
     * @returns Promise resolved with the current app state.
     */
    getCurrentAppState = async (): Promise<any> => {
        const response = await this.makeRequest({
            type: REQUEST_TYPES.getCurrentAppState,
        });
        return response.appState;
    };

    /**
     * Returns filtering state for url, used to get state of current tab.
     * @param url URL to get the filtering state for.
     * @param port Port used by the filtering state request.
     * @param forceStartApp Whether to force the app to start.
     * @returns Promise resolved with the filtering state for the url.
     */
    getCurrentFilteringState = (url: string, port: number, forceStartApp = false): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.getCurrentFilteringState,
            parameters: { url, port, forceStartApp },
        });
    };

    /**
     * Sets protections status of the app.
     * @param isEnabled Whether the app protection is enabled.
     * @returns Promise resolved with the native host response.
     */
    setProtectionStatus = (isEnabled: boolean): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.setProtectionStatus,
        parameters: { isEnabled },
    });

    /**
     * Sets filtering status.
     * @param isEnabled Whether filtering is enabled.
     * @param isHttpsEnabled Whether HTTPS filtering is enabled.
     * @param url URL the filtering status applies to.
     * @returns Promise resolved with the native host response.
     */
    setFilteringStatus = (isEnabled: boolean, isHttpsEnabled: boolean, url: string): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.setFilteringStatus,
            parameters: { isEnabled, isHttpsEnabled, url },
        });
    };

    /**
     * Adds a user rule.
     * @param ruleText Text of the rule to add.
     * @returns Promise resolved with the native host response.
     */
    addRule = (ruleText: string): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.addRule,
        parameters: { ruleText },
    });

    /**
     * Removes custom rules for the given url.
     * @param url Url the custom rules apply to.
     * @returns Promise resolved with the native host response.
     */
    removeCustomRules = (url: string): Promise<any> => {
        return this.makeRequest({
            type: REQUEST_TYPES.removeCustomRules,
            parameters: { url },
        });
    };

    /**
     * Opens the original certificate of the given host.
     * @param domain Domain of the host.
     * @param port Port of the host.
     * @returns Promise resolved with the native host response.
     */
    openOriginalCert = (domain: string, port: number): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.openOriginalCert,
        parameters: { domain, port },
    });

    /**
     * Reports the website to the application.
     * @param url Url of the website to report.
     * @param referrer Referrer of the website to report.
     * @returns Promise resolved with the native host response.
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
     * Sends message to open filtering log.
     * @returns Promise resolved with the native host response.
     */
    openFilteringLog = (): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.openFilteringLog,
    });

    /**
     * Sends message to open settings.
     * @returns Promise resolved with the native host response.
     */
    openSettings = (): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.openSettings,
    });

    /**
     * Sends message to update app.
     * @returns Promise resolved with the native host response.
     */
    updateApp = (): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.updateApp,
    });

    /**
     * Sends message to pause filtering.
     * @param url URL to pause filtering on.
     * @param timeout Timeout of the filtering pause.
     * @returns Promise resolved with the native host response.
     */
    pauseFiltering = (url: string, timeout: string): Promise<any> => this.makeRequest({
        type: REQUEST_TYPES.pauseFiltering,
        parameters: { url, timeout },
    });
}
