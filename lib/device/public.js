'use strict';

const EventEmitter = require('../events').EventEmitter;
const NProxy = require('node-proxy');
const Q = require('q');

const unavailableMetadata = {
    available: false
};

class PublicDevice {
    constructor() {
        this._events = new EventEmitter(this);
        this._listener = (event, payload) => this._events.emit(event, payload);
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

    on(event, listener) {
        this._events.on(event, listener);
    }

    off(event, listener) {
        this._events.off(event, listener);
    }

    onAny(listener) {
        this._events.onAny(listener);
    }

    offAny(listener) {
        this._events.offAny(listener);
    }

    call(action, args) {
        if(this._device) {
            return this._device.call(action, args);
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

    return NProxy.create({
        get: function(proxy, name) {
            if(name === '_') {
                return publicDevice;
            } else if(name[0] === '_') {
                return undefined;
            } else if(name === 'inspect') {
                return 'Device[' + id + ']';
            } else if(typeof publicDevice[name] !== 'undefined') {
                var v = publicDevice[name];
                if(typeof v === 'function') {
                    return cache[name] || (cache[name] = function() {
                        return publicDevice[name].apply(publicDevice, arguments);
                    });
                }
                return v;
            }

            return cache[name] || (cache[name] = function() {
                return publicDevice.call(name, Array.prototype.slice.call(arguments));
            });
        }
    });
};