'use strict';

/*
 * Event functions used internally. These are very similiar to all other
 * EventEmitter implementations that exist for Node, but supports setting
 * the context when emitting events.
 */

class EventEmitter {
    constructor(defaultCtx) {
        this._listeners = {};
        this._anyListeners = [];

        this._context = defaultCtx || this;
    }

    _triggerListenerChange() {
        if(! this._listenerChangeListener) return;

        const hasListeners = Object.keys(this._listeners).length;
        this._listenerChangeListener(hasListeners);
    }

    /**
     * Listen for a specific event.
     *
     * @param eventName The event to listen for
     * @param listener The function that will be triggered
     */
    on(eventName, listener) {
        var listeners = this._listeners[eventName] || (this._listeners[eventName] = []);
        listeners.push(listener);

        this._triggerListenerChange();

        return {
            stop: () => {
                this.off(eventName, listener);
            }
        };
    }

    /**
     * Stop listening for an event.
     *
     * @param eventName The event to no longer listen to
     * @param listener The function that should be removed
     */
    off(eventName, listener) {
        if(! listener) return;

        var listeners = this._listeners[eventName];
        if(! listeners) return;

        var idx = listeners.indexOf(listener);
        if(idx < 0) return;

        listeners.splice(idx, 1);

        this._triggerListenerChange();
    }

    /**
     * Listen for a any event.
     *
     * @param eventName The event to listen for
     * @param listener The function that will be triggered
     */
    onAny(listener) {
        this._anyListeners.push(listener);

        this._triggerListenerChange();

        return {
            stop: () => this.offAny(listener)
        };
    }

    /**
     * Stop listening for an event.
     *
     * @param eventName The event to no longer listen to
     * @param listener The function that should be removed
     */
    offAny(listener) {
        var idx = this._anyListeners.indexOf(listener);
        if(idx < 0) return;

        this._anyListeners.splice(idx, 1);

        this._triggerListenerChange();
    }

    /**
     * Listen for an event but only trigger the listener if a certain
     * limit returns true.
     */
    when(eventName, limit, listener) {
        const limitedListener = function(data) {
            if(limit(data)) {
                listener.call(this, data);
            }
        };
        this.on(eventName, limitedListener);

        return {
            stop: () => {
                this.off(eventName, limitedListener);
            }
        };
    }

    /**
     * Trigger a listener only once.
     */
    once(eventName, listener) {
        const removingListener = function() {
            this.off(eventName, removingListener);

            listener.apply(this, arguments);
        };

        this.on(eventName, removingListener);
        return {
            stop: () => {
                this.off(eventName, removingListener)
            }
        };
    }

    /**
     * Emit an event. The first argument is the event name and all following
     * arguments are sent to any listener registered.
     */
    emit(event) {
        var ctx = this._context;
        var allArgs = arguments;
        var args = Array.prototype.slice.call(arguments).slice(1);

        var listeners = this._listeners[event];
        if(listeners) {
            listeners.forEach(function(listener) {
                listener.apply(ctx, args);
            });
        }

        this._anyListeners.forEach(function(listener) {
            listener.apply(ctx, allArgs);
        });
    }

    /**
     * Emit an event with a specific context. The first argument is the context,
     * the second is the event name and all following arguments are sent to the
     * registered listeners.
     */
    emitWithContext(ctx, event) {
        var allArgs = Array.prototype.slice.call(arguments, 1);
        var args = Array.prototype.slice.call(arguments, 2);

        var listeners = this._listeners[event];
        if(listeners) {
            listeners.forEach(function(listener) {
                listener.apply(ctx, args);
            });
        }

        this._anyListeners.forEach(function(listener) {
            listener.apply(ctx, allArgs);
        });
    }
}

module.exports.EventEmitter = EventEmitter;
module.exports.mixin = require('./mixin');
