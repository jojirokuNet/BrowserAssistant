/**
 * @file Event notifier allowing modules to subscribe and notify.
 */
type Listener = (...args: any[]) => void;

/**
 * Implements notifier which allows other modules to subscribe to events or notify about events.
 */
class Notifier {
    /**
     * Map of event type names to their string values.
     */
    types: Record<string, string>;

    /**
     * Map of event types to their listener events.
     */
    events: Record<string, string> = {};

    /**
     * Map of listener ids to the registered listeners.
     */
    listeners: Record<string, Listener> = {};

    /**
     * Map of listeners to their subscribed event types.
     */
    listenersEvents: Record<string, string | string[]> = {};

    /**
     * Counter of the last issued listener id.
     */
    listenerId = 0;

    /**
     * Returns the next listener id and increments the counter.
     * @returns The next listener id.
     */
    getListenerId(): number {
        const id = this.listenerId;
        this.listenerId += 1;
        return id;
    }

    /**
     * Creates the notifier with the given event types.
     * @param types Map of event type names to their string values.
     */
    constructor(types: Record<string, string>) {
        this.types = types;
        Object.entries(this.types).forEach(([key, value]) => {
            this.events[value] = key;
        });
    }

    /**
     * Subscribes listener to the specified events.
     * @param events Events to subscribe the listener to.
     * @param listener Listener to subscribe.
     * @returns Id of the registered listener.
     * @throws When the listener is not a function.
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
     * Subscribe specified listener to all events.
     * @param listener Listener to subscribe.
     * @returns Id of the registered listener.
     * @throws When the listener is not a function.
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
     * Unsubscribe listener.
     * @param listenerId Id of the listener to unsubscribe.
     */
    removeListener(listenerId: number): void {
        delete this.listeners[listenerId];
        delete this.listenersEvents[listenerId];
    }

    /**
     * Notifies listeners about the events passed as arguments of this function.
     * @param event Event to notify the listeners about.
     * @param args Arguments to pass to the listeners.
     * @throws When the event is not a known event, or when a listener
     * throws.
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
