import {
    action,
    computed,
    makeObservable,
    observable,
} from 'mobx';

import {
    DEFAULT_MODAL_STATE,
    EVENT_TYPE_TO_MODAL_STATE_MAP,
    ORIGINAL_CERT_STATUS,
    HTTP_FILTERING_STATUS,
    SECURE_STATUS_MODAL_STATES,
    type ModalState,
} from '../consts';
import { checkSomeIsTrue } from '../../../lib/helpers';
import type { RootStore } from '..';

class UiStore {
    rootStore: RootStore;

    /**
     * Flag shows that extension has started to get information from native host on first start
     */
    isLoading = true;

    /**
     * Flag is set to the true when popup executes requests to the background
     */
    isPending = false;

    certStatusModalState: ModalState = { ...DEFAULT_MODAL_STATE };

    secureStatusModalState: ModalState = { ...DEFAULT_MODAL_STATE };

    constructor(rootStore: RootStore) {
        makeObservable(this, {
            isLoading: observable,
            isPending: observable,
            certStatusModalState: observable,
            secureStatusModalState: observable,
            isCertStatusModalOpen: computed,
            isPageStatusModalOpen: computed,
            globalTabIndex: computed,
            secureStatusModalInfo: computed,
            certStatus: computed,
            updateCertStatusModalState: action,
            resetCertStatusModalState: action,
            updateSecureStatusModalState: action,
            setExtensionLoading: action,
            setExtensionPending: action,
        });
        this.rootStore = rootStore;
    }

    get isCertStatusModalOpen(): boolean {
        return checkSomeIsTrue(this.certStatusModalState);
    }

    get isPageStatusModalOpen(): boolean {
        return checkSomeIsTrue(this.secureStatusModalState);
    }

    get globalTabIndex(): number {
        return (this.isLoading ? -1 : 0);
    }

    get secureStatusModalInfo() {
        const {
            pageProtocol, currentProtocol, originalCertStatus, isFilteringEnabled,
        } = this.rootStore.settingsStore;

        const { certStatus } = this;

        // The modal-info table mixes per-certificate records with flat
        // message entries, so navigation through it is dynamically
        // typed, exactly as it was in JS.
        let MODAL_INFO: any = SECURE_STATUS_MODAL_STATES[currentProtocol];

        if (pageProtocol.isHttps) {
            MODAL_INFO = MODAL_INFO[originalCertStatus];

            if (!certStatus.isInvalid) {
                const PROTECTION_STATUS = isFilteringEnabled
                    ? HTTP_FILTERING_STATUS.ENABLED : HTTP_FILTERING_STATUS.DISABLED;

                MODAL_INFO = MODAL_INFO[PROTECTION_STATUS];
            }
        }
        return MODAL_INFO || SECURE_STATUS_MODAL_STATES.DEFAULT;
    }

    get certStatus() {
        const { originalCertStatus } = this.rootStore.settingsStore;
        return ({
            isValid: originalCertStatus === ORIGINAL_CERT_STATUS.VALID,
            isInvalid: originalCertStatus === ORIGINAL_CERT_STATUS.INVALID,
            isBypassed: originalCertStatus === ORIGINAL_CERT_STATUS.BYPASSED,
            isNotFound: originalCertStatus === ORIGINAL_CERT_STATUS.NOTFOUND,
        });
    }

    updateCertStatusModalState = (
        eventType: string,
        newState: ModalState = EVENT_TYPE_TO_MODAL_STATE_MAP[eventType],
    ): void => {
        this.certStatusModalState = {
            ...this.certStatusModalState,
            ...newState,
        };
    };

    resetCertStatusModalState = (): void => {
        this.certStatusModalState = DEFAULT_MODAL_STATE;
    };

    updateSecureStatusModalState = (
        eventType: string,
        newState: ModalState = EVENT_TYPE_TO_MODAL_STATE_MAP[eventType],
    ): void => {
        this.secureStatusModalState = {
            ...this.secureStatusModalState,
            ...newState,
        };
    };

    setExtensionLoading = (isLoading: boolean): void => {
        this.isLoading = isLoading;
    };

    setExtensionPending = (isPending: boolean): void => {
        this.isPending = isPending;
    };
}

export default UiStore;
