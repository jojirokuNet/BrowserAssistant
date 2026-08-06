/**
 * @file Abstract contract of the native host messaging API.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Listener for messages coming from the native host.
 */
export type MessageListener = (message: any) => void;

/**
 * Handler for the init message response.
 */
export type InitMessageHandler = (response: any) => void;

/**
 * Request payload sent to the native host.
 */
export type RequestParams = {
    type: string;
    parameters?: Record<string, unknown>;
};

/**
 * Parameters of the init request.
 */
export type InitParams = {
    version: string;
    userAgent: string;
    apiVersion: string;
};

const notImplemented = (functionName: string): Error => {
    return new Error(`Method "${functionName}" is not implemented`);
};

/**
 * Abstract class used to reflect methods used in the native host api.
 */
export default class AbstractApi {
    /**
     * Listeners registered for native host messages.
     */
    listeners: MessageListener[] = [];

    /**
     * Initializes the module and registers the native host message listeners.
     * @param nativeHostMessagesHandler Listener for messages from the native host.
     * @param initMessageHandler Handler for the init message response.
     * @throws When the method is not implemented by the subclass.
     */
    async initModule(
        nativeHostMessagesHandler: MessageListener,
        initMessageHandler: InitMessageHandler,
    ): Promise<void> {
        throw notImplemented('initModule');
    }

    /**
     * Distributes messages to the listeners.
     * @param incomingMessage Message received from the native host.
     * @throws When the method is not implemented.
     */
    incomingMessageHandler = async (incomingMessage: any): Promise<void> => {
        throw notImplemented('incomingMessageHandler');
    };

    /**
     * Adds listener to the listeners list.
     * @param listener Listener to add.
     * @throws When the method is not implemented.
     */
    addMessageListener = (listener: MessageListener): void => {
        throw notImplemented('addMessageListener');
    };

    /**
     * Removes listener from listeners list.
     * @param listener Listener to remove.
     * @throws When the method is not implemented.
     */
    removeMessageListener = (listener: MessageListener): void => {
        throw notImplemented('removeMessageListener');
    };

    /**
     * Is called on connection or reconnection.
     * @param handler Handler to call on connection or reconnection.
     * @throws When the method is not implemented.
     */
    addInitMessageHandler = (handler: InitMessageHandler): void => {
        throw notImplemented('addInitMessageHandler');
    };

    /**
     * Connect to the native host.
     * @throws When the method is not implemented.
     */
    connect = async (): Promise<void> => {
        throw notImplemented('connect');
    };

    /**
     * Sends the initial request to the native host.
     * @param shouldReconnect Whether to reconnect before sending.
     * @throws When the method is not implemented.
     */
    sendInitialRequest = async (shouldReconnect: boolean): Promise<void> => {
        throw notImplemented('sendInitialRequest');
    };

    /**
     * Disconnect from the native host.
     * @throws When the method is not implemented.
     */
    disconnect = (): void => {
        throw notImplemented('disconnect');
    };

    /**
     * Reconnect to the native host.
     * @throws When the method is not implemented.
     */
    reconnect = async (): Promise<void> => {
        throw notImplemented('reconnect');
    };

    /**
     * Makes a request to the native host. By default the function retries
     * to reconnect.
     * @param params Request payload to send.
     * @param tryReconnect Whether to retry the request on reconnection.
     * @throws When the method is not implemented.
     */
    makeRequest = async (params: RequestParams, tryReconnect = true): Promise<any> => {
        throw notImplemented('makeRequest');
    };

    /**
     * Makes a single request to the native host without reconnection.
     * @param params Request payload to send.
     * @throws When the method is not implemented.
     */
    makeRequestOnce = async (params: RequestParams): Promise<any> => {
        throw notImplemented('makeRequestOnce');
    };

    /**
     * Sends initial request to the native host.
     * @param initParams Parameters of the init request.
     * @param tryReconnect Whether to retry the request on reconnection.
     * @throws When the method is not implemented.
     */
    init = ({ version, userAgent, apiVersion }: InitParams, tryReconnect = false): Promise<any> => {
        throw notImplemented('init');
    };

    /**
     * Returns current app state.
     * @throws When the method is not implemented.
     */
    getCurrentAppState = async (): Promise<any> => {
        throw notImplemented('getCurrentAppState');
    };

    /**
     * Returns filtering state for url, used to get state of current tab.
     * @param url URL to get the filtering state for.
     * @param port Port used by the filtering state request.
     * @param forceStartApp Whether to force the app to start.
     * @throws When the method is not implemented.
     */
    getCurrentFilteringState = (url: string, port: number, forceStartApp = false): Promise<any> => {
        throw notImplemented('getCurrentFilteringState');
    };

    /**
     * Toggles the protection status of the application.
     * @param isEnabled Whether protection is enabled.
     * @throws When the method is not implemented.
     */
    setProtectionStatus = (isEnabled: boolean): Promise<any> => {
        throw notImplemented('setProtectionStatus');
    };

    /**
     * Sets filtering status.
     * @param isEnabled Whether filtering is enabled.
     * @param isHttpsEnabled Whether HTTPS filtering is enabled.
     * @param url URL the filtering status applies to.
     * @throws When the method is not implemented.
     */
    setFilteringStatus = (isEnabled: boolean, isHttpsEnabled: boolean, url: string): Promise<any> => {
        throw notImplemented('setFilteringStatus');
    };

    /**
     * Adds a user rule.
     * @param ruleText Text of the rule to add.
     * @throws When the method is not implemented.
     */
    addRule = (ruleText: string): Promise<any> => {
        throw notImplemented('addRule');
    };

    /**
     * Removes custom rules for the given url.
     * @param url Url the custom rules apply to.
     * @throws When the method is not implemented.
     */
    removeCustomRules = (url: string): Promise<any> => {
        throw notImplemented('removeCustomRules');
    };

    /**
     * Opens the original certificate of the given host.
     * @param domain Domain of the host.
     * @param port Port of the host.
     * @throws When the method is not implemented.
     */
    openOriginalCert = (domain: string, port: number): Promise<any> => {
        throw notImplemented('openOriginalCert');
    };

    /**
     * Reports the website to the application.
     * @param url Url of the website to report.
     * @param referrer Referrer of the website to report.
     * @throws When the method is not implemented.
     */
    reportSite = (url: string, referrer: string): Promise<any> => {
        throw notImplemented('reportSite');
    };

    /**
     * Sends message to open filtering log.
     * @throws When the method is not implemented.
     */
    openFilteringLog = (): Promise<any> => {
        throw notImplemented('openFilteringLog');
    };

    /**
     * Sends message to open settings.
     * @throws When the method is not implemented.
     */
    openSettings = (): Promise<any> => {
        throw notImplemented('openSettings');
    };

    /**
     * Sends message to update app.
     * @throws When the method is not implemented.
     */
    updateApp = (): Promise<any> => {
        throw notImplemented('updateApp');
    };

    /**
     * Sends message to pause filtering.
     * @param url URL to pause filtering on.
     * @param timeout Timeout of the filtering pause.
     * @throws When the method is not implemented.
     */
    pauseFiltering = (url: string, timeout: string): Promise<any> => {
        throw notImplemented('pauseFiltering');
    };
}
