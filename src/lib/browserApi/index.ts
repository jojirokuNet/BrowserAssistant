/**
 * @file Exports the browser API facade for the extension.
 */
import { runtime } from './runtime';
import { utils } from './utils';
import { action } from './action';

export const browserApi = {
    runtime,
    utils,
    action,
};
