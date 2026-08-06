/**
 * To enable stub host api
 * 1. Comment import from nativeHostApi and Api declaration
 * 2. Uncomment import from stubHostApi and Api declaration.
 * @file Re-exports the native host API implementation used by the background.
 */

// import { StubHostApi } from './stubHostApi';
// const Api = StubHostApi;

import { NativeHostApi } from './nativeHostApi';

const Api = NativeHostApi;

export { Api };
