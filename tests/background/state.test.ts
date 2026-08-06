import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { FEEDBACK_ACTIONS } from '../../src/lib/types';

interface AppStatePayload {
    isInstalled: boolean;
    isRunning: boolean;
    isProtectionEnabled: boolean;
    isLicenseExpired: boolean;
    locale: string | null;
    isAuthorized: boolean;
    feedbackAction: string;
}

interface FilteringParameters {
    isFilteringEnabled: boolean;
    isHttpsFilteringEnabled: boolean;
    canChangeFilteringStatus?: boolean | null;
}

type NativeHostMessagesHandler = (message: { appState: AppStatePayload }) => Promise<void>;

const mocks = vi.hoisted(() => ({
    getCurrentFilteringState: vi.fn(),
    nativeHostMessagesHandler: undefined as NativeHostMessagesHandler | undefined,
    notifyListeners: vi.fn(),
    notifyPopupStateUpdated: vi.fn(),
}));

vi.mock('lodash/throttle', () => ({
    default: (callback: unknown) => callback,
}));

vi.mock('webextension-polyfill', () => ({
    default: {
        i18n: {
            getUILanguage: vi.fn(() => 'en'),
        },
    },
}));

vi.mock('../../src/lib/notifier', () => ({
    default: {
        types: {
            STATE_UPDATED: 'event.state.updated',
        },
        notifyListeners: mocks.notifyListeners,
    },
}));

vi.mock('../../src/background/api', () => ({
    Api: function MockApi(messageHandler: NativeHostMessagesHandler) {
        mocks.nativeHostMessagesHandler = messageHandler;
        return {
            getCurrentFilteringState: mocks.getCurrentFilteringState,
        };
    },
}));

vi.mock('../../src/background/versions', () => ({
    default: {
        apiVersion: '1',
        userAgent: 'test',
        version: '1.0.0',
    },
}));

vi.mock('../../src/background/longLivedMessageService', () => ({
    longLivedMessageService: {
        notifyPopupStateUpdated: mocks.notifyPopupStateUpdated,
    },
}));

const createAppState = (overrides: Partial<AppStatePayload> = {}): AppStatePayload => ({
    isInstalled: true,
    isRunning: true,
    isProtectionEnabled: true,
    isLicenseExpired: false,
    locale: 'en',
    isAuthorized: true,
    feedbackAction: FEEDBACK_ACTIONS.UPDATE_APPLICATION_APP_ONLY,
    ...overrides,
});

const createParameters = (
    overrides: Partial<FilteringParameters> = {},
): FilteringParameters => ({
    isFilteringEnabled: false,
    isHttpsFilteringEnabled: true,
    ...overrides,
});

const setup = async () => {
    vi.resetModules();
    mocks.getCurrentFilteringState.mockReset();
    mocks.notifyListeners.mockReset();
    mocks.notifyPopupStateUpdated.mockReset();
    mocks.nativeHostMessagesHandler = undefined;

    const { default: state } = await import('../../src/background/state');
    state.init();
    state.setAppState(createAppState());
    mocks.notifyListeners.mockClear();
    mocks.notifyPopupStateUpdated.mockClear();

    const sendNativeMessage = async (message: { appState: AppStatePayload }): Promise<void> => {
        if (!mocks.nativeHostMessagesHandler) {
            throw new Error('Native host message handler was not initialized');
        }

        await mocks.nativeHostMessagesHandler(message);
    };

    return {
        api: {
            getCurrentFilteringState: mocks.getCurrentFilteringState,
        },
        notifier: {
            types: {
                STATE_UPDATED: 'event.state.updated',
            },
            notifyListeners: mocks.notifyListeners,
        },
        notifyPopupStateUpdated: mocks.notifyPopupStateUpdated,
        sendNativeMessage,
        state,
    };
};

