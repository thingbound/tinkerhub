var EventEmitter = require('../events').EventEmitter;
var debug = require('debug')('th.devices');

var definition = require('../utils/definition.js');

var RemoteDevice = require('./remote');
var LocalDevice = require('./local');
var publicDevice = require('./public');

var collection = require('./collection');
var WeakRefMap = require('./weakrefmap');

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
                this._registerDevice(event.payload);
                break;
            case 'device:unavailable':
                this._removeDevice(event.payload);
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

    /**
     * Register a device from the network.
     */
    _registerDevice(def) {
        // Skip registering if we have this device locally
        if(this._localDevices[def.id]) return;

        const registered = this._devices[def.id];
        if(registered) {
            // Check if we should update our previous registration
            var rd = registered.metadata.def;
            if(rd.owner === rd.peer && def.peer !== rd.peer)
            {
                // The device is reachable via its owner, don't update from this peer
                return;
            }
        }

        if(registered) {
            debug('Updated device ' + def.id + ' via peer ' + def.peer);
        } else {
            debug('Found device ' + def.id + ' via peer ' + def.peer);
        }

        let device = this._devices[def.id];
        if(device) {
            device.metadata.updateDef(def);
        } else {
            this._devices[def.id] = device = new RemoteDevice(this._net, def);
        }

        if(! registered) {
            const publicDevice = this._toPublicDevice(device);
            publicDevice._._device = device;
            this._publicDevices.increaseRef(def.id);

            this._collections.forEach(function(key, c) {
                c._addDevice(publicDevice);
            });

            this._events.emit('deviceAvailable', publicDevice);
        }
    }

    /**
     * Register a new local device with the given id.
     */
    register(id, instance) {
        const device = this._localDevices[id] = this._devices[id] = new LocalDevice(this, id, instance);

        device._remove = function() {
            delete this._localDevices[id];
            delete this._devices[id];

            this._net.broadcast('device:unavailable', device.metadata.def);

            var publicDevice = this._toPublicDevice(device);

            // Remove from collections
            this._collections.forEach((key, c) => c._removeDevice(publicDevice));

            // Emit an event that the device is no longer available
            this._events.emit('deviceUnavailable', publicDevice);

            // Device has been removed, so stop keeping a hard reference to it
            this._publicDevices.decreaseRef(id);

            publicDevice._._device = null;
        }.bind(this);

        debug('New local device ' + id);

        // Create or connect with the public API for this device
        const publicDevice = this._toPublicDevice(device);
        publicDevice._._device = device;

        // Local devices need to be hard referenced
        this._publicDevices.increaseRef(id);

        this._net.broadcast('device:available', device.metadata.def);

        this._collections.forEach(function(key, c) {
            c._addDevice(publicDevice);
        });

        this._events.emit('deviceAvailable', publicDevice);

        return device;
    }

    /**
     * Remove a device that is no longer available.
     */
    _removeDevice(device) {
        const registered = this._devices[device.id];
        if(! registered || registered.metadata.def.peer !== device.peer) return;

        debug('Device ' + device.id + ' is no longer available');

        delete this._devices[device.id];

        const publicDevice = this._toPublicDevice(device.id);

        this._collections.forEach((key, c) => c._removeDevice(publicDevice));

        // Device has been removed, so stop keeping a hard reference to it
        this._publicDevices.decreaseRef(device.id);

        this._events.emit('deviceUnavailable', publicDevice);

        registered._remove();

        publicDevice._._device = null;
    }

    /**
     * Send a device list to the given network peer.
     */
    _sendDeviceListTo(id) {
        debug('Telling peer ' + id + ' about our devices');

        Object.keys(this._localDevices).forEach(function(dId) {
            const device = this._devices[dId];

            const def = device.metadata.def;

            // Skip sending device if we think it comes from the peer
            if(def.peer === id || def.owner === id) return;

            this._net.send(id, 'device:available', def);
        }.bind(this));
    }

    /**
     * Remove any devices registered as being available from the given peer.
     */
    _removeDevicesForPeer(peer) {
        Object.keys(this._devices).forEach(function(id) {
            const device = this._devices[id];
            if(device.metadata.def.peer === peer) {
                this._removeDevice(device.metadata.def);
            }
        }.bind(this));
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
            this._net.send(peer, 'device:invoke-result', {
                id: message.id,
                seq: message.seq,
                error: 'Unknown Device'
            });
        } else {
            const def = device._actions[message.action];
            device.call(message.action, message.arguments)
                .then(value => {
                    this._net.send(peer, 'device:invoke-result', {
                        id: message.id,
                        seq: message.seq,
                        result: def ? def.resultToJSON(value) : value
                    });
                }, err => {
                    this._net.send(peer, 'device:invoke-result', {
                        id: message.id,
                        seq: message.seq,
                        error: String(err)
                    });
                }, progress => {
                    this._net.send(peer, 'device:invoke-progress', {
                        id: message.id,
                        seq: message.seq,
                        data: progress
                    });
                })
                .done();
        }
    }

    /**
     * Handle a progress notification from a remote action invocation.
     */
    _handleDeviceInvokeProgress(message) {
        const device = this._devices[message.id];
        if(! device) return;

        device.receiveProgress(message);
    }

    /**
     * Handle the result of a remote action invocation.
     */
    _handleDeviceInvokeResult(message) {
        const device = this._devices[message.id];
        if(! device) return;

        device.receiveReply(message);
    }

    /**
     * Fetch a device using its identifier.
     */
    get(id) {
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
        this._collections.put(c._metadata.id, c);

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
