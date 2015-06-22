/**
 * Dynamic collection of devices.
 */
var Proxy = require('node-proxy');
var EventEmitter = require('events').EventEmitter;

function Collection(id, selector) {
    this._debug = require('debug')('th.collection.c' + id);
    this._selector = selector;
    this._events = new EventEmitter();
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

        this._devices.push(device);
        device.onAll(function(event, payload) {
            this._events.emit(event, payload);
        }.bind(this));
    }
};

Collection.prototype._removeDevice = function(device) {
    var idx = this._devices.indexOf(device);
    if(idx >= 0) {
        this._debug('Removing device ' + device.metadata.id + ' from collection');

        this._devices.splice(idx, 1);

        // TODO: Remove event listener?
    }
};

var collectionId = 0;
module.exports = function(selector) {
    var collection = new Collection(collectionId++, selector);

    return Proxy.create({
        get: function(proxy, name) {
            if(name === '_') {
                return collection;
            } else if(name[0] === '_' || name === 'inspect') {
                return undefined;
            } else if(typeof collection[name] !== 'undefined') {
                var v = collection[name];
                if(typeof v === 'function') {
                    return v.bind(collection);
                }
                return v;
            }

            return function() {
                var args = Array.prototype.slice.call(arguments);
                return collection._devices.forEach(function(device) {
                    device.call(name, args);
                });
            };
        }
    });
};
