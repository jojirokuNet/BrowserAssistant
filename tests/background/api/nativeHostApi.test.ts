import type browser from 'webextension-polyfill';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest';

import { NativeHostApi } from '../../../src/background/api/nativeHostApi';

type TestMessage = {
    id?: string;
    requestId?: string;
    result?: string;
    data?: unknown;
    type?: string;
};

type EventListener = (...args: any[]) => void;

type MockPortEvent = {
    listeners: Set<EventListener>;
    addListener: (listener: EventListener) => void;
    removeListener: (listener: EventListener) => void;
    emit: (...args: any[]) => void;
    readonly size: number;
};

type MockPort = {
    error: browser.Runtime.PortErrorType | null | undefined;
    onMessage: MockPortEvent;
    onDisconnect: MockPortEvent;
    postMessage: Mock;
    disconnect: Mock;
};

type ApiHarness = {
    nativeMessageHandler: Mock;
    initMessageHandler: Mock;
};

const {
    mockBrowser,
    mockConsent,
    mockLog,
    mockNanoidState,
} = vi.hoisted(() => ({
    mockBrowser: {
        runtime: {
            connectNative: vi.fn(),
            lastError: undefined as { message: string } | undefined,
        },
    },
    mockConsent: {
        isConsentRequired: vi.fn(),
    },
    mockLog: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    mockNanoidState: {
        sequence: 0,
    },
}));

vi.mock('webextension-polyfill', () => ({
    default: mockBrowser,
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => `${++mockNanoidState.sequence}`),
}));

vi.mock('../../../src/background/consent', () => ({
    consent: mockConsent,
}));

vi.mock('../../../src/background/versions', () => ({
    default: {
        version: '1.0.0',
        apiVersion: '1',
        userAgent: 'test-agent',
    },
}));

vi.mock('../../../src/lib/logger', () => ({
    log: mockLog,
}));

const createMockPortEvent = (): MockPortEvent => {
    const listeners = new Set<EventListener>();

    return {
        listeners,
        addListener: (listener) => {
            listeners.add(listener);
        },
        removeListener: (listener) => {
            listeners.delete(listener);
        },
        emit: (...args) => {
            [...listeners].forEach((listener) => listener(...args));
        },
        get size() {
            return listeners.size;
        },
    };
};

const createMockPort = (): MockPort => ({
    error: null,
    onMessage: createMockPortEvent(),
    onDisconnect: createMockPortEvent(),
    postMessage: vi.fn(),
    disconnect: vi.fn(),
});

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const waitForPosts = async (port: MockPort, count: number): Promise<number> => {
    for (let turn = 0; turn < 30 && port.postMessage.mock.calls.length < count; turn += 1) {
        // Promise chains in reconnect contain several deliberately separate turns.
        // eslint-disable-next-line no-await-in-loop
        await flushMicrotasks();
    }
    return port.postMessage.mock.calls.length;
};

const postedMessage = (
    port: MockPort,
    index = port.postMessage.mock.calls.length - 1,
): TestMessage => (
    port.postMessage.mock.calls[index]?.[0] as TestMessage
);

const emitResponse = (
    port: MockPort,
    index: number,
    result = 'ok',
    extra: TestMessage = {},
): void => {
    const request = postedMessage(port, index);
    port.onMessage.emit({
        requestId: request.id,
        result,
        ...extra,
    });
};

const observe = (promise: Promise<any>): Promise<{
    status: 'fulfilled' | 'rejected';
    value?: any;
    error?: any;
}> => promise.then(
    (value) => ({ status: 'fulfilled', value }),
    (error) => ({ status: 'rejected', error }),
);

const requestParams = (suffix = ''): { type: string; parameters: Record<string, string> } => ({
    type: `test-request${suffix}`,
    parameters: {
        url: `https://secret.example/${suffix}`,
        secret: `native-body-${suffix}`,
    },
});

