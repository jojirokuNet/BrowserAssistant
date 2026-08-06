/**
 * @file Command entry point of the translation scripts.
 */
import { program } from 'commander';

import { getErrorMessage } from '../../src/lib/errors';

import { downloadAndSave } from './download';
import { log } from './helpers';
import { LANGUAGES, REQUIRED_LOCALES } from './locales-constants';
import { checkUnusedMessages } from './unused';
import { uploadBaseLocale } from './upload';
import { checkTranslations } from './validate';

interface InfoCommandOptions {
    summary?: boolean;
    unused?: boolean;
}

interface LocalesCommandOptions {
    locales?: string[];
}

interface ValidateCommandOptions extends LocalesCommandOptions {
    min?: boolean;
}

const LOCALES = Object.keys(LANGUAGES); // locales to be downloaded

const download = async (locales: string[]): Promise<void> => {
    try {
        await downloadAndSave(locales);
        log.success('Download was successful');
        await checkTranslations(REQUIRED_LOCALES);
    } catch (e) {
        log.error(getErrorMessage(e));
        process.exit(1);
    }
};

const upload = async (): Promise<void> => {
    try {
        // check for unused base-locale strings before uploading
        await checkUnusedMessages();
        const result = await uploadBaseLocale();
        log.success(`Upload was successful with response: ${JSON.stringify(result)}`);
    } catch (e) {
        log.error(getErrorMessage(e));
        process.exit(1);
    }
};

const validate = async (locales: string[]): Promise<void> => {
    try {
        await checkTranslations(locales);
    } catch (e) {
        log.error(getErrorMessage(e));
        process.exit(1);
    }
};

const summary = async (isInfo: boolean): Promise<void> => {
    try {
        await checkTranslations(LOCALES, isInfo);
    } catch (e) {
        log.error(getErrorMessage(e));
        process.exit(1);
    }
};

const unused = async (): Promise<void> => {
    try {
        await checkUnusedMessages();
    } catch (e) {
        log.error(getErrorMessage(e));
        process.exit(1);
    }
};

program
    .command('info')
    .description('Shows locales info')
    .option('-s,--summary', 'for all locales translations readiness')
    .option('-N,--unused', 'for unused base-lang strings')
    .action((opts: InfoCommandOptions) => {
        const IS_INFO = true;
        if (opts.summary) {
            summary(IS_INFO);
        } else if (opts.unused) {
            unused();
        } else if (!opts.summary && !opts.unused) {
            summary(IS_INFO);
            unused();
        }
    });

program
    .command('download')
    .description('Downloads messages from localization service')
    .option('-l,--locales [list...]', 'specific list of space-separated locales')
    .action((opts: LocalesCommandOptions) => {
        const locales = opts.locales && opts.locales.length > 0 ? opts.locales : LOCALES;
        download(locales);
    });

program
    .command('upload')
    .description('Uploads base messages to the localization service')
    .action(upload);

program
    .command('validate')
    .description('Validates translations')
    .option('-R,--min', 'for only our required locales')
    .option('-l,--locales [list...]', 'for specific list of space-separated locales')
    .action((opts: ValidateCommandOptions) => {
        let locales;
        if (opts.min) {
            locales = REQUIRED_LOCALES;
        } else if (opts.locales && opts.locales.length > 0) {
            locales = opts.locales;
        } else {
            // defaults to validate all locales
            locales = LOCALES;
        }
        validate(locales);
    });

program.parse(process.argv);
