/*
 * Event functions used internally. These are very similiar to all other
 * EventEmitter implementations that exist for Node, but supports setting
 * the context when emitting events.
 */

function EventEmitter(defaultCtx) {
    this._listeners = {};
    this._anyListeners = {};

    this._context = defaultCtx || this;
}

EventEmitter.prototype.on = function(eventName, listener) {
    var listeners = this._listeners[eventName] || (this._listeners[eventName] = []);
    listeners.push(listener);
};

EventEmitter.prototype.off = function(eventName, listener) {
    var listeners = this._listeners[eventName];
    if(! listeners) return;

    var idx = listeners.indexOf(listener);
    if(idx < 0) return;

    listeners.splice(idx, 1);
};

EventEmitter.prototype.onAny = function(eventName, listener) {
    var listeners = this._anyListeners[eventName] || (this._anyListeners[eventName] = []);
    listeners.push(listener);
};

EventEmitter.prototype.offAny = function(eventName, listener) {
    var listeners = this._anyListeners[eventName];
    if(! listeners) return;

    var idx = listeners.indexOf(listener);
    if(idx < 0) return;

    listeners.splice(idx, 1);
};

EventEmitter.prototype.emit = function(event) {
    var ctx = this._context;
    var allArgs = arguments;
    var args = Array.prototype.slice.call(arguments).slice(1);

    var listeners = this._listeners[event];
    if(listeners) {
        listeners.forEach(function(listener) {
            listener.apply(ctx, args);
        });
    }

    listeners = this._anyListeners[event];
    if(listeners) {
        listeners.forEach(function(listener) {
            listener.apply(ctx, allArgs);
        });
    }
};

EventEmitter.prototype.emitWithContext = function(ctx, event) {
    var allArgs = arguments;
    var args = Array.prototype.slice.call(arguments).slice(1);

    var listeners = this._listeners[event];
    if(listeners) {
        listeners.forEach(function(listener) {
            listener.apply(ctx, args);
        });
    }

    listeners = this._anyListeners[event];
    if(listeners) {
        listeners.forEach(function(listener) {
            listener.apply(ctx, allArgs);
        });
    }
};

module.exports.EventEmitter = EventEmitter;
