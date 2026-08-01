/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Listener for messages coming from the native host
 */
export type MessageListener = (message: any) => void;

/**
 * Handler for the init message response
 */
export type InitMessageHandler = (response: any) => void;

/**
 * Request payload sent to the native host
 */
export type RequestParams = {
    type: string;
    parameters?: Record<string, unknown>;
};

/**
 * Parameters of the init request
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
 * Abstract class used to reflect methods used in the native host api
 */
export default class AbstractApi {
    listeners: MessageListener[] = [];

    async initModule(
        nativeHostMessagesHandler: MessageListener,
        initMessageHandler: InitMessageHandler,
    ): Promise<void> {
        throw notImplemented('initModule');
    }

    /**
     * Distributes messages to the listeners
     */
    incomingMessageHandler = async (incomingMessage: any): Promise<void> => {
        throw notImplemented('incomingMessageHandler');
    };

    /**
     * Adds listener to the listeners list
     */
    addMessageListener = (listener: MessageListener): void => {
        throw notImplemented('addMessageListener');
    };

    /**
     * Removes listener from listeners list
     */
    removeMessageListener = (listener: MessageListener): void => {
        throw notImplemented('removeMessageListener');
    };

    /**
     * Is called on connection or reconnection
     */
    addInitMessageHandler = (handler: InitMessageHandler): void => {
        throw notImplemented('addInitMessageHandler');
    };

    /**
     * Connect to the native host
     */
    connect = async (): Promise<void> => {
        throw notImplemented('connect');
    };

    sendInitialRequest = async (shouldReconnect: boolean): Promise<void> => {
        throw notImplemented('sendInitialRequest');
    };

    /**
     * Disconnect from the native host
     */
    disconnect = (): void => {
        throw notImplemented('disconnect');
    };

    /**
     * Reconnect to the native host
     */
    reconnect = async (): Promise<void> => {
        throw notImplemented('reconnect');
    };

    /**
     * Makes request
     * tryReconnect - by default function retries to reconnect
     */
    makeRequest = async (params: RequestParams, tryReconnect = true): Promise<any> => {
        throw notImplemented('makeRequest');
    };

    makeRequestOnce = async (params: RequestParams): Promise<any> => {
        throw notImplemented('makeRequestOnce');
    };

    /**
     * Sends initial request to the native host
     */
    init = ({ version, userAgent, apiVersion }: InitParams, tryReconnect = false): Promise<any> => {
        throw notImplemented('init');
    };

    /**
     * Returns current app state
     */
    getCurrentAppState = async (): Promise<any> => {
        throw notImplemented('getCurrentAppState');
    };

    /**
     * Returns filtering state for url, used to get state of current tab
     */
    getCurrentFilteringState = (url: string, port: number, forceStartApp = false): Promise<any> => {
        throw notImplemented('getCurrentFilteringState');
    };

    setProtectionStatus = (isEnabled: boolean): Promise<any> => {
        throw notImplemented('setProtectionStatus');
    };

    /**
     * Sets filtering status
     */
    setFilteringStatus = (isEnabled: boolean, isHttpsEnabled: boolean, url: string): Promise<any> => {
        throw notImplemented('setFilteringStatus');
    };

    addRule = (ruleText: string): Promise<any> => {
        throw notImplemented('addRule');
    };

    removeCustomRules = (url: string): Promise<any> => {
        throw notImplemented('removeCustomRules');
    };

    openOriginalCert = (domain: string, port: number): Promise<any> => {
        throw notImplemented('openOriginalCert');
    };

    reportSite = (url: string, referrer: string): Promise<any> => {
        throw notImplemented('reportSite');
    };

    /**
     * Sends message to open filtering log
     */
    openFilteringLog = (): Promise<any> => {
        throw notImplemented('openFilteringLog');
    };

    /**
     * Sends message to open settings
     */
    openSettings = (): Promise<any> => {
        throw notImplemented('openSettings');
    };

    /**
     * Sends message to update app
     */
    updateApp = (): Promise<any> => {
        throw notImplemented('updateApp');
    };

    /**
     * Sends message to pause filtering
     */
    pauseFiltering = (url: string, timeout: string): Promise<any> => {
        throw notImplemented('pauseFiltering');
    };
}
