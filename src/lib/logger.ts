// TODO switch to a less verbose level later
const CURRENT_LEVEL = 'DEBUG';

const LEVELS = {
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
};

type LogLevel = keyof typeof LEVELS;

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

const print = (level: LogLevel, method: ConsoleMethod, args?: unknown[]): void => {
    // check log level
    if (LEVELS[CURRENT_LEVEL] < LEVELS[level]) {
        return;
    }
    if (!args || args.length === 0 || !args[0]) {
        return;
    }

    const now = new Date();
    const formatted = `${now.toISOString()}:`;
    // eslint-disable-next-line no-console
    console[method](formatted, ...args);
};

export const log = {
    debug(...args: unknown[]) {
        print('DEBUG', 'log', args);
    },

    info(...args: unknown[]) {
        print('INFO', 'info', args);
    },

    warn(...args: unknown[]) {
        print('WARN', 'warn', args);
    },

    error(...args: unknown[]) {
        print('ERROR', 'error', args);
    },
};
