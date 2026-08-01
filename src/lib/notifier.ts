type Listener = (...args: any[]) => void;

/**
 * Implements notifier which allows other modules to subscribe to events or notify about events
 */
class Notifier {
    types: Record<string, string>;

    events: Record<string, string> = {};

    listeners: Record<string, Listener> = {};

    listenersEvents: Record<string, string | string[]> = {};

    listenerId = 0;

    getListenerId(): number {
        const id = this.listenerId;
        this.listenerId += 1;
        return id;
    }

    constructor(types: Record<string, string>) {
        this.types = types;
        Object.entries(this.types).forEach(([key, value]) => {
            this.events[value] = key;
        });
    }

    /**
     * Subscribes listener to the specified events
     */
    addSpecifiedListener(events: string | string[], listener: Listener): number {
        if (typeof listener !== 'function') {
            throw new Error('Illegal listener');
        }
        const listenerId = this.getListenerId();
        this.listeners[listenerId] = listener;
        this.listenersEvents[listenerId] = events;
        return listenerId;
    }

    /**
     * Subscribe specified listener to all events
     */
    addListener(listener: Listener): number {
        if (typeof listener !== 'function') {
            throw new Error('Illegal listener');
        }
        const listenerId = this.getListenerId();
        this.listeners[listenerId] = listener;
        return listenerId;
    }

    /**
     * Unsubscribe listener
     */
    removeListener(listenerId: number): void {
        delete this.listeners[listenerId];
        delete this.listenersEvents[listenerId];
    }

    /**
     * Notifies listeners about the events passed as arguments of this function.
     */
    notifyListeners(event: string, ...args: any[]): void {
        if (!event || !(event in this.events)) {
            throw new Error(`Illegal event: ${event}`);
        }
        // eslint-disable-next-line no-restricted-syntax
        for (const [listenerId, listener] of Object.entries(this.listeners)) {
            const events = this.listenersEvents[listenerId];
            if (events && events.length > 0 && events.indexOf(event) < 0) {
                // eslint-disable-next-line no-continue
                continue;
            }
            try {
                listener.apply(listener, args);
            } catch (ex) {
                const message = `Error invoking listener for event: "${event}" cause: ${ex}`;
                throw new Error(message);
            }
        }
    }
}

const types = {
    TAB_UPDATED: 'event.tab.updated',
    TAB_ACTIVATED: 'event.tab.activated',
    STATE_UPDATED: 'event.state.updated',
    SETTING_UPDATED: 'event.setting.updated',
};

const notifier = new Notifier(types);

export default notifier;
