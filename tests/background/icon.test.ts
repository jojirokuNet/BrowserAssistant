import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

const TYPES = {
    TAB_UPDATED: 'event.tab.updated',
    TAB_ACTIVATED: 'event.tab.activated',
    STATE_UPDATED: 'event.state.updated',
} as const;

type TestTab = {
    id: number;
    url: string;
    title: string;
};

type QueryInfo = {
    windowId?: number;
    lastFocusedWindow?: boolean;
};

type Listener = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    addFocusListener: vi.fn(),
    WINDOW_ID_NONE: -1,
}));

vi.mock('webextension-polyfill', () => ({
    default: {
        tabs: {
            query: mocks.query,
        },
        windows: {
            WINDOW_ID_NONE: mocks.WINDOW_ID_NONE,
            onFocusChanged: {
                addListener: mocks.addFocusListener,
            },
        },
    },
}));

vi.mock('lodash/throttle', () => ({
    default: <Args extends unknown[], Result>(callback: (...args: Args) => Result) => callback,
}));

const flushMicrotasks = async (count = 12): Promise<void> => {
    for (let index = 0; index < count; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
};

const createDeferred = <Value>() => {
    let resolve!: (value: Value) => void;
    const promise = new Promise<Value>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
};

const setup = async () => {
    vi.resetModules();
    mocks.query.mockReset();
    mocks.addFocusListener.mockClear();

    const listeners: Record<string, Listener> = {};
    const windowTabs = new Map<number, TestTab>();
    let activeTabsQuery = Promise.resolve<TestTab[]>([]);
    let appWorking = true;
    let lastFocusedTab: TestTab | null = {
        id: 1,
        url: 'https://focused.example',
        title: 'Focused',
    };

    mocks.query.mockImplementation(({ windowId, lastFocusedWindow }: QueryInfo) => {
        if (lastFocusedWindow) {
            return Promise.resolve(lastFocusedTab ? [lastFocusedTab] : []);
        }
        if (windowId !== undefined) {
            return Promise.resolve(windowTabs.has(windowId) ? [windowTabs.get(windowId)] : []);
        }
        return activeTabsQuery;
    });

    const notifier = {
        types: TYPES,
        addSpecifiedListener: vi.fn((type: string, listener: Listener) => {
            listeners[type] = listener;
        }),
    };
    const actions = {
        setDefaultIcon: vi.fn().mockResolvedValue(undefined),
        setTabIcon: vi.fn().mockResolvedValue(undefined),
    };
    const state = {
        isAppWorking: vi.fn(() => appWorking),
        getCurrentFilteringState: vi.fn().mockResolvedValue({
            isFilteringEnabled: true,
        }),
        setUrlInfo: vi.fn(),
    };
    const ContextMenu = {
        controlledUpdate: vi.fn().mockResolvedValue(undefined),
    };
    const log = {
        debug: vi.fn(),
    };

    vi.doMock('../../src/lib/notifier', () => ({ default: notifier }));
    vi.doMock('../../src/background/actions', () => ({ default: actions }));
    vi.doMock('../../src/background/state', () => ({ default: state }));
    vi.doMock('../../src/background/contextMenu', () => ({ ContextMenu }));
    vi.doMock('../../src/lib/logger', () => ({ log }));

    await import('../../src/background/icon');

    const windowFocusListener = mocks.addFocusListener.mock.calls[0][0] as (
        windowId: number,
    ) => Promise<void> | null;

    return {
        actions,
        ContextMenu,
        state,
        emit: async (type: string, ...args: unknown[]): Promise<unknown> => listeners[type](...args),
        focusWindow: async (windowId: number): Promise<void | null> => windowFocusListener(windowId),
        setLastFocusedTab(tab: TestTab | null): void {
            lastFocusedTab = tab;
        },
        setWindowTab(windowId: number, tab: TestTab): void {
            windowTabs.set(windowId, tab);
        },
        setActiveTabs(tabs: TestTab[]): void {
            activeTabsQuery = Promise.resolve(tabs);
        },
        setActiveTabsQuery(query: Promise<TestTab[]>): void {
            activeTabsQuery = query;
        },
        setWorking(value: boolean): void {
            appWorking = value;
        },
    };
};

describe('focused-window icon updates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads filtering state once when 35 windows report active tabs', async () => {
        const harness = await setup();
        const activeTabs = Array.from({ length: 35 }, (_, index) => ({
            id: index + 1,
            url: `https://window-${index + 1}.example`,
            title: `Window ${index + 1}`,
        }));
        const focusedTab = activeTabs[17];
        harness.setLastFocusedTab(focusedTab);

        await Promise.all(activeTabs.map((tab) => harness.emit(TYPES.TAB_UPDATED, tab)));
        await flushMicrotasks();

        expect(harness.state.getCurrentFilteringState).toHaveBeenCalledTimes(1);
        expect(harness.state.getCurrentFilteringState).toHaveBeenCalledWith(focusedTab);
        expect(harness.actions.setTabIcon).toHaveBeenCalledWith(focusedTab.id, true);
        expect(harness.state.setUrlInfo).toHaveBeenCalledWith(focusedTab.url, {
            isFilteringEnabled: true,
        });
        expect(mocks.query).toHaveBeenCalledWith({
            active: true,
            lastFocusedWindow: true,
        });
    });

    it('queries the window that receives focus and refreshes its active tab', async () => {
        const harness = await setup();
        const focusedTab = {
            id: 41,
            url: 'https://window-focus.example',
            title: 'Window focus',
        };
        harness.setWindowTab(9, focusedTab);
        harness.setLastFocusedTab(focusedTab);

        await harness.focusWindow(9);
        await flushMicrotasks();

        expect(mocks.query.mock.calls[0][0]).toEqual({
            active: true,
            windowId: 9,
        });
        expect(harness.state.getCurrentFilteringState).toHaveBeenCalledWith(focusedTab);
        expect(harness.actions.setTabIcon).toHaveBeenCalledWith(focusedTab.id, true);
        expect(harness.state.setUrlInfo).toHaveBeenCalledWith(focusedTab.url, {
            isFilteringEnabled: true,
        });
    });

    it('ignores the no-focused-window sentinel', async () => {
        const harness = await setup();

        await expect(harness.focusWindow(mocks.WINDOW_ID_NONE)).resolves.toBeNull();

        expect(mocks.query).not.toHaveBeenCalled();
        expect(harness.state.getCurrentFilteringState).not.toHaveBeenCalled();
        expect(harness.actions.setTabIcon).not.toHaveBeenCalled();
    });

    it('rechecks the last-focused tab before applying a native response', async () => {
        const harness = await setup();
        const originalTab = {
            id: 51,
            url: 'https://original.example',
            title: 'Original',
        };
        const nextTab = {
            id: originalTab.id,
            url: 'https://next.example',
            title: 'Next',
        };
        const response = createDeferred<{ isFilteringEnabled: boolean }>();
        harness.setWindowTab(10, originalTab);
        harness.setLastFocusedTab(originalTab);
        harness.state.getCurrentFilteringState.mockReturnValueOnce(response.promise);

        await harness.focusWindow(10);
        await flushMicrotasks();
        harness.setLastFocusedTab(nextTab);
        response.resolve({ isFilteringEnabled: false });
        await flushMicrotasks();

        expect(mocks.query.mock.calls).toEqual([
            [{ active: true, windowId: 10 }],
            [{ active: true, lastFocusedWindow: true }],
        ]);
        expect(harness.actions.setTabIcon).not.toHaveBeenCalled();
        expect(harness.state.setUrlInfo).not.toHaveBeenCalled();
        expect(harness.ContextMenu.controlledUpdate).not.toHaveBeenCalled();
    });

    it('updates the default and focused-tab icons on a state event', async () => {
        const harness = await setup();
        const focusedTab = {
            id: 61,
            url: 'https://state.example',
            title: 'State',
        };
        harness.setLastFocusedTab(focusedTab);
        harness.state.getCurrentFilteringState.mockResolvedValueOnce({
            isFilteringEnabled: false,
        });

        await harness.emit(TYPES.STATE_UPDATED, { id: 999, url: 'https://stale.example' });
        await flushMicrotasks();

        expect(harness.actions.setDefaultIcon).toHaveBeenCalledWith(true);
        expect(harness.actions.setTabIcon).toHaveBeenCalledWith(focusedTab.id, false);
        expect(harness.state.setUrlInfo).toHaveBeenCalledWith(focusedTab.url, {
            isFilteringEnabled: false,
        });
        expect(mocks.query).not.toHaveBeenCalledWith({ active: true });
    });

    it('disables active tab overrides in every window without a native read', async () => {
        const harness = await setup();
        const activeTabs = [
            {
                id: 71,
                url: 'https://first-window.example',
                title: 'First window',
            },
            {
                id: 72,
                url: 'https://second-window.example',
                title: 'Second window',
            },
        ];
        harness.setActiveTabs(activeTabs);
        harness.setWorking(false);

        await harness.emit(TYPES.STATE_UPDATED);
        await flushMicrotasks();

        expect(harness.actions.setDefaultIcon).toHaveBeenCalledWith(false);
        expect(harness.actions.setTabIcon.mock.calls).toEqual([
            [activeTabs[0].id, false],
            [activeTabs[1].id, false],
        ]);
        expect(mocks.query).toHaveBeenCalledWith({ active: true });
        expect(harness.state.getCurrentFilteringState).not.toHaveBeenCalled();
        expect(harness.state.setUrlInfo).not.toHaveBeenCalled();
        expect(harness.ContextMenu.controlledUpdate).toHaveBeenCalledTimes(1);
    });

    it('does not apply a stale disabled update after the app starts working', async () => {
        const harness = await setup();
        const focusedTab = {
            id: 81,
            url: 'https://working-again.example',
            title: 'Working again',
        };
        const staleTab = {
            id: 82,
            url: 'https://stale-disabled.example',
            title: 'Stale disabled',
        };
        const activeTabs = createDeferred<TestTab[]>();
        harness.setActiveTabsQuery(activeTabs.promise);
        harness.setLastFocusedTab(focusedTab);
        harness.setWorking(false);

        const stoppedUpdate = harness.emit(TYPES.STATE_UPDATED);
        await flushMicrotasks();

        harness.setWorking(true);
        await harness.emit(TYPES.STATE_UPDATED);
        await flushMicrotasks();

        activeTabs.resolve([focusedTab, staleTab]);
        await stoppedUpdate;
        await flushMicrotasks();

        expect(harness.actions.setDefaultIcon.mock.calls).toEqual([
            [false],
            [true],
        ]);
        expect(harness.state.getCurrentFilteringState).toHaveBeenCalledTimes(1);
        expect(harness.state.getCurrentFilteringState).toHaveBeenCalledWith(focusedTab);
        expect(harness.actions.setTabIcon).toHaveBeenCalledWith(focusedTab.id, true);
        expect(harness.actions.setTabIcon).not.toHaveBeenCalledWith(staleTab.id, false);
    });
});
