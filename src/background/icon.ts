import throttle from 'lodash/throttle';

import notifier from '../lib/notifier';
import { tabs, type PreparedTab } from '../lib/tabs';

import actions from './actions';
import state from './state';
import { ContextMenu } from './contextMenu';

/**
 * This class handles browser action icon updates
 */
class Icon {
    constructor() {
        // If updates of icon happen too often ignore them
        const ICON_THROTTLE_TIMEOUT_MS = 50;
        const throttledUpdater = throttle(async (tab?: PreparedTab) => {
            if (tab) {
                await this.updateIcon(tab);
            }
            // There may be opened more than one window opened
            const activeTabs = await tabs.getActiveTabs();
            activeTabs.forEach((tab) => {
                this.updateIcon(tab);
            });
        }, ICON_THROTTLE_TIMEOUT_MS);

        // Subscribe to events after which icon should update
        notifier.addSpecifiedListener(notifier.types.TAB_ACTIVATED, throttledUpdater);
        notifier.addSpecifiedListener(notifier.types.TAB_UPDATED, throttledUpdater);
        notifier.addSpecifiedListener(notifier.types.STATE_UPDATED, throttledUpdater);
    }

    /**
     * Updates icon according to the current app and tab state
     */
    updateIcon = async (tab: PreparedTab): Promise<void> => {
        if (!state.isAppWorking()) {
            // The id casts keep today's runtime: undefined ids flow into
            // actions, whose `if (tabId)` guard skips the per-tab set.
            await actions.setIconDisabled(tab.id as number);
            await ContextMenu.controlledUpdate();
            return;
        }

        const currentFilteringState = await state.getCurrentFilteringState(tab);
        await ContextMenu.controlledUpdate();

        const isFilteringEnabled = currentFilteringState
            ? currentFilteringState.isFilteringEnabled
            : true;

        if (isFilteringEnabled) {
            await actions.setIconEnabled(tab.id as number);
        } else {
            await actions.setIconDisabled(tab.id as number);
        }
    };
}

export default new Icon();
