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
        let promise;
        if(this._device) {
            promise = this._device.call(action.toString(), args);
        } else {
            promise = Q.reject('Device is not available');
        }

        return new CallResolver(promise);
    }
}

/**
 * Enhancement to call, allows for setting a timeout.
 */
class CallResolver {
    constructor(promise) {
        this._promise = promise;
    }

    timeout(maxTime) {
        maxTime = values.duration(maxTime);

        if(maxTime.ms <= 0) {
            throw new Error('Timeout must be positive');
        }

        this._timeout = maxTime.ms;
        return this;
    }

    _resolvePromise() {
        let promise = this._promise;

        if(this._timeout) {
            promise = Q.timeout(promise, this._timeout);
        }

        return promise;
    }

    then(handler, errorHandler) {
        return this._resolvePromise()
            .then(handler, errorHandler);
    }

    catch(handler) {
        return this._resolvePromise()
            .catch(handler);
    }

    done() {
        return this._resolvePromise()
            .done();
    }

    progress(handler) {
        return this._resolvePromise()
            .progress(handler);
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
