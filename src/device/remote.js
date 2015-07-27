
var EventEmitter = require('../events').EventEmitter;
var types = require('./types/registry');

var metadata = require('./metadata');
var Q = require('q');
var seq = 0;

class RemoteDevice {
    constructor(net, def) {
        this._net = net;

        this._debug = require('debug')('th.device.' +  def.id);
        this._emitter = new EventEmitter(this);

        this._promises = {};

        this.metadata = metadata(this, def);

        // Create our type converters
        this._actions = {};
        Object.keys(def.actions).forEach(key => {
            const action = def.actions[key];
            const argumentConverter = types.createToJSON(action.arguments);
            const resultTypeConverter = types.createConversion(action.returnType);

            this._actions[key] = {
                arguments: argumentConverter,
                resultFromJSON: resultTypeConverter
            };
        });
    }

    receiveEvent(event, payload) {
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

    call(action, args) {
        const deferred = Q.defer();

        const id = seq++;
        if(seq > 10000) seq = 0;

        const def = this._actions[action];

        this._promises[id] = {
            action: def,
            deferred: deferred
        };

        this._net.send(this.metadata.def.peer, 'device:invoke', {
            id: this.metadata.def.id,
            seq: id,
            action: action,
            arguments: def ? def.arguments(args): args
        });

        return deferred.promise;
    }

    receiveReply(message) {
        const promise = this._promises[message.seq];
        if(! promise) return;

        if(message.error) {
            promise.deferred.reject(new Error(message.error));
        } else {
            const result = promise.action ? promise.action.resultFromJSON(message.result) : message.result;
            promise.deferred.resolve(result);
        }
        delete this._promises[message.seq];
    }

    receiveProgress(message) {
        const promise = this._promises[message.seq];
        if(! promise) return;

        promise.deferred.notify(message.data);
    }

    _remove() {
        Object.keys(this._promises)
            .forEach(p => this._promises[p].deferred.reject('Device is no longer available'));
    }
}

module.exports = RemoteDevice;
