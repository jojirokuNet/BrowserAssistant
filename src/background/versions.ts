/**
 * @file Extension and API versions read from the package.json.
 */
import config from '../../package.json';

const versions = {
    version: config.version,
    apiVersion: config.apiVersion,
    userAgent: self.navigator.userAgent,
};

export default versions;
