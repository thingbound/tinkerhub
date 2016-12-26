'use strict';

const events = require('../events');
const EventEmitter = events.EventEmitter;
const debug = require('debug')('th.devices');

const definition = require('../utils/definition.js');

const MergedDevice = require('./merged');
const RemoteDevice = require('./remote');
const LocalDevice = require('./local');
const publicDevice = require('./public');

const collection = require('./collection');
const WeakRefMap = require('./weakrefmap');

/**
 * The internal registry of devices.
 */
class InternalRegistry {
    constructor(net) {
        this._events = new EventEmitter(this);

        this._net = net;

        this._localDevices = {};
        this._devices = {};
        this._collections = new WeakRefMap();
        this._publicDevices = new WeakRefMap();

        net.on('message', this._onmessage.bind(this));
        net.on('peerConnected', this._sendDeviceListTo.bind(this));
        net.on('peerDisconnected', this._removeDevicesForPeer.bind(this));

        this.on = this._events.on.bind(this._events);
        this.off = this._events.off.bind(this._events);

        this._timer = setTimeout(this._broadcastDevices.bind(this), 300000);
    }

    /**
     * Private: Get the public API for the given device.
     */
    _toPublicDevice(device) {
        const id = typeof device === 'string' ? device : device.metadata.id;
        let pd = this._publicDevices.get(id);
        if(pd) return pd;

        pd = publicDevice(id);
        this._publicDevices.put(id, pd);
        debug('New public device ' + id);

        return pd;
    }

    /**
     * Private: Handle any incoming messages from the network.
     */
    _onmessage(event) {
        debug('Received message', event);
        switch(event.type) {
            case 'device:available':
                this._addRemoteDevice(event.payload);
                break;
            case 'device:unavailable':
                this._removeRemoteDevice(event.payload);
                break;
            case 'device:event':
                this._handleDeviceEvent(event.payload);
                break;
            case 'device:invoke':
                this._handleDeviceInvoke(event.peer, event.payload);
                break;
            case 'device:invoke-progress':
                this._handleDeviceInvokeProgress(event.payload);
                break;
            case 'device:invoke-result':
                this._handleDeviceInvokeResult(event.payload);
                break;
        }
    }

    _addDevice(id, device) {
        let merged = this._devices[id];
        const isNew = ! merged;
        if(isNew) {
            merged = new MergedDevice(this, id);
            this._devices[id] = merged;
        }

        // Add the actual device
        merged.addDevice(device);

        const publicDevice = this._toPublicDevice(merged);
        if(isNew) {
            debug('Device ' + id + ' is now available');

            publicDevice._._device = merged;
            this._publicDevices.increaseRef(id);

            this._collections.forEach(function(key, c) {
                c._addDevice(publicDevice);
            });

            this._events.emit('device:available', publicDevice);
        } else {
            this._collections.forEach(function(key, c) {
                c._updateDevice(publicDevice);
            });
        }
    }

    _removeDevice(id, instanceId) {
        const registered = this._devices[id];
        if(! registered) return;

        debug('Removing ' + instanceId + ' for ' + id);
        registered.removeDevice(instanceId);
        if(! registered.hasDevices) {
            debug('Device ' + id + ' is no longer available');

            delete this._devices[id];

            var publicDevice = this._toPublicDevice(registered);

            // Remove from collections
            this._collections.forEach((key, c) => c._removeDevice(publicDevice));

            // Emit an event that the device is no longer available
            this._events.emit('device:unavailable', publicDevice);

            // Device has been removed, so stop keeping a hard reference to it
            this._publicDevices.decreaseRef(id);

            publicDevice._._device = null;
        }
    }

    /**
     * Register a device from the network.
     */
    _addRemoteDevice(def) {
        this._addDevice(def.id, new RemoteDevice(this._net, def));
    }

    _removeRemoteDevice(def) {
        this._removeDevice(def.id, def.instance);
    }

    /**
     * Register a new local device with the given id.
     */
    register(id, instance) {
        if(id.indexOf(':') <= 0) {
            throw new Error('Identifiers of devices must contain a namespace separated with a colon');
        }

        const device = new LocalDevice(this, id, instance);

        device.remove = function() {
            this._removeDevice(id, device.metadata.def.instance);

            // Tell peers that our instance is no longer available
            this._net.broadcast('device:unavailable', device.metadata.def);
        }.bind(this);

        debug('New local device ' + id);

        this._addDevice(id, device);

        // Tell peers that our device is available
        this._net.broadcast('device:available', device.metadata.def);

        return device;
    }

    /**
     * Register automatic extending of all devices matching the given tags
     * or callback.
     */
    extend(args, callback) {
        const devices = this.get.apply(this, args);
        const self = this;
        const registered = [];

        function handleDevice(device) {
            callback({
                device: device,

                enhance: function(obj) {
                    const localDevice = self.register(device.metadata.id, obj);
                    registered.push(localDevice);
                    return localDevice;
                }
            });
        }

        devices.forEach(handleDevice);
        devices.on('deviceAvailable', handleDevice);

        return {
            stop: function() {
                devices.off('device:available', handleDevice);
                registered.forEach(device => device.remove());
            }
        };
    }

