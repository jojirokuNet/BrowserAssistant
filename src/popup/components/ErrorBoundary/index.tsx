/**
 * @file Exports the error boundary catching render errors.
 */
import React from 'react';

import { log } from '../../../lib/logger';
import ClosedApp from '../App/AppClosed/ClosedApp';
import Header from '../Header';
import { StoreConsumer } from '../../stores';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * React error boundary that catches popup render errors and logs them.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    /**
     * Creates the boundary with the initial no-error state.
     * @param props Component props.
     */
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }

    /**
     * Returns the state carrying the error so the fallback UI renders.
     * @param error Error thrown by a child component.
     * @returns State carrying the caught error.
     */
    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    /**
     * Logs the error caught from a child component.
     * @param error Error thrown by a child component.
     */
    componentDidCatch(error: Error) {
        log.error(error);
    }

    /**
     * Renders the fallback UI when an error occurred, children otherwise.
     * @returns The element to render.
     */
    render() {
        const { error } = this.state;
        const { children } = this.props;

        return error ? (
            <StoreConsumer>
                {(props) => (
                    <>
                        <Header />
                        <ClosedApp
                            content="something_went_wrong"
                            buttonText="contact_support"
                            onClick={props.settingsStore.contactSupport}
                        />
                    </>
                )}
            </StoreConsumer>
        ) : children;
    }
}

export default ErrorBoundary;
