/**
 * @file Exports the singleton settings store.
 */
import { storage } from '../storage';

import { Settings } from './Settings';

export const settings = new Settings(storage);
