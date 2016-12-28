'use strict';

const EventEmitter = require('../events').EventEmitter;
const values = require('../values');

const LocalDevice = require('./local');

const metadata = require('./metadata');
const Q = require('q');

/**
 * Device that merges actions from several registrations. This is used to
 * support extending the types, capabilities and actions of any device even
 * if it is not local to this instance.
 */
class MergedDevice {
    constructor(parent, id) {
        this._debug = require('debug')('th.device.' +  id);
        this._emitter = new EventEmitter(this);

        this._net = parent._net;
        const def = {
            id: id,
            tags: [],
            types: [],
            capabilities: [],
            actions: {}
        };
        this.metadata = metadata(this, def);

        this._actual = {};
    }

    receiveEvent(event, payload) {
        payload = values.fromJSON('mixed', payload);
        this._debug('Emitting event', event, 'with payload', payload);

        this._emitter.emit(event, payload);
    }

    /**
     * Listen for all events triggered on this device.
     */
    onAny(listener) {
        this._emitter.onAny(listener);
    }

    /**
     * Stop listening for events triggered on this device.
     */
    offAny(listener) {
        this._emitter.offAny(listener);
    }

    call(action, args, opts) {
        if(opts && opts.remote) {
            // Remote invocation, run on first local device we can find
            const keys = Object.keys(this._actual);
            for(let i=0; i<keys.length; i++) {
                const device = this._actual[keys[i]];
                if(device instanceof LocalDevice && device.canCall(action)) {
                    return device.call(action, args, opts);
                }
            }
        } else if(action.indexOf('metadata:') === 0) {
            // Metadata call, divert to all registered devices
            const keys = Object.keys(this._actual);
            const invoked = keys
                .map(key => this._actual[key].call(action, args, opts));
            return Q.allSettled(invoked)
                .then(results => {
                    // Map the results to something a bit nicer
                    const result = [];
                    for(let i=0; i<results.length; i++) {
                        let data = results[i];
                        if(data.state === 'fulfilled') {
                            result.push(data.value);
                        } else {
                            result.push(data.value);
                        }
                    }
                    return result;
                });
        } else {
            // Regular call
            const keys = Object.keys(this._actual);
            for(let i=0; i<keys.length; i++) {
                const device = this._actual[keys[i]];
                if(device.canCall(action)) {
                    return device.call(action, args, opts);
                }
            }
        }

        const err = Q.defer();
        err.reject(new Error('No action named ' + action));
        return err.promise;
    }

    _createDef() {
        const def = {
            id: this.metadata.id,
            tags: [],
            types: [],
            capabilities: [],
            actions: {},
            state: {},
            events: {}
        };

        function mergeArray(current, more) {
            more.forEach(item => {
                if(current.indexOf(item) < 0) {
                    current.push(item);
                }
            });
        }

        function mergeObject(current, more) {
            if(! more) return;

            Object.keys(more).forEach(key => {
                if(current[key]) return;

                current[key] = more[key];
            });
        }

        Object.keys(this._actual).forEach(id => {
            const device = this._actual[id];
            const deviceDef = device.metadata.def;
            def.name = def.name || deviceDef.name;
            def.peer = def.peer || deviceDef.peer;
            def.owner = def.owner || deviceDef.owner;
            mergeArray(def.tags, deviceDef.tags);
            mergeArray(def.types, deviceDef.types);
            mergeArray(def.capabilities, deviceDef.capabilities);

            mergeObject(def.actions, deviceDef.actions);
            mergeObject(def.state, deviceDef.state);
            mergeObject(def.events, deviceDef.events);
        });

        this.metadata.updateDef(def);
    }

    addDevice(device) {
        const instance = device.metadata.def.instance;
        const registered = this._actual[instance];
        if(registered) {
            // This device is already present
            device.mergeWith(registered);
        }

        this._actual[instance] = device;

        this._createDef();
    }

    removeDevice(instance) {
        const registered = this._actual[instance];

        if(! registered) return;

        delete this._actual[instance];

        registered._remove();

        this._createDef();
    }

    get hasDevices() {
        return Object.keys(this._actual).length > 0;
    }

    get devices() {
        let result = [];
        const keys = Object.keys(this._actual);
        for(let i=0; i<keys.length; i++) {
            const device = this._actual[keys[i]];
            result.push(device);
        }
        return result;
    }

    hasPeer(peer) {
        const keys = Object.keys(this._actual);
        for(let i=0; i<keys.length; i++) {
            const device = this._actual[keys[i]];
            if(device.metadata.def.peer == peer) {
                return true;
            }
        }
        return false;
    }

    receiveReply(message) {
        const keys = Object.keys(this._actual);
        for(let i=0; i<keys.length; i++) {
            const device = this._actual[keys[i]];
            if(device.receiveReply) {
                device.receiveReply(message);
            }
        }
    }

    receiveProgress(message) {
        const keys = Object.keys(this._actual);
        for(let i=0; i<keys.length; i++) {
            const device = this._actual[keys[i]];
            if(device.receiveProgress) {
                device.receiveProgress(message);
            }
        }
    }
}

module.exports = MergedDevice;
