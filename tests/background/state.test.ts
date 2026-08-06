import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import state from '../../src/background/state';

vi.mock('webextension-polyfill', () => ({
    default: {
        i18n: {
            getUILanguage: vi.fn(() => 'en'),
        },
    },
}));

vi.mock('../../src/background/versions', () => ({
    default: {
        apiVersion: '1',
        userAgent: 'test',
        version: '1.0.0',
    },
}));

describe('State.updateSecured', () => {
    it('does not classify HTTP pages as secured', () => {
        ['http://example.com', 'https://example.com'].forEach((url) => {
            state.updateSecured(url);

            expect(state.urlInfo.isSecured).toBe(false);
        });
    });

    it('classifies extension and local pages as secured', () => {
        [
            'chrome-extension://extension-id/page.html',
            'moz-extension://extension-id/page.html',
            'file:///tmp/page.html',
        ].forEach((url) => {
            state.updateSecured(url);

            expect(state.urlInfo.isSecured).toBe(true);
        });
    });
});
