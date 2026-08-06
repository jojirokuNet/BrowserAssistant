/**
 * @file UI store of the popup.
 */
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

/**
 * MobX store of the popup UI state.
 */
class UiStore {
    /**
     * Root store of the popup.
     */
    rootStore: RootStore;

    /**
     * Flag shows that extension has started to get information from native host on first start.
     */
    isLoading = true;

    /**
     * Flag is set to the true when popup executes requests to the background.
     */
    isPending = false;

    /**
     * State of the certificate status modal.
     */
    certStatusModalState: ModalState = { ...DEFAULT_MODAL_STATE };

    /**
     * State of the secure status modal.
     */
    secureStatusModalState: ModalState = { ...DEFAULT_MODAL_STATE };

    /**
     * Creates the UI store of the popup.
     * @param rootStore Root store of the popup.
     */
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

    /**
     * Checks whether the certificate status modal is open.
     * @returns True when any certificate status modal state field is set.
     */
    get isCertStatusModalOpen(): boolean {
        return checkSomeIsTrue(this.certStatusModalState);
    }

    /**
     * Checks whether the page status modal is open.
     * @returns True when any page status modal state field is set.
     */
    get isPageStatusModalOpen(): boolean {
        return checkSomeIsTrue(this.secureStatusModalState);
    }

    /**
     * Returns the active tab index, or -1 while the popup is loading.
     * @returns The active tab index.
     */
    get globalTabIndex(): number {
        return (this.isLoading ? -1 : 0);
    }

    /**
     * Returns the modal info rows for the current secure status.
     * @returns The secure status modal info.
     */
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

    /**
     * Returns the certificate status flags of the current url.
     * @returns Object with the certificate status flags.
     */
    get certStatus() {
        const { originalCertStatus } = this.rootStore.settingsStore;
        return ({
            isValid: originalCertStatus === ORIGINAL_CERT_STATUS.VALID,
            isInvalid: originalCertStatus === ORIGINAL_CERT_STATUS.INVALID,
            isBypassed: originalCertStatus === ORIGINAL_CERT_STATUS.BYPASSED,
            isNotFound: originalCertStatus === ORIGINAL_CERT_STATUS.NOTFOUND,
        });
    }

    /**
     * Updates the certificate status modal state.
     * @param eventType Type of the event that changed the state.
     * @param newState New modal state, derived from the event when omitted.
     */
    updateCertStatusModalState = (
        eventType: string,
        newState: ModalState = EVENT_TYPE_TO_MODAL_STATE_MAP[eventType],
    ): void => {
        this.certStatusModalState = {
            ...this.certStatusModalState,
            ...newState,
        };
    };

    /**
     * Resets the certificate status modal state to the default.
     */
    resetCertStatusModalState = (): void => {
        this.certStatusModalState = DEFAULT_MODAL_STATE;
    };

    /**
     * Updates the secure status modal state.
     * @param eventType Type of the event that changed the state.
     * @param newState New modal state, derived from the event when omitted.
     */
    updateSecureStatusModalState = (
        eventType: string,
        newState: ModalState = EVENT_TYPE_TO_MODAL_STATE_MAP[eventType],
    ): void => {
        this.secureStatusModalState = {
            ...this.secureStatusModalState,
            ...newState,
        };
    };

    /**
     * Sets whether the extension is loading.
     * @param isLoading Whether the extension is loading.
     */
    setExtensionLoading = (isLoading: boolean): void => {
        this.isLoading = isLoading;
    };

    /**
     * Sets whether the extension start is pending.
     * @param isPending Whether the extension start is pending.
     */
    setExtensionPending = (isPending: boolean): void => {
        this.isPending = isPending;
    };
}

export default UiStore;
