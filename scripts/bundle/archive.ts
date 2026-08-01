import {
    createWriteStream,
    existsSync,
    mkdirSync,
} from 'fs';
import path from 'path';

import { ZipArchive } from 'archiver';

import { cliLog } from '../cli-log';

/**
 * Creates a zip archive of the build output directory.
 *
 * Produces `{browser}.zip` at one level above the output directory,
 * matching the layout of the retired zip-webpack-plugin.
 *
 * @param outputDir - Absolute path to the built extension directory
 *   (e.g., `.../build/dev/chrome/`)
 * @param browser - Browser name used as the zip filename stem
 */
export const createArchive = (
    outputDir: string,
    browser: string,
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const parentDir = path.dirname(outputDir);
        const zipPath = path.join(parentDir, `${browser}.zip`);

        if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true });
        }

        const output = createWriteStream(zipPath);
        const archive = new ZipArchive({ zlib: { level: 9 } });

        output.on('close', () => {
            cliLog.info(`Archive created: ${zipPath} (${archive.pointer()} bytes)`);
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);
        archive.directory(outputDir, false);
        // finalize() returns a promise in archiver v8; reject on failure so
        // build errors are not swallowed as unhandled rejections.
        archive.finalize().catch(reject);
    });
};
