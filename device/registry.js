var EventEmitter = require('../events').EventEmitter;
var util = require('util');
var debug = require('debug')('th.devices');

var RemoteDevice = require('./remote');
var LocalDevice = require('./local');
var publicDevice = require('./public');

var collection = require('./collection');
var weak = require('weak');

function Registry(net) {
    EventEmitter.call(this);

    this._net = net;

    this._localDevices = {};
    this._devices = {};
    this._collections = [];

    net.on('message', this._onmessage.bind(this));
    net.on('peerConnected', this._sendDeviceListTo.bind(this));
    net.on('peerDisconnected', this._removeDevicesForPeer.bind(this));
}

util.inherits(Registry, EventEmitter);

Registry.prototype._toPublicDevice = function(device) {
    if(device._public) {
        return device._public;
    }

    device._public = publicDevice(device);
    return device._public;
};

Registry.prototype._onmessage = function(event) {
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
};

Registry.prototype._registerDevice = function(def) {
    // Skip registering if we have this device locally
    if(this._localDevices[def.id]) return;

    var registered = this._devices[def.id];
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

    var device = this._devices[def.id];
    if(device) {
        device.metadata.updateDef(def);
    } else {
        this._devices[def.id] = device = new RemoteDevice(this._net, def);
    }

    if(! registered) {
        var publicDevice = this._toPublicDevice(device);
        this._collections.forEach(function(c) {
            c._addDevice(publicDevice);
        });

        this.emit('deviceAvailable', publicDevice);
    }
};

Registry.prototype.register = function(id, instance) {
    var device = this._localDevices[id] = this._devices[id] = new LocalDevice(this, id, instance);

    device._remove = function() {
        delete this._localDevices[id];

        var publicDevice = this._toPublicDevice(device);
        this.emit('deviceUnavailable', publicDevice);

        this._collections.forEach(function(c) {
            c._removeDevice(publicDevice);
        });
    }.bind(this);

    debug('New local device ' + id);

    this._net.broadcast('device:available', device.metadata.def);

    var publicDevice = this._toPublicDevice(device);
    this._collections.forEach(function(c) {
        c._addDevice(publicDevice);
    });

    this.emit('deviceAvailable', publicDevice);

    return device;
};

Registry.prototype._removeDevice = function(device) {
    var registered = this._devices[id];
    if(! registered || registered.metadata.def.peer != device.peer) return;

    debug('Device ' + device.id + ' is no longer available');

    delete this._devices[device.id];

    var publicDevice = this._toPublicDevice(device);
    this.emit('deviceUnavailable', publicDevice);

    this._collections.forEach(function(c) {
        c._removeDevice(publicDevice);
    });
};

Registry.prototype._sendDeviceListTo = function(id) {
    debug('Telling peer ' + id + ' about our devices');

    Object.keys(this._localDevices).forEach(function(dId) {
        var device = this._devices[dId];

        var def = device.metadata.def;

        // Skip sending device if we think it comes from the peer
        if(def.peer === id || def.owner === id) return;

        this._net.send(id, 'device:available', def);
    }.bind(this));
};

Registry.prototype._removeDevicesForPeer = function(peer) {
    Object.keys(this._devices).forEach(function(id) {
        var device = this._devices[id];
        if(device.metadata.def.peer == peer) {
            debug('Device ' + id + ' is no longer available');

            delete this._devices[id];
            var publicDevice = this._toPublicDevice(device);
            this.emit('deviceUnavailable', publicDevice);

            this._collections.forEach(function(c) {
                c._removeDevice(publicDevice);
            });
        }
    }.bind(this));
};

Registry.prototype._handleDeviceEvent = function(message) {
    var device = this._devices[message.id];
    if(! device) return;

    device.receiveEvent(message.event, message.payload);
};

Registry.prototype._handleDeviceInvoke = function(peer, message) {
    var device = this._devices[message.id];
    if(! device) {
        this._net.send(peer, 'device:invoke-result', {
            id: message.id,
            seq: message.seq,
            error: 'Unknown Device'
        });
    } else {
        var self = this;
        device.call(message.action, message.arguments)
            .then(function(value) {
                self._net.send(peer, 'device:invoke-result', {
                    id: message.id,
                    seq: message.seq,
                    result: value
                });
            }, function(err) {
                self._net.send(peer, 'device:invoke-result', {
                    id: message.id,
                    seq: message.seq,
                    error: String(err)
                });
            }, function(progress) {
                self._net.send(peer, 'device:invoke-progress', {
                    id: message.id,
                    seq: message.seq,
                    data: progress
                });
            })
            .done();
    }
};

Registry.prototype._handleDeviceInvokeProgress = function(message) {
    var device = this._devices[message.id];
    if(! device) return;

    device.receiveProgress(message);
};

Registry.prototype._handleDeviceInvokeResult = function(message) {
    var device = this._devices[message.id];
    if(! device) return;

    device.receiveReply(message);
};

Registry.prototype.get = function(id) {
    var device = this._devices[id];
    if(! device) return null;

    return this._toPublicDevice(device);
};

function makeCollectionRemover(registry, c) {
    return function() {
        var idx = registry._collections.indexOf(c);
        if(idx >= 0) {
            debug('Removing unused collection c' + c.metadata.id);
            registry._collections.splice(idx, 1);
        }
    };
}

/**
 * Get a dynamic collection for any devices that match the given filter
 * function.
 */
Registry.prototype.collection = function(filter) {
    var publicCollection = collection(filter);
    var c = publicCollection._;
    this._collections.push(c);

    var self = this;
    Object.keys(this._devices).forEach(function(key) {
        c._addDevice(self._toPublicDevice(self._devices[key]));
    });

    weak(publicCollection, makeCollectionRemover(this, c));

    return publicCollection;
};

/**
 * Get a collection for all devices available.
 */
Registry.prototype.all = function() {
    return this.collection(function() { return true; });
};

/**
 * Get a dynamic collection that contains devices which have all of the given
 * tags.
 *
 * Types can be searched for by using the prefix `type:` and capabiltiies by
 * using the prefix `cap:`.
 */
Registry.prototype.tagged = function() {
    var tags = {};
    var total = 0;
    Array.prototype.forEach.call(arguments, function(tag) {
        tags[tag] = true;
        total++;
    });

    return this.collection(function(device) {
        var hits = 0;
        device.metadata.tags.forEach(function(tag) {
            if(tags[tag]) hits++;
        });

        return hits == total;
    });
};

module.exports = function(net) {
    return new Registry(net);
};
