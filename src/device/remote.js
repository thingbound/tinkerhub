
var EventEmitter = require('../events').EventEmitter;

var metadata = require('./metadata');
var Q = require('q');
var seq = 0;

class RemoteDevice {
    constructor(net, def) {
        this._net = net;

        this._debug = require('debug')('th.device.' +  def.id);
        this._emitter = new EventEmitter(this);
        this._listeners = [];

        this._promises = {};

        this.metadata = metadata(this, def);
    }

    receiveEvent(event, payload) {
        this._debug('Emitting event', event, 'with payload', payload);

        this._emitter.emit(event, payload);
        this._listeners.forEach(function(listener) {
            listener(event, payload);
        });
    }

    on(event, listener) {
        this._emitter.on(event, listener);
    }

    onAll(listener) {
        this._emitter.onAny(listener);
    }

    call(action, args) {
        const deferred = Q.defer();

        const id = seq++;
        if(seq > 10000) seq = 0;

        this._promises[id] = deferred;

        this._net.send(this.metadata.def.peer, 'device:invoke', {
            id: this.metadata.def.id,
            seq: id,
            action: action,
            arguments: args
        });

        return deferred.promise;
    }

    receiveReply(message) {
        const deferred = this._promises[message.seq];
        if(message.error) {
            deferred.reject(new Error(message.error));
        } else {
            deferred.resolve(message.result);
        }
        delete this._promises[message.seq];
    }

    receiveProgress(message) {
        const deferred = this._promises[message.seq];
        deferred.notify(message.data);
    }
}

module.exports = RemoteDevice;
