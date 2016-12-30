'use strict';

const types = require('./types/registry');
const values = require('../values');

const metadata = require('./metadata');
const storage = require('../storage');
const Q = require('q');

/**
 * Local device API around the actual device as registered.
 */
class LocalDevice {
    constructor(parent, id, instance) {
        this._debug = require('debug')('th.device.' +  id);

        this._parent = parent;
        this.instance = instance;

        // Create the definition of this device
        let def = types.describeDevice(id, instance);
        def.instance = def.types.join(',');
        def.tags = storage.get('internal.device.' + id + '.tags') || [];
        def.peer = def.owner = parent._net.id;

        // Fetch the name if this device is marked as nameable
        if(def.capabilities.indexOf('nameable') >= 0) {
            const storedName = storage.get('internal.device.' + id + '.name');
            if(storedName) {
                def.name = storedName;
            }
        }

        this.metadata = metadata(this, def);

        // Create our type converters
        this._actions = {};
        Object.keys(def.actions).forEach(key => {
            const action = def.actions[key];
            const argumentConverter = values.createConversion(action.arguments);
            const returnType = values.createToJSON(action.returnType);

            this._actions[key] = {
                arguments: argumentConverter,
                resultToJSON: returnType
            };
        });
    }

    mergeWith() {

    }

    debug() {
        this._debug.apply(this, arguments);
    }

    emit(event, payload) {
        this._debug('Emitting event', event, 'with payload', payload);

        this._parent.emitEvent(this, event, payload);
    }

    canCall(action) {
        return !! this.instance[action] || action.indexOf('metadata:') === 0;
    }

    /**
     * Invoke a certain action on this device. This method will delegate to
     * the actual implementation.
     */
    call(action, args, opts) {
        if(action.indexOf('metadata:') === 0) {
            return this.callMetadata(action.substring(9), args, opts);
        }

        const instance = this.instance;
        const func = instance[action];
        if(! func) {
            const err = Q.defer();
            err.reject(new Error('No action named ' + action));
            return err.promise;
        }

        if(typeof func !== 'function') {
            return Q.when(func);
        }

        const def = this._actions[action];

        let promise;
        let fr;

        try {
            fr = func.apply(instance, def ? def.arguments(args) : args);
        } catch(ex) {
            if(ex instanceof Error) {
                fr = ex;
            } else {
                fr = new Error(ex);
            }
        }

        const converter = def && opts && opts.remote ? def.resultToJSON : v => v;

        if(fr && fr.then) {
            promise = fr
                .then(converter);
        } else {
            const result = Q.defer();
            promise = result.promise
                .then(converter);

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
        this._parent._net.broadcast('device:available', this.metadata.def);
    }

    /**
     * Invoke a metadata action on this device.
     */
    callMetadata(action, args) {
        let fr;
        try {
            switch(action) {
                case 'setName':
                    fr = this._setName(args[0]);
                    break;
                case 'addTags':
                    fr = this._addTags(args[0]);
                    break;
                case 'removeTags':
                    fr = this._removeTags(args[0]);
                    break;
                default:
                    fr = new Error('Unknown metadata function');
            }
        } catch(ex) {
            if(ex instanceof Error) {
                fr = ex;
            } else {
                fr = new Error(ex);
            }
        }

        const result = Q.defer();
        if(fr instanceof Error) {
            result.reject(fr);
        } else {
            result.resolve(fr);
        }
        return result.promise;
    }

    /**
     * Set the name of this device. This will broadcast the change.
     */
    _setName(name) {
        this.metadata.def.name = name;

        if(this.metadata.tags.indexOf('cap:nameable') >= 0) {
            storage.put('internal.device.' + this.metadata.id + '.name', name);
        }

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

    _remove() {
        // Local removal does nothing special
    }
}

module.exports = LocalDevice;
