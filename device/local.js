var EventEmitter = require('events').EventEmitter;

var metadata = require('./metadata');
var storage = require('../storage');
var Q = require('q');

function LocalDevice(parent, id, instance) {
    this._debug = require('debug')('th.device.' +  id);
    this._emitter = new EventEmitter();

    this._net = parent._net;
    this._listeners = [];
    this.instance = instance;

    // Create the definition of this device
    var def = {};
    def.id = id;
    def.peer = def.owner = this._net.id;

    if(instance.metadata) {
        if(instance.metadata.type) {
            if(Array.isArray(instance.metadata.type)) {
                def.types = instance.metadata.type;
            } else {
                def.types = [ String(instance.metadata.type) ];
            }
        } else {
            def.types = [];
        }

        if(instance.metadata.capabilities) {
            if(Array.isArray(instance.metadata.capabilities)) {
                def.capabilities = instance.metadata.capabilities;
            } else {
                def.capabilities = [ String(instance.metadata.capabilities) ];
            }
        } else {
            def.capabilities = [];
        }

        def.name = instance.metadata.name;
    }

    def.tags = storage.get('internal.device.' + id + '.tags') || [];

    def.actions = {};
    Object.keys(instance).forEach(function(funcName) {
        var func = instance[funcName];
        if(typeof func !== 'function') return;

        def.actions[funcName] = {
            argumentCount: func.length,
            argumentTypes: func.__th_types || [],
            returnType: func.__th_return
        };
    });

    this.metadata = metadata(this, def);
}

LocalDevice.prototype.emit = function(event, payload) {
    this._debug('Emitting event', event, 'with payload', payload);

    this._net.broadcast('device:event', {
        id: this.metadata.def.id,
        event: event,
        payload: payload
    });

    this._emitter.emit(event, payload);
    this._listeners.forEach(function(listener) {
        listener(event, payload);
    });
};

LocalDevice.prototype.on = function(event, listener) {
    this._emitter.on(event, listener);
};

LocalDevice.prototype.onAll = function(listener) {
    this._listeners.push(listener);
};

LocalDevice.prototype.call = function(action, args) {
    var instance = action[0] === '_' ? this : this.instance;
    var func = instance[action];
    if(! func) {
        var err = Q.defer();
        err.reject(new Error('No action named ' + action));
        return err.promise;
    }

    var promise;
    var fr = func.apply(instance, args);
    if(fr && fr.then) {
        promise = fr;
    } else {
        var result = Q.defer();
        promise = result.promise;

        if(fr instanceof Error) {
            result.reject(fr);
        } else {
            result.resolve(fr);
        }
    }

    return promise;
};

LocalDevice.prototype._broadcastMetadataChange = function() {
    this.metadata.updateDef(this.metadata.def);
    this._net.broadcast('device:available', this.metadata.def);
};

LocalDevice.prototype._setName = function(name) {
    this.metadata.def.name = name;
    this._broadcastMetadataChange();
};

LocalDevice.prototype._addTags = function(tags) {
    var current = this.metadata.def.tags;
    Array.prototype.forEach.call(tags, function(tag) {
        if(current.indexOf(tag) < 0) {
            current.push(tag);
        }
    }.bind(this));

    storage.put('internal.device.' + this.metadata.id + '.tags', current);
    this._broadcastMetadataChange();
};

LocalDevice.prototype._removeTags = function(tags) {
    var current = this.metadata.def.tags;
    Array.prototype.forEach.call(tags, function(tag) {
        var idx = current.indexOf(tag);
        if(idx >= 0) {
            current.splice(idx, 1);
        }
    }.bind(this));

    storage.put('internal.device.' + this.metadata.id + '.tags', current);
    this._broadcastMetadataChange();
};

module.exports = LocalDevice;
