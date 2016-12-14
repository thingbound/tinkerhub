/**
 * Mixin support for events. Used to apply the same event behaviour to instances.
 * This support both normal events and fluent APIs:
 *
 * Normal: `obj.on('test', function);`
 * Fluent: `obj.on('test').then(function);`
 */
'use strict';
const Q = require('q');

class Resolver {
    constructor(events, type, args) {
        this._events = events;
        this._type = type;
        this._args = args;
    }

    then(listener) {
        if(! listener) {
            throw new Error('Event listener required');
        }

        const deferred = Q.defer();
        const args = this._args;
        args.push(function(data) {
            deferred.resolve(data);
        });
        this._events[this._type].apply(this._events, args);
        return deferred.promise
            .then(listener);
    }
}

module.exports = function(obj) {
    obj.on = function(event, listener) {
        if(listener) {
            this._events.on(event, listener);
        } else {
            return new Resolver(this._events, 'on', [ event ]);
        }
    };

    obj.once = function(event, listener) {
        if(listener) {
            this._events.once(event, listener);
        } else {
            return new Resolver(this._events, 'once', [ event ]);
        }
    };

    obj.off = function(event, listener) {
        this._events.off(event, listener);
    };

    obj.onAny = function(listener) {
        if(listener) {
            this._events.onAny(listener);
        } else {
            return new Resolver(this._events, 'onAny', []);
        }
    };

    obj.offAny = function(listener) {
        this._events.offAny(listener);
    };

    obj.when = function(event, limit, listener) {
        if(listener) {
            this._events.when(event, limit, listener);
        } else {
            return new Resolver(this._events, 'when', [ event, limit ]);
        }
    }
};
