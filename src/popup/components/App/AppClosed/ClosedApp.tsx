/**
 * @file View shown when the desktop application is closed.
 */
import React, { useContext } from 'react';

import classnames from 'classnames';

import rootStore from '../../../stores';

interface ClosedAppProps {
    isLoading?: boolean;
    content: string;
    buttonText?: string;
    globalTabIndex?: number;
    onClick?: () => void;
}

const ClosedApp = ({
    isLoading, content, buttonText, globalTabIndex, onClick,
}: ClosedAppProps) => {
    const { translationStore } = useContext(rootStore);

    const { translate } = translationStore;

    const buttonClass = classnames({
        'app-closed__button': true,
        'app-closed__button--transparent': isLoading,
    });

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        (e.target as HTMLElement).blur();
        if (onClick) {
            onClick();
        }
    };

    return (
        <div className="app-closed__container">
            <div className="app-closed__status-container">
                <header className="app-closed__status">{translate(content)}</header>
            </div>
            {buttonText && (
                <div>
                    <button
                        className={buttonClass}
                        type="button"
                        tabIndex={globalTabIndex}
                        onClick={handleClick}
                    >
                        {translate(buttonText)}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ClosedApp;
