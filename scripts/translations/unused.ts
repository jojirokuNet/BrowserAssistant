/**
 * @file Reports translation keys not used in the extension sources.
 */
import fs from 'fs';
import path from 'path';

import { getLocaleTranslations, log } from './helpers';
import {
    BASE_LOCALE,
    SRC_RELATIVE_PATH,
    SRC_FILENAME_EXTENSIONS,
    PERSISTENT_MESSAGES,
    LOCALES_RELATIVE_PATH,
    LOCALE_DATA_FILENAME,
} from './locales-constants';

const LOCALES_DIR = path.resolve(__dirname, LOCALES_RELATIVE_PATH);
const SRC_DIR = path.resolve(__dirname, SRC_RELATIVE_PATH);

/**
 * Checks whether the file extension is one of the source file extensions.
 * @param filePath Path to the file.
 * @returns Whether the file can contain locale strings.
 */
const canContainLocalesStrings = (filePath: string): boolean => {
    let isSrcFile = false;
    const extensions: string[] = SRC_FILENAME_EXTENSIONS;
    for (let i = 0; i < extensions.length; i += 1) {
        isSrcFile = filePath.endsWith(extensions[i]) || isSrcFile;

        if (isSrcFile) {
            break;
        }
    }

    return isSrcFile && !filePath.includes(LOCALES_DIR);
};

/**
 * Collects the contents of the source files in the given directory.
 * @param dirPath Path to the directory.
 * @param contents Accumulated file contents.
 * @returns Contents of the source files in the directory.
 */
const getSrcFilesContents = (dirPath: string, contents: string[] = []): string[] => {
    fs.readdirSync(dirPath).forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            getSrcFilesContents(fullPath, contents);
        } else if (canContainLocalesStrings(fullPath)) {
            contents.push(fs.readFileSync(fullPath).toString());
        }
    });
    return contents;
};

/**
 * Checks if there are unused base-locale strings in source files.
 */
export const checkUnusedMessages = async (): Promise<void> => {
    const baseLocaleTranslations = await getLocaleTranslations(
        LOCALES_DIR, BASE_LOCALE, LOCALE_DATA_FILENAME,
    );
    const baseMessages = Object.keys(baseLocaleTranslations);

    const filesContents = getSrcFilesContents(SRC_DIR);

    const isPresentInFile = (message: string, file: string): boolean => {
        return file.includes(`'${message}'`) || file.includes(`"${message}"`);
    };

    const persistentMessages: string[] = PERSISTENT_MESSAGES;
    const isMessageUnused = (message: string): boolean => {
        return !persistentMessages.includes(message)
            && !filesContents.some((file) => isPresentInFile(message, file));
    };

    const unusedMessages = baseMessages.filter(isMessageUnused);

    if (unusedMessages.length === 0) {
        log.success('There are no unused messages');
    } else {
        log.warning('Unused messages:');
        unusedMessages.forEach((key) => {
            log.warning(`  ${key}`);
        });
    }
};