describe('current filtering state', () => {
    it('returns normalized filtering data and exposes the host app state', async () => {
        const {
            api, notifier, notifyPopupStateUpdated, state,
        } = await setup();
        const response = {
            appState: createAppState({ locale: 'fr' }),
            parameters: createParameters(),
        };
        api.getCurrentFilteringState.mockResolvedValue(response);

        await expect(state.getCurrentFilteringState({
            url: 'https://example.com/page',
        })).resolves.toEqual({
            ...response.parameters,
            canChangeFilteringStatus: true,
        });

        expect(api.getCurrentFilteringState)
            .toHaveBeenCalledWith('https://example.com/page', 443, false);
        expect(state.getAppState().locale).toBe('fr');
        expect(notifier.notifyListeners)
            .toHaveBeenCalledWith(notifier.types.STATE_UPDATED);
        expect(notifyPopupStateUpdated).toHaveBeenCalledTimes(1);
    });

    it('does not republish filtering feedback from a request response', async () => {
        const {
            api, notifier, notifyPopupStateUpdated, state,
        } = await setup();
        api.getCurrentFilteringState.mockResolvedValue({
            appState: createAppState({
                feedbackAction: FEEDBACK_ACTIONS.UPDATE_FILTERING_STATUS,
            }),
            parameters: createParameters({ canChangeFilteringStatus: false }),
        });

        await state.getCurrentFilteringState({ url: 'http://example.com' });

        expect(notifier.notifyListeners).not.toHaveBeenCalled();
        expect(notifyPopupStateUpdated).not.toHaveBeenCalled();
    });

    it('publishes a substantive app change from a request response', async () => {
        const {
            api, notifier, notifyPopupStateUpdated, state,
        } = await setup();
        api.getCurrentFilteringState.mockResolvedValue({
            appState: createAppState({
                isRunning: false,
                feedbackAction: FEEDBACK_ACTIONS.UPDATE_FILTERING_STATUS,
            }),
            parameters: createParameters(),
        });

        await state.getCurrentFilteringState({ url: 'https://example.com' });

        expect(notifier.notifyListeners)
            .toHaveBeenCalledWith(notifier.types.STATE_UPDATED);
        expect(notifyPopupStateUpdated).toHaveBeenCalledTimes(1);
    });

    it('publishes filtering feedback from an unsolicited native message', async () => {
        const {
            notifier, notifyPopupStateUpdated, sendNativeMessage,
        } = await setup();
        await sendNativeMessage({
            appState: createAppState({
                feedbackAction: FEEDBACK_ACTIONS.UPDATE_FILTERING_STATUS,
            }),
        });

        expect(notifier.notifyListeners)
            .toHaveBeenCalledWith(notifier.types.STATE_UPDATED);
        expect(notifyPopupStateUpdated).toHaveBeenCalledTimes(1);
    });

    it('preserves explicit false and null filtering-change permissions', async () => {
        const { api, state } = await setup();

        for (const canChangeFilteringStatus of [false, null]) {
            api.getCurrentFilteringState.mockResolvedValueOnce({
                appState: createAppState(),
                parameters: createParameters({ canChangeFilteringStatus }),
            });

            // eslint-disable-next-line no-await-in-loop
            const result = await state.getCurrentFilteringState({
                url: 'https://example.com',
            });

            expect(result.canChangeFilteringStatus).toBe(canChangeFilteringStatus);
        }
    });

    it('returns null for a non-HTTP page without calling the native host', async () => {
        const { api, state } = await setup();

        await expect(state.getCurrentFilteringState({
            url: 'chrome://settings',
        })).resolves.toBeNull();

        expect(api.getCurrentFilteringState).not.toHaveBeenCalled();
    });
});

describe('State.setUrlInfo', () => {
    it('does not classify HTTP pages as secured', async () => {
        const { state } = await setup();

        ['http://example.com', 'https://example.com'].forEach((url) => {
            state.setUrlInfo(url);

            expect(state.urlInfo.isSecured).toBe(false);
        });
    });

    it('classifies extension and local pages as secured', async () => {
        const { state } = await setup();

        [
            'chrome-extension://extension-id/page.html',
            'moz-extension://extension-id/page.html',
            'file:///tmp/page.html',
        ].forEach((url) => {
            state.setUrlInfo(url);

            expect(state.urlInfo.isSecured).toBe(true);
        });
    });
});
