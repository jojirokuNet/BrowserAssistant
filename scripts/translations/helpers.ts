/**
 * @file Shared helpers for the translation scripts.
 */
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
 * Single entry of a locale messages.json file.
 */
export interface LocaleMessage {
    message: string;
    description?: string;
}

/**
 * Locale messages dictionary keyed by message id.
 */
export type LocaleMessages = Record<string, LocaleMessage>;

/**
 * Reads the locale messages for the requested locale from disk.
 * @param localesDir Path to the locales directory.
 * @param locale Locale code to read.
 * @param localesDataFilename Name of the messages file inside the locale
 * directory.
 * @returns Parsed locale messages for the requested locale.
 * @throws When the messages file contains invalid JSON.
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
 * Compares two arrays element-wise.
 * @param arr1 First array to compare.
 * @param arr2 Second array to compare.
 * @returns Whether the two arrays are equal element-wise.
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
