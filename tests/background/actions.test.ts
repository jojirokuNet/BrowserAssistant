import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import actions from '../../src/background/actions';

const mocks = vi.hoisted(() => ({
    icons: {
        ENABLED: { 19: 'enabled-19.png', 38: 'enabled-38.png' },
        DISABLED: { 19: 'disabled-19.png', 38: 'disabled-38.png' },
    },
    setIcon: vi.fn(),
}));

vi.mock('../../src/lib/browserApi', () => ({
    browserApi: {
        action: { setIcon: mocks.setIcon },
    },
}));

vi.mock('../../src/background/prefs', () => ({
    Prefs: { ICONS: mocks.icons },
}));

describe('browser action icons', () => {
    beforeEach(() => {
        mocks.setIcon.mockReset();
        mocks.setIcon.mockResolvedValue(undefined);
    });

    it.each([
        [true, mocks.icons.ENABLED],
        [false, mocks.icons.DISABLED],
    ])('sets the enabled=%s default without a tab override', async (isEnabled, path) => {
        await actions.setDefaultIcon(isEnabled);

        expect(mocks.setIcon).toHaveBeenCalledWith({ path });
    });

    it.each([
        [0, true, mocks.icons.ENABLED],
        [12, false, mocks.icons.DISABLED],
    ])('sets the tab %s enabled=%s override', async (tabId, isEnabled, path) => {
        await actions.setTabIcon(tabId, isEnabled);

        expect(mocks.setIcon).toHaveBeenCalledWith({ path, tabId });
    });
});
