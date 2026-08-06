import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    checkSomeIsTrue,
    compareSemver,
    getFormattedPort,
    getFormattedProtocol,
    getUrlProps,
} from '../src/lib/helpers';

describe('protocol helpers', () => {
    it('formats HTTP and HTTPS protocols', () => {
        expect(getFormattedProtocol('http:')).toBe('HTTP');
        expect(getFormattedProtocol('https:')).toBe('HTTPS');
    });

    it('classifies extension and non-web pages as secured', () => {
        expect(getFormattedProtocol('chrome-extension:')).toBe('SECURED');
        expect(getFormattedProtocol('moz-extension:')).toBe('SECURED');
        expect(getFormattedProtocol('file:')).toBe('SECURED');
    });

    it('maps protocols to their default ports', () => {
        expect(getFormattedPort('', 'HTTP')).toBe(80);
        expect(getFormattedPort('', 'HTTPS')).toBe(443);
        expect(getFormattedPort('', 'SECURED')).toBe(0);
    });

    it('preserves an explicit port', () => {
        expect(getFormattedPort('8443', 'HTTPS')).toBe(8443);
    });

    it('extracts URL properties using the protocol defaults', () => {
        expect(getUrlProps('https://example.com/path')).toEqual({
            hostname: 'example.com',
            port: 443,
            protocol: 'https:',
        });
    });
});

describe('checkSomeIsTrue', () => {
    it('should return true if at least one value is true', () => {
        expect(checkSomeIsTrue({
            one: true,
            two: false,
        }))
            .toEqual(true);
    });
    it('should return false if all values are false', () => {
        expect(checkSomeIsTrue({
            one: false,
            two: false,
        }))
            .toEqual(false);
    });
});

describe('compareSemver', () => {
    it('should return 0 if versions are equal', () => {
        expect(compareSemver('7.5.0', '7.5.0'))
            .toEqual(0);
        expect(compareSemver('2.5.0', '2.5.0'))
            .toEqual(0);
    });

    it('should return 1 if the first version argument is greater', () => {
        expect(compareSemver('7.5.3272.0', '7.5.0'))
            .toEqual(1);
        expect(compareSemver('7.5.1', '7.5.0'))
            .toEqual(1);
        expect(compareSemver('7.6.0', '7.5.0'))
            .toEqual(1);
    });

    it('should return -1 if the first version argument is lower', () => {
        expect(compareSemver('7.4.0', '7.5.0'))
            .toEqual(-1);
        expect(compareSemver('7.4.1', '7.5.0'))
            .toEqual(-1);
        expect(compareSemver('6.5.0', '7.5.0'))
            .toEqual(-1);
        expect(compareSemver('6.6.1', '7.5.0'))
            .toEqual(-1);
    });
});
