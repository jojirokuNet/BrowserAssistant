/**
 * @file Helpers for normalizing caught errors.
 */
type ErrorWithMessage = {
    message: string
};

/**
 * Checks whether the value is an object with a string message property.
 * @param error Value to check.
 * @returns True if the value has a string message property.
 */
function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Converts an unknown caught error into an object with a string message.
 * @param maybeError Error to convert.
 * @returns The error object with a string message.
 */
function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
    if (isErrorWithMessage(maybeError)) {
        return maybeError;
    }

    try {
        return new Error(JSON.stringify(maybeError));
    } catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError));
    }
}

/**
 * Extracts the message string from an unknown caught error.
 * @param error Error to extract the message from.
 * @returns The error message string.
 */
export function getErrorMessage(error: unknown) {
    return toErrorWithMessage(error).message;
}
