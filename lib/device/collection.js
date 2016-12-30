'use strict';

const eventsMixin = require('../events').mixin;
const EventEmitter = require('../events').EventEmitter;
const metadata = require('./metadata');

const Q = require('q');

const values = require('../values');
const MultiResult = require('./multiresult');

/**
 * Dynamic collection of devices. This is the internal API that is later
 * proxied to make the public API a bit nicer.
 */
class Collection {
    constructor(id, selector) {
        this._debug = require('debug')('th.collection.c' + id);
        this._selector = selector;
        this._events = new EventEmitter(this);
        this._devices = [];
        this._deviceIds = {};
        this.metadata = metadata(this, {
            id: 'collection:' + id,
            tags: [ 'type:collection' ]
        });

        eventsMixin(this);
    }

    get length() {
        return this._devices.length;
    }

    /**
     * Run the given function on every device we know about.
     */
    forEach(func) {
        this._devices.forEach(func);
        return this;
    }

    /**
     * Get a list of all the devices in this collection. Will return a non-live
     * copy of the device list.
     */
    listDevices() {
        return this._devices.slice();
    }

    /**
     * Private: Add a new device to this collection.
     */
    _addDevice(device) {
        if(! this._selector(device)) return;

        const idx = this._devices.indexOf(device);
        if(idx >= 0) return;

        this._debug('Adding device ' + device.metadata.id + ' to collection');

        this._devices.push(device);
        this._deviceIds[device.metadata.id] = true;

        this._events.emit('device:available', device);
    }

    /**
     * Private: Remove a device from this collection.
     */
    _removeDevice(device) {
        const idx = this._devices.indexOf(device);
        if(idx < 0) return;

        this._debug('Removing device ' + device.metadata.id + ' from collection');

        this._devices.splice(idx, 1);

        delete this._deviceIds[device.metadata.id];

        this._events.emit('device:unavailable', device);
    }

    _updateDevice(device) {
        const hasDevice = this._deviceIds[device.metadata.id];
        if(this._selector(device)) {
            if(! hasDevice) {
                this._addDevice(device);
            }
        } else {
            if(hasDevice) {
                this._removeDevice(device);
            }
        }
    }

    _receiveEvent(device, event, payload) {
        if(! this._deviceIds[device.metadata.id]) return;

        this._debug('Emitting event ' + event + ' for ' + device.metadata.id);
        this._events.emitWithContext(device, event, payload)
    }

    /**
     * Private: Create a function that will invoke an action on all of the
     * devices in this collection.
     */
    _action(name) {
        return function() {
            return this.call(name, Array.prototype.slice.call(arguments));
        }.bind(this);
    }

    /**
     * Call a specific action for all of the devices.
     */
    call(action, args) {
        // Create copies of the current device list and the arguments
        const deviceCopy = this._devices.slice();

        // Invoke the method on all of the devices and get their promises
        const invoked = deviceCopy.map(device => device.call(action, args));

        // Return a resolver
        return new CallResolver(deviceCopy, invoked);
    }
}

/**
 * Enhancement to call, allows for setting timeouts and generally tweaking
 * things.
 */
class CallResolver {
    constructor(devices, promises) {
        this._devices = devices;
        this._promises = promises;
    }

    timeout(maxTime) {
        maxTime = values.duration(maxTime);

        if(maxTime.ms <= 0) {
            throw new Error('Timeout must be positive');
        }

        this._timeout = maxTime.ms;
        return this;
    }

    any() {
        this._any = true;
        return this;
    }

    firstValue() {
        this._picker = function(results) {
            return results.firstValue();
        };
        return this;
    }

    highest() {
        this._picker = function(results) {
            return results.highest();
        };
        return this;
    }

    lowest() {
        this._picker = function(results) {
            return results.lowest();
        };
        return this;
    }

    distinct() {
        this._picker = function(results) {
            return results.highest();
        };
        return this;
    }

    mostlyTrue() {
        this._picker = function(results) {
            return results.mostlyTrue();
        };
        return this;
    }

    mostlyFalse() {
        this._picker = function(results) {
            return results.mostlyFalse();
        };
        return this;
    }

    _resolvePromise() {
        let promises = this._promises;

        if(this._timeout) {
            promises = promises.map(p => Q.timeout(p, this._timeout));
        }

        if(this._any) {
            return Q.any(promises);
        } else {
            return Q.allSettled(promises)
                .then(results => {
                    // Map the results to something a bit nicer
                    const result = new MultiResult();
                    for(let i=0; i<results.length; i++) {
                        let data = results[i];
                        if(data.state === 'fulfilled') {
                            result.addValue(this._devices[i], data.value);
                        } else {
                            result.addError(this._devices[i], data.reason);
                        }
                    }

                    if(this._picker) {
                        return this._picker(result);
                    } else {
                        return result;
                    }
                })
                .progress(data => {
                    // Emit some progress data bound to the device id
                    return {
                        device: this._devices[data.index].metadata.id,
                        progress: data.value
                    };
                });
        }
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

let collectionId = 0;

/**
 * Create a new public collection using the given selector function.
 *
 * @param selector Function to use for determining if a device should be in
 *  this collection.
 */
module.exports = function(selector) {
    const collection = new Collection(collectionId++, selector);

    return new Proxy(collection, {
        get: function(proxy, name) {
            if(name === '_') {
                return collection;
            } else if(name[0] === '_') {
                return undefined;
            } else if(name === 'inspect') {
                return collection._devices.map(device => device.metadata.id);
            } else if(typeof collection[name] !== 'undefined') {
                const v = collection[name];
                if(typeof v === 'function') {
                    return v.bind(collection);
                }
                return v;
            }

            if(typeof name === 'symbol') return null;

            // Get the action for this name
            return collection._action(name);
        }
    });
};