const waitForMockCalls = async (mock: Mock, count: number): Promise<number> => {
    for (let turn = 0; turn < 30 && mock.mock.calls.length < count; turn += 1) {
        // Connection initialization deliberately crosses several promise turns.
        // eslint-disable-next-line no-await-in-loop
        await flushMicrotasks();
    }
    return mock.mock.calls.length;
};

const apiHarnesses = new WeakMap<NativeHostApi, ApiHarness>();

const getApiHarness = (api: NativeHostApi): ApiHarness => {
    const harness = apiHarnesses.get(api);
    if (!harness) {
        throw new Error('API test harness is not registered');
    }

    return harness;
};

const createApi = (ports: MockPort[]): NativeHostApi => {
    const portQueue = [...ports];
    mockBrowser.runtime.connectNative.mockImplementation(() => (
        (portQueue.shift() || createMockPort()) as unknown as browser.Runtime.Port
    ));
    const nativeMessageHandler = vi.fn();
    const initMessageHandler = vi.fn();
    const api = new NativeHostApi(nativeMessageHandler, initMessageHandler);
    apiHarnesses.set(api, { nativeMessageHandler, initMessageHandler });
    return api;
};

const createReadyApi = async (ports: MockPort[]): Promise<NativeHostApi> => {
    const api = createApi(ports);
    const { initMessageHandler } = getApiHarness(api);
    await waitForPosts(ports[0], 1);
    const expectedInitCalls = initMessageHandler.mock.calls.length + 1;
    emitResponse(ports[0], 0, 'ok', { data: { initialized: true } });
    expect(await waitForMockCalls(initMessageHandler, expectedInitCalls))
        .toBeGreaterThanOrEqual(expectedInitCalls);
    await flushMicrotasks();
    return api;
};

const completeReplacementInit = async (api: NativeHostApi, port: MockPort): Promise<void> => {
    const { initMessageHandler } = getApiHarness(api);
    await waitForPosts(port, 1);
    const expectedInitCalls = initMessageHandler.mock.calls.length + 1;
    emitResponse(port, 0, 'ok', { data: { initialized: true } });
    expect(await waitForMockCalls(initMessageHandler, expectedInitCalls))
        .toBeGreaterThanOrEqual(expectedInitCalls);
    await flushMicrotasks();
};

