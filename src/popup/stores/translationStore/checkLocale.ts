export type CheckLocaleResult =
    | { suitable: true; locale: string }
    | { suitable: false; locale: string | null };

const checkPartialKeyMatch = (keysToCheck: string[], key: string): string | undefined => {
    return keysToCheck.find((keyToCheck) => {
        return keyToCheck.includes(key);
    });
};

/**
 * Finds suitable locale key in messagesMap and returns it.
 * Accepts a null locale (the store's initial value); the failed result
 * then carries it through unchanged. The result is a discriminated
 * union, so reading `locale` after a `suitable` guard yields a string.
 */
const checkLocale = (
    messagesMap: Record<string, unknown>,
    locale: string | null,
): CheckLocaleResult => {
    if (!locale) {
        return { suitable: false, locale };
    }

    const normalized = locale.toLowerCase();

    // strict match
    if (messagesMap[normalized]) {
        return { suitable: true, locale: normalized };
    }

    if (normalized.length > 2) {
        // try to look up key with replaced hyphens to underscores
        const underscored = normalized.replace(/-/g, '_');
        if (messagesMap[underscored]) {
            return { suitable: true, locale: underscored };
        }

        // try to look up key with replaced underscores to hyphens
        const hyphened = normalized.replace(/_/g, '-');
        if (messagesMap[hyphened]) {
            return { suitable: true, locale: hyphened };
        }

        // try to look up shortened long locales
        return checkLocale(messagesMap, normalized.slice(0, 2));
    }

    // check partial key match, e.g "zh" when in messagesMap we have "zh_cn" and "zh_tw"
    const matchedLocale = checkPartialKeyMatch(Object.keys(messagesMap), normalized);
    if (matchedLocale) {
        return { suitable: true, locale: matchedLocale };
    }

    return { suitable: false, locale };
};

export default checkLocale;
