import { PROTOCOLS, PROTOCOL_TO_PORT_MAP } from '../popup/stores/consts';

type Protocol = 'HTTPS' | 'HTTP' | 'SECURED';

/**
 * Returns URL properties of url if it was correct, otherwise returns input url
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
 * Checks if string is chrome-extension: or moz-extension: protocol
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
 * Returns url parts: port, protocol and hostname
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
 * Checks if string is a valid url with http: or https: protocol
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
 * otherwise, calculates it using the callback, memoizes it, and returns the value
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
 * Flattens the object by mapping its keys to the specified property of the nested object
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
 * Checks if at least one value of the object is strictly equal to true
 */
export const checkSomeIsTrue = (states: Record<string, unknown>): boolean => {
    return Object.values(states)
        .some((state) => state === true);
};

/**
 * If the semver string a is greater than b, return 1.
 * If the semver string b is greater than a, return -1.
 * If a equals b, return 0;
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

