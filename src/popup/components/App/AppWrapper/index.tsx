import React, { useContext } from 'react';
import { observer } from 'mobx-react';

import rootStore from '../../../stores';
import Header from '../../Header';
import Loading from '../../ui/Loading';

interface AppWrapperProps {
    children?: React.ReactNode;
}

const AppWrapper = observer(({ children }: AppWrapperProps) => {
    const { uiStore } = useContext(rootStore);
    const { isPending } = uiStore;

    const disableEvent = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    const disableWhileLoading = isPending ? disableEvent : undefined;

    return (
        <div
            onKeyPressCapture={disableWhileLoading}
            onClickCapture={disableWhileLoading}
        >
            <Header />
            {isPending && <Loading />}
            {children}
        </div>
    );
});

export default AppWrapper;
