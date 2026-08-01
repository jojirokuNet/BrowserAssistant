import fs from 'fs';
import path from 'path';

import axios, { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';

import { getErrorMessage } from '../../src/lib/errors';

import {
    BASE_LOCALE,
    PROJECT_ID,
    API_URL,
    LOCALES_RELATIVE_PATH,
    FORMAT,
    LOCALE_DATA_FILENAME,
} from './locales-constants';

const API_UPLOAD_URL = `${API_URL}/upload`;
const LOCALES_DIR = path.resolve(__dirname, LOCALES_RELATIVE_PATH);

/**
 * Build form data for uploading translation
 * @param filePath path to the base locale messages file
 */
const getFormData = (filePath: string): FormData => {
    const formData = new FormData();

    formData.append('format', FORMAT);
    formData.append('language', BASE_LOCALE);
    formData.append('project', PROJECT_ID);
    formData.append('filename', LOCALE_DATA_FILENAME);
    formData.append('file', fs.createReadStream(filePath));

    return formData;
};

/**
 * Entry point for uploading translations
 */
export const uploadBaseLocale = async (): Promise<unknown> => {
    const filePath = path.join(LOCALES_DIR, BASE_LOCALE, LOCALE_DATA_FILENAME);
    const formData = getFormData(filePath);

    try {
        // `contentType` is not an axios option (axios ignores it — the
        // multipart header comes from form-data); it is kept verbatim and
        // asserted so the AxiosRequestConfig excess-property check passes.
        const response = await axios.post(API_UPLOAD_URL, formData, {
            contentType: 'multipart/form-data',
            headers: formData.getHeaders(),
        } as AxiosRequestConfig);
        return response.data;
    } catch (e) {
        throw new Error(`Error: ${getErrorMessage(e)}, while uploading: ${API_UPLOAD_URL}`);
    }
};
