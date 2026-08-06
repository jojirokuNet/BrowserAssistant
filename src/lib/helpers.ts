/**
 * @file Utility helpers shared across the extension contexts.
 */
import { PROTOCOLS, PROTOCOL_TO_PORT_MAP } from '../popup/stores/consts';

type Protocol = 'HTTPS' | 'HTTP' | 'SECURED';

/**
 * Returns URL properties of url if it was correct, otherwise returns input url.
 * @param url URL to parse.
 * @returns URL object, or the input url when parsing fails.
 */
export const getUrlProperties = (url: string): URL | string => {
    try {
        const urlObj = new URL(url);
        return urlObj;
    } catch (e) {
        return url;
    }
};

/**
 * Checks if string is chrome-extension: or moz-extension: protocol.
 * @param protocol Protocol to check.
 * @returns Whether the protocol is a chrome-extension or moz-extension
 * protocol.
 */
export const isExtensionProtocol = (protocol: string): boolean => {
    return /^(chrome|moz)-extension:/.test(protocol);
};

export const getFormattedPort = (port: string, protocol: Protocol): number => {
    const defaultPort = PROTOCOL_TO_PORT_MAP[protocol];
    return port === '' || !port ? defaultPort : Number(port);
};

export const getFormattedProtocol = (protocol: string): Protocol => {
    const protocols = PROTOCOLS as Record<string, Protocol>;
    const formattedProtocol = protocol && protocol.slice(0, -1).toUpperCase();
    return protocols[formattedProtocol] || protocols.SECURED;
};

/**
 * Returns url parts: port, protocol and hostname.
 * @param url URL to parse.
 * @returns Port, protocol and hostname of the url.
 */
export const getUrlProps = (url: string): { port: number; protocol: string; hostname: string } => {
    const { hostname, port, protocol } = getUrlProperties(url) as URL;
    const formattedProtocol = getFormattedProtocol(protocol);
    const formattedPort = getFormattedPort(port, formattedProtocol);

    return {
        port: formattedPort,
        protocol,
        hostname,
    };
};

/**
 * Checks if string is a valid url with http: or https: protocol.
 * @param str URL string to check.
 * @returns Whether the url uses the http or https protocol.
 */
export const isHttp = (str: string): boolean => {
    let url: URL;
    try {
        url = new URL(str);
    } catch (e) {
        return false;
    }
    return /^https?:/.test(url.protocol);
};

/**
 * Returns the value of the property from the cache,
 * otherwise, calculates it using the callback, memoizes it, and returns the value.
 * @param obj Object to memoize the value on.
 * @param prop Name of the property to compute.
 * @param func Callback computing the value.
 * @returns The cached or freshly computed value.
 */
export const lazyGet = <T extends object, V>(obj: T, prop: string, func: (this: T) => V): V => {
    const cachedProp = `_${prop}`;
    const store = obj as unknown as Record<string, V>;
    if (cachedProp in store) {
        return store[cachedProp];
    }

    const value = func.apply(obj);
    store[cachedProp] = value;
    return value;
};

/**
 * Flattens the object by mapping its keys to the specified property of the nested object.
 * @param obj Object to flatten.
 * @param propName Property of the nested objects to map the keys to.
 * @returns Flattened object.
 */
export const flattenNestedObj = <T extends Record<string, unknown>, K extends keyof T>(
    obj: Record<string, T>,
    propName: K,
): Record<string, T[K]> => {
    return Object.entries(obj)
        .reduce((acc, [key, value]) => {
            acc[key] = value[propName];
            return acc;
        }, {} as Record<string, T[K]>);
};

/**
 * Checks if at least one value of the object is strictly equal to true.
 * @param states Object with values to check.
 * @returns Whether at least one value is strictly true.
 */
export const checkSomeIsTrue = (states: Record<string, unknown>): boolean => {
    return Object.values(states)
        .some((state) => state === true);
};

/**
 * Compares two semver strings. If the semver string a is greater than b,
 * return 1. If the semver string b is greater than a, return -1. If a
 * equals b, return 0.
 * @param a First semver string.
 * @param b Second semver string.
 * @returns 1 when a is greater, -1 when b is greater, 0 when equal.
 */
export const compareSemver = (a: string, b: string): -1 | 0 | 1 => {
    const pa = a.split('.');
    const pb = b.split('.');
    for (let i = 0; i < 3; i += 1) {
        const na = Number(pa[i]);
        const nb = Number(pb[i]);
        if (na > nb) return 1;
        if (nb > na) return -1;
        const { isNaN } = Number;
        if (!isNaN(na) && isNaN(nb)) return 1;
        if (isNaN(na) && !isNaN(nb)) return -1;
    }
    return 0;
};