describe('NativeHostApi connection lifecycle', () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        mockNanoidState.sequence = 0;
        mockBrowser.runtime.lastError = undefined;
        mockConsent.isConsentRequired.mockResolvedValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
        mockBrowser.runtime.lastError = undefined;
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mockNanoidState.sequence = 0;
    });

    it('routes out-of-order responses and unsolicited messages', async () => {
        const port = createMockPort();
        const api = await createReadyApi([port]);
        const { nativeMessageHandler } = getApiHarness(api);

        const first = api.makeRequest({ type: 'first-routed-request' });
        const second = api.makeRequest({ type: 'second-routed-request' });
        await waitForPosts(port, 3);
        const firstRequest = postedMessage(port, 1);
        const secondRequest = postedMessage(port, 2);

        port.onMessage.emit({
            requestId: secondRequest.id,
            result: 'ok',
            data: 'second-response',
        });
        port.onMessage.emit({
            requestId: 'ADG_PUSH_UPDATE',
            data: 'push-message',
        });
        port.onMessage.emit({
            requestId: firstRequest.id,
            result: 'ok',
            data: 'first-response',
        });

        await expect(Promise.all([first, second])).resolves.toMatchObject([
            { requestId: firstRequest.id, data: 'first-response' },
            { requestId: secondRequest.id, data: 'second-response' },
        ]);
        expect(nativeMessageHandler).toHaveBeenCalledWith({
            requestId: 'ADG_PUSH_UPDATE',
            data: 'push-message',
        });
    });

    it.each([
        ['Firefox', null, undefined],
        ['Chromium', undefined, { message: 'Native host exited' }],
    ])('single-flights 500 %s-style disconnect retries', async (
        browserName,
        portError,
        runtimeError,
    ) => {
        const oldPort = createMockPort();
        const newPort = createMockPort();
        const api = await createReadyApi([oldPort, newPort]);
        vi.useFakeTimers();

        const outcomes = Array.from({ length: 500 }, (_, index) => (
            observe(api.makeRequest(requestParams(`-${browserName}-${index}`)))
        ));
        await waitForPosts(oldPort, 501);
        oldPort.error = portError;
        mockBrowser.runtime.lastError = runtimeError;
        oldPort.onDisconnect.emit(oldPort);
        mockBrowser.runtime.lastError = undefined;
        await flushMicrotasks();

        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
        await completeReplacementInit(api, newPort);
        await waitForPosts(newPort, 501);
        for (let index = 1; index <= 500; index += 1) {
            emitResponse(newPort, index, 'ok');
        }
        const results = await Promise.all(outcomes);

        expect(results.every(({ status }) => status === 'fulfilled')).toBe(true);
        expect(oldPort.postMessage).toHaveBeenCalledTimes(501);
        expect(newPort.postMessage).toHaveBeenCalledTimes(501);
    });

    it('shares reconnect after concurrent post throws and aborts all old-port requests explicitly', async () => {
        const oldPort = createMockPort();
        const newPort = createMockPort();
        const api = await createReadyApi([oldPort, newPort]);
        vi.useFakeTimers();
        oldPort.postMessage.mockImplementation((message) => {
            if (message.type.startsWith('throw-')) {
                throw new Error('post failed');
            }
        });

        const outcomes = [
            observe(api.makeRequest({ type: 'held-request' })),
            observe(api.makeRequest({ type: 'throw-a' })),
            observe(api.makeRequest({ type: 'throw-b' })),
        ];
        await waitForPosts(oldPort, 4);
        await flushMicrotasks();

        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
        expect(oldPort.disconnect).toHaveBeenCalledTimes(1);
        expect(oldPort.onMessage.size).toBe(0);
        expect(oldPort.onDisconnect.size).toBe(0);
        await completeReplacementInit(api, newPort);
        await waitForPosts(newPort, 4);
        for (let index = 1; index <= 3; index += 1) {
            emitResponse(newPort, index, 'ok');
        }

        expect((await Promise.all(outcomes)).every(({ status }) => status === 'fulfilled')).toBe(true);
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
        vi.advanceTimersByTime(300000);
        expect([newPort.onMessage.size, newPort.onDisconnect.size]).toEqual([1, 1]);
    });

    it('does not create a third connection when the single retry also fails', async () => {
        const oldPort = createMockPort();
        const newPort = createMockPort();
        const api = await createReadyApi([oldPort, newPort]);
        oldPort.postMessage.mockImplementation(() => {
            throw new Error('first post failed');
        });
        newPort.postMessage.mockImplementation((message) => {
            if (message.type !== 'init') {
                throw new Error('retry post failed');
            }
        });

        const outcome = observe(api.makeRequest({ type: 'fails-twice' }));
        await completeReplacementInit(api, newPort);
        const { status, error } = await outcome;

        expect(status).toBe('rejected');
        expect(error).toEqual(new Error('retry post failed'));
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
    });

    it('ignores saved old-port request, disconnect, and timer callbacks after replacement', async () => {
        const oldPort = createMockPort();
        const newPort = createMockPort();
        const api = await createReadyApi([oldPort, newPort]);
        const [oldGeneralMessageHandler] = oldPort.onMessage.listeners;
        const [oldGeneralDisconnectHandler] = oldPort.onDisconnect.listeners;
        const { nativeMessageHandler } = getApiHarness(api);
        vi.useFakeTimers();
        const timerSpy = vi.spyOn(global, 'setTimeout');
        const outcome = observe(api.makeRequest({ type: 'stale-callbacks' }));
        await waitForPosts(oldPort, 2);

        const oldRequest = postedMessage(oldPort, 1);
        const oldRequestHandler = [...oldPort.onMessage.listeners]
            .find((listener) => listener !== oldGeneralMessageHandler);
        if (!oldRequestHandler) {
            throw new Error('Old request handler was not registered');
        }
        const oldTimerHandler = timerSpy.mock.calls[timerSpy.mock.calls.length - 1][0];
        oldPort.onDisconnect.emit(oldPort);
        await completeReplacementInit(api, newPort);
        await waitForPosts(newPort, 2);
        const newRequest = postedMessage(newPort, 1);
        const listenerSizes = [newPort.onMessage.size, newPort.onDisconnect.size];

        oldGeneralMessageHandler({ requestId: oldRequest.id, result: 'ok' });
        oldRequestHandler({ requestId: oldRequest.id, result: 'ok' });
        oldGeneralDisconnectHandler(oldPort);
        oldTimerHandler();
        oldGeneralMessageHandler({
            requestId: 'ADG_STALE_PUSH',
            result: 'ok',
            data: { appState: 'stale' },
        });
        await flushMicrotasks();

        expect([newPort.onMessage.size, newPort.onDisconnect.size]).toEqual(listenerSizes);
        expect(newPort.disconnect).not.toHaveBeenCalled();
        expect(nativeMessageHandler).not.toHaveBeenCalled();
        newPort.onMessage.emit({ requestId: newRequest.id, result: 'ok' });
        expect((await outcome).status).toBe('fulfilled');
    });

    it('cleans request listeners and timers on every settle and replacement path', async () => {
        const oldPort = createMockPort();
        const replacement = createMockPort();
        const api = await createReadyApi([oldPort, replacement]);
        vi.useFakeTimers();

        const success = observe(api.makeRequest({ type: 'success' }));
        await waitForPosts(oldPort, 2);
        emitResponse(oldPort, 1, 'ok');
        expect((await success).status).toBe('fulfilled');
        vi.advanceTimersByTime(300000);
        expect([oldPort.onMessage.size, oldPort.onDisconnect.size]).toEqual([1, 1]);

        const hostError = observe(api.makeRequest({ type: 'host-error' }, false));
        await waitForPosts(oldPort, 3);
        emitResponse(oldPort, 2, 'error', { data: 'error body' });
        await flushMicrotasks();
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(1);
        expect((await hostError).status).toBe('rejected');
        vi.advanceTimersByTime(300000);
        expect([oldPort.onMessage.size, oldPort.onDisconnect.size]).toEqual([1, 1]);

        const timeout = observe(api.makeRequest({ type: 'timeout' }, false));
        await waitForPosts(oldPort, 4);
        vi.advanceTimersByTime(300000);
        await flushMicrotasks();
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(1);
        expect((await timeout).error).toEqual(new Error('Native host is not responding too long'));
        vi.advanceTimersByTime(300000);
        expect([oldPort.onMessage.size, oldPort.onDisconnect.size]).toEqual([1, 1]);

        const disconnected = observe(api.makeRequest({ type: 'disconnect' }));
        await waitForPosts(oldPort, 5);
        oldPort.onDisconnect.emit(oldPort);
        await completeReplacementInit(api, replacement);
        await waitForPosts(replacement, 2);
        emitResponse(replacement, 1, 'ok');
        expect((await disconnected).status).toBe('fulfilled');
        vi.advanceTimersByTime(300000);
        expect([oldPort.onMessage.size, oldPort.onDisconnect.size]).toEqual([0, 0]);
        expect([replacement.onMessage.size, replacement.onDisconnect.size]).toEqual([1, 1]);
    });

    it('rejects all reconnect waiters when replacement init fails without recursion', async () => {
        const oldPort = createMockPort();
        const replacement = createMockPort();
        const api = await createReadyApi([oldPort, replacement]);
        vi.useFakeTimers();
        const outcomes = Array.from({ length: 5 }, (_, index) => (
            observe(api.makeRequest({ type: `waiter-${index}` }))
        ));
        await waitForPosts(oldPort, 6);
        oldPort.onDisconnect.emit(oldPort);
        await waitForPosts(replacement, 1);
        const lateWaiter = observe(api.makeRequest({ type: 'late-reconnect-waiter' }));
        emitResponse(replacement, 0, 'error', { data: 'init failed' });
        const results = await Promise.all([...outcomes, lateWaiter]);

        expect(results.every(({ status }) => status === 'rejected')).toBe(true);
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
        expect(replacement.disconnect).toHaveBeenCalledTimes(1);
        expect([replacement.onMessage.size, replacement.onDisconnect.size]).toEqual([0, 0]);
    });

    it('clears failed reconnect state so a later transport failure can reconnect', async () => {
        const oldPort = createMockPort();
        const failedReplacement = createMockPort();
        const healthyReplacement = createMockPort();
        const api = await createReadyApi([oldPort, failedReplacement, healthyReplacement]);
        vi.useFakeTimers();

        const first = observe(api.makeRequest({ type: 'first-cycle' }));
        await waitForPosts(oldPort, 2);
        oldPort.onDisconnect.emit(oldPort);
        await waitForPosts(failedReplacement, 1);
        emitResponse(failedReplacement, 0, 'error', { data: 'init failed' });
        expect((await first).status).toBe('rejected');

        const second = observe(api.makeRequest({ type: 'second-cycle' }));
        await waitForPosts(healthyReplacement, 1);
        emitResponse(healthyReplacement, 0, 'ok');
        await waitForPosts(healthyReplacement, 2);
        emitResponse(healthyReplacement, 1, 'ok');

        expect((await second).status).toBe('fulfilled');
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(3);
    });

    it('holds an ordinary request until the initial init request is ready', async () => {
        const port = createMockPort();
        const api = createApi([port]);
        const outcome = observe(api.makeRequest({ type: 'ordinary-during-init' }));
        await waitForPosts(port, 1);
        const postsBeforeInit = port.postMessage.mock.calls.length;

        emitResponse(port, 0, 'ok');
        await waitForPosts(port, 2);
        emitResponse(port, 1, 'ok');
        expect((await outcome).status).toBe('fulfilled');
        expect(postsBeforeInit).toBe(1);
    });

    it('holds ordinary requests until replacement init is ready', async () => {
        const oldPort = createMockPort();
        const replacement = createMockPort();
        const api = await createReadyApi([oldPort, replacement]);
        vi.useFakeTimers();
        const first = observe(api.makeRequest({ type: 'causes-reconnect' }));
        await waitForPosts(oldPort, 2);
        oldPort.onDisconnect.emit(oldPort);
        await waitForPosts(replacement, 1);

        const second = observe(api.makeRequest({ type: 'during-replacement-init' }));
        await flushMicrotasks();
        const postsBeforeInit = replacement.postMessage.mock.calls.length;
        emitResponse(replacement, 0, 'ok');
        await waitForPosts(replacement, 3);
        emitResponse(replacement, 1, 'ok');
        emitResponse(replacement, 2, 'ok');

        expect((await Promise.all([first, second])).every(({ status }) => status === 'fulfilled')).toBe(true);
        expect(postsBeforeInit).toBe(1);
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
    });

    it('does not reconnect an idle disconnect until the next request', async () => {
        const oldPort = createMockPort();
        const replacement = createMockPort();
        const api = await createReadyApi([oldPort, replacement]);
        vi.useFakeTimers();

        oldPort.onDisconnect.emit(oldPort);
        await flushMicrotasks();
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(1);

        const outcome = observe(api.makeRequest({ type: 'after-idle-disconnect' }));
        await waitForPosts(replacement, 1);
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
        emitResponse(replacement, 0, 'ok');
        await waitForPosts(replacement, 2);
        emitResponse(replacement, 1, 'ok');

        expect((await outcome).status).toBe('fulfilled');
        expect(mockBrowser.runtime.connectNative).toHaveBeenCalledTimes(2);
    });
});
