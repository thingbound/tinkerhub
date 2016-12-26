'use strict';

const mixinEvents = require('../events').mixin;
const EventEmitter = require('../events').EventEmitter;
const Q = require('q');

const unavailableMetadata = {
    available: false
};

class PublicDevice {
    constructor() {
        this._events = new EventEmitter(this);
        this._listener = (event, payload) => this._events.emit(event, payload);

        mixinEvents(this);
    }

    get _device() {
        return this.__device;
    }

    set _device(device) {
        if(this.__device) {
            this.__device.offAny(this._listener);
        }

        this.__device = device;
        if(device) {
            device.onAny(this._listener);
        }
    }

    get metadata() {
        return this._device ? this._device.metadata : unavailableMetadata;
    }

    call(action, args) {
        if(this._device) {
            return this._device.call(action.toString(), args);
        } else {
            return Q.reject('Device is not available');
        }
    }
}

/**
 * Create the public API for the given device.
 */
module.exports = function(id) {
    const publicDevice = new PublicDevice(id);
    const cache = {};

    return new Proxy(publicDevice, {
        get: function(proxy, name) {
            if(name === '_') {
                return publicDevice;
            } else if(name[0] === '_') {
                return undefined;
            } else if(name === 'inspect' || name === 'toString') {
                return function() { return 'Device[' + id + ']' };
            } else if(typeof publicDevice[name] !== 'undefined') {
                var v = publicDevice[name];
                if(typeof v === 'function') {
                    return cache[name] || (cache[name] = function() {
                        return publicDevice[name].apply(publicDevice, arguments);
                    });
                }
                return v;
            }

            if(typeof name === 'symbol') return null;

            return cache[name] || (cache[name] = function() {
                return publicDevice.call(name, Array.prototype.slice.call(arguments));
            });
        }
    });
};
