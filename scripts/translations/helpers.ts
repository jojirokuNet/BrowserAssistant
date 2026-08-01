/* eslint-disable no-console */
import { promises as fs } from 'fs';
import path from 'path';

import chalk from 'chalk';

export const log = {
    info: (str: string) => {
        console.log(str);
    },
    success: (str: string) => {
        console.log(chalk.green.bgBlack(str));
    },
    warning: (str: string) => {
        console.log(chalk.black.bgYellowBright(str));
    },
    error: (str: string) => {
        console.log(chalk.bold.yellow.bgRed(str));
    },
};

/**
 * Single entry of a locale messages.json file
 */
export interface LocaleMessage {
    message: string;
    description?: string;
}

/**
 * Locale messages dictionary keyed by message id
 */
export type LocaleMessages = Record<string, LocaleMessage>;

/**
 * Gets strings for certain locale
 * @param localesDir path to the locales directory
 * @param locale locale code
 * @param localesDataFilename locale data filename
 */
export const getLocaleTranslations = async (
    localesDir: string,
    locale: string,
    localesDataFilename: string,
): Promise<LocaleMessages> => {
    const filePath = path.join(localesDir, locale, localesDataFilename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
};

/**
 * Compares two arrays
 */
export const areArraysEqual = (arr1: string[], arr2: string[]): boolean => {
    if (!arr1 || !arr2) {
        return false;
    }
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i += 1) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
};
