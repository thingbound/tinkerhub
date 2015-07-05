var EventEmitter = require('../events').EventEmitter;

var metadata = require('./metadata');
var storage = require('../storage');
var Q = require('q');

/**
 * Local device API around the actual device as registered.
 */
class LocalDevice {
    constructor(parent, id, instance) {
        this._debug = require('debug')('th.device.' +  id);
        this._emitter = new EventEmitter(this);

        this._net = parent._net;
        this._listeners = [];
        this.instance = instance;

        // Create the definition of this device
        let def = {};
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
        Object.keys(instance).forEach(funcName => {
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

    emit(event, payload) {
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
    }

    /**
     * Listen for a specific event on this device.
     *
     * @param event The event to listen for
     * @param listener The listener that will be invoked
     */
    on(event, listener) {
        this._emitter.on(event, listener);
    }

    /**
     * Listen for all events triggered on this device.
     */
    onAll(listener) {
        this._emitter.onAny(listener);
    }

    /**
     * Invoke a certain action on this device. This method will delegate to
     * the actual implementation.
     */
    call(action, args) {
        const instance = action[0] === '_' ? this : this.instance;
        const func = instance[action];
        if(! func) {
            const err = Q.defer();
            err.reject(new Error('No action named ' + action));
            return err.promise;
        }

        if(typeof func !== 'function') {
            return Q.when(func);
        }

        let promise;
        const fr = func.apply(instance, args);
        if(fr && fr.then) {
            promise = fr;
        } else {
            const result = Q.defer();
            promise = result.promise;

            if(fr instanceof Error) {
                result.reject(fr);
            } else {
                result.resolve(fr);
            }
        }

        return promise;
    }

    /**
     * Send a change in the metadata for this device to everyone in the
     * network.
     */
    _broadcastMetadataChange() {
        this.metadata.updateDef(this.metadata.def);
        this._net.broadcast('device:available', this.metadata.def);
    }

    /**
     * Set the name of this device. This will broadcast the change.
     */
    _setName(name) {
        this.metadata.def.name = name;
        this._broadcastMetadataChange();
    }

    /**
     * Add some tags to the device. This will store the new tags and broadcast
     * the change.
     *
     * @param tags Array with the tags to add
     */
    _addTags(tags) {
        var current = this.metadata.def.tags;
        Array.prototype.forEach.call(tags, function(tag) {
            if(current.indexOf(tag) < 0) {
                current.push(tag);
            }
        }.bind(this));

        storage.put('internal.device.' + this.metadata.id + '.tags', current);
        this._broadcastMetadataChange();
    }

    /**
     * Remove some tags from the device. This will store the new tags and
     * broadcast the change.
     *
     * @param tags Array with the tags to add
     */
    _removeTags(tags) {
        var current = this.metadata.def.tags;
        Array.prototype.forEach.call(tags, function(tag) {
            var idx = current.indexOf(tag);
            if(idx >= 0) {
                current.splice(idx, 1);
            }
        }.bind(this));

        storage.put('internal.device.' + this.metadata.id + '.tags', current);
        this._broadcastMetadataChange();
    }
}

module.exports = LocalDevice;
