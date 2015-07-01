/**
 * Dynamic collection of devices.
 */
var Proxy = require('node-proxy');
var EventEmitter = require('../events').EventEmitter;
var Q = require('q');

function Collection(id, selector) {
    this._debug = require('debug')('th.collection.c' + id);
    this._selector = selector;
    this._events = new EventEmitter(this);
    this._devices = [];
    this.metadata = {
        id: id
    };
}

Collection.prototype.forEach = function(func) {
    this._devices.forEach(func);
};

Collection.prototype.listDevices = function(func) {
    return this._devices;
};

Collection.prototype.on = function(event, listener) {
    this._events.on(event, listener);

    var self = this;
    return {
        stop: function() {
            self._events.removeEventListener(event, listener);
        }
    };
};

Collection.prototype._addDevice = function(device) {
    if(this._selector(device)) {
        this._debug('Adding device ' + device.metadata.id + ' to collection');

        var idx = this._devices.indexOf(device);
        if(idx >= 0) return;

        this._devices.push(device);
        device.onAll(function(event, payload) {
            this._events.emitWithContext(device, event, payload);
        }.bind(this));

        this._events.emit('deviceAvailable', device);
    }
};

Collection.prototype._removeDevice = function(device) {
    var idx = this._devices.indexOf(device);
    if(idx >= 0) {
        this._debug('Removing device ' + device.metadata.id + ' from collection');

        this._devices.splice(idx, 1);

        // TODO: Remove event listener?

        this._events.emit('deviceUnavailable', device);
    }
};

var collectionId = 0;
module.exports = function(selector) {
    var collection = new Collection(collectionId++, selector);

    return Proxy.create({
        get: function(proxy, name) {
            if(name === '_') {
                return collection;
            } else if(name[0] === '_') {
                return undefined;
            } else if(name === 'inspect') {
                return this._devices.map(function(device) {
                    return device.metadata.id;
                });
            } else if(typeof collection[name] !== 'undefined') {
                var v = collection[name];
                if(typeof v === 'function') {
                    return v.bind(collection);
                }
                return v;
            }

            return function() {
                var deviceCopy = collection._devices.slice();
                var args = Array.prototype.slice.call(arguments);
                return Q.all(collection._devices.map(function(device) {
                    return device.call(name, args);
                })).then(function(results) {
                    var result = {};
                    for(var i=0; i<results.length; i++) {
                        result[deviceCopy[i].metadata.id] = results[i];
                    }
                });
            };
        }
    });
};
