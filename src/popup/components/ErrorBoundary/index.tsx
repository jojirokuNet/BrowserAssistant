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

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error) {
        log.error(error);
    }

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