    /**
     * Send a device list to the given network peer.
     */
    _sendDeviceListTo(id) {
        debug('Telling peer ' + id + ' about our devices');

        const peer = this._net.id;
        Object.keys(this._devices).forEach(function(dId) {
            const device = this._devices[dId];

            device.devices.forEach(d => {
                const def = d.metadata.def;
                // Skip sending if this is not a local device
                if(def.peer !== peer) return;

                this._net.send(id, 'device:available', def);
            });
        }.bind(this));
    }

    _broadcastDevices() {
        debug('Broadcasting all of our devices');

        const peer = this._net.id;
        Object.keys(this._devices).forEach(function(dId) {
            const device = this._devices[dId];

            device.devices.forEach(d => {
                const def = d.metadata.def;
                // Skip sending if this is not a local device
                if(def.peer !== peer) return;

                this._net.broadcast('device:available', def);
            });
        }.bind(this));
    }

    /**
     * Remove any devices registered as being available from the given peer.
     */
    _removeDevicesForPeer(peer) {
        let count = 0;
        Object.keys(this._devices).forEach(function(id) {
            const device = this._devices[id];
            device.devices.forEach(d => {
                if(d.metadata.def.peer === peer) {
                    this._removeDevice(d.metadata.id, d.metadata.def.instance);
                    count++;
                }
            })
        }.bind(this));

        debug('Removed ' + count + ' devices for ' + peer);
    }

    /**
     * Handle an event as broadcasted from a remote device.
     */
    _handleDeviceEvent(message) {
        const device = this._devices[message.id];
        if(! device) return;

        device.receiveEvent(message.event, message.payload);
    }

    /**
     * Handle a request for an action invocation on a local device.
     */
    _handleDeviceInvoke(peer, message) {
        const device = this._devices[message.id];
        if(! device) {
            debug('Unknown device, sending back failure');
            this._net.send(peer, 'device:invoke-result', {
                id: message.id,
                seq: message.seq,
                error: 'Unknown Device'
            });
        } else {
            debug('Invoking ' + message.action + ' on ' + device.metadata.id);
            device.call(message.action, message.arguments, {
                remote: true
            })
                .then(value => {
                    const msg = {
                        id: message.id,
                        seq: message.seq,
                        result: value
                    };
                    debug('Sending back', msg);
                    this._net.send(peer, 'device:invoke-result', msg);
                }, err => {
                    const msg = {
                        id: message.id,
                        seq: message.seq,
                        error: String(err)
                    }
                    debug('Sending back', msg);
                    this._net.send(peer, 'device:invoke-result', msg);
                }, progress => {
                    const msg = {
                        id: message.id,
                        seq: message.seq,
                        data: progress
                    };
                    debug('Sending back', msg);
                    this._net.send(peer, 'device:invoke-progress', msg);
                });
        }
    }

    /**
     * Handle a progress notification from a remote action invocation.
     */
    _handleDeviceInvokeProgress(message) {
        const device = this._devices[message.id];
        debug('Invocation progress for ' + message.id, message);
        if(! device) return;

        device.receiveProgress(message);
    }

    /**
     * Handle the result of a remote action invocation.
     */
    _handleDeviceInvokeResult(message) {
        debug('Invocation result for ' + message.id, message);
        const device = this._devices[message.id];
        if(! device) return;

        device.receiveReply(message);
    }

    /**
     * Fetch devices matching the given tags or the given filter.
     */
    get() {
        if(arguments.length == 1 && typeof arguments[0] === 'function') {
            return this.collection(arguments[0]);
        } else {
            return this.tagged.apply(this, arguments);
        }
    }

    getSpecific(id) {
        return this._toPublicDevice(id);
    }

    isAvailable(id) {
        return !!this._devices[id];
    }

    /**
     * Get a dynamic collection for any devices that match the given filter
     * function.
     */
    collection(filter) {
        const publicCollection = collection(filter);
        const c = publicCollection._;
        this._collections.put(c.metadata.id, c);

        const self = this;
        Object.keys(this._devices).forEach(key =>
            c._addDevice(self._toPublicDevice(self._devices[key]))
        );

        return publicCollection;
    }

    /**
     * Get a collection for all devices available.
     */
    all() {
        return this.collection(() => true);
    }

    /**
     * Get a dynamic collection that contains devices which have all of the given
     * tags.
     *
     * Types can be searched for by using the prefix `type:` and capabiltiies by
     * using the prefix `cap:`.
     */
    tagged() {
        let tags = {};
        let total = 0;
        Array.prototype.forEach.call(arguments, tag => {
            tags[tag] = true;
            total++;
        });

        return this.collection(device => {
            let hits = 0;
            device.metadata.tags.forEach(tag => {
                if(tags[tag]) hits++;
            });

            return hits === total;
        });
    }
}

/**
 * Registry that only contains the public API from the internal registry.
 */
class Registry {
    constructor(internal) {
        definition(internal).forEach(key => {
            if(key[0] === '_') return;

            const value = internal[key];
            if(typeof value === 'function') {
                this[key] = value.bind(internal);
            } else {
                Object.defineProperty(this, key, {
                    get() {
                        return internal[key];
                    }
                });
            }
        });
    }
}

module.exports = function(net) {
    const internal = new InternalRegistry(net);
    return new Registry(internal);
};
