import { rspack } from '@rspack/core';
import type { Configuration as RspackConfiguration } from '@rspack/core';

import { cliLog } from '../cli-log';

import { createArchive } from './archive';

export const bundleRspack = (
    rspackConfig: RspackConfiguration,
    watch: boolean,
    browser: string,
): Promise<void> => {
    const compiler = rspack(rspackConfig);

    const run = watch
        ? (cb: (err?: Error | null, stats?: any) => void) => compiler.watch({}, cb)
        : (cb: (err?: Error | null, stats?: any) => void) => compiler.run(cb);

    return new Promise<void>((resolve, reject) => {
        run((err: Error | null | undefined, stats: any) => {
            if (err) {
                cliLog.error(err.stack || err.message || err.name);
                if ((err as any).details) {
                    cliLog.error((err as any).details);
                }
                reject();
                return;
            }

            if (!stats) {
                resolve();
                return;
            }

            if (stats.hasErrors()) {
                cliLog.info(stats.toString({
                    colors: true,
                    all: false,
                    errors: true,
                    moduleTrace: true,
                    logging: 'error',
                }));
                reject();
                return;
            }

            cliLog.info(stats.toString({
                chunks: false,
                colors: true,
            }));

            // Create zip archive for non-watch builds (matches webpack
            // ZipWebpackPlugin behavior).
            if (!watch) {
                const outputPath = (rspackConfig.output?.path) as string;
                createArchive(outputPath, browser)
                    .then(resolve)
                    .catch((archiveErr: Error) => {
                        cliLog.error(`Archive failed: ${archiveErr.message}`);
                        reject();
                    });
            } else {
                resolve();
            }
        });
    });
};
