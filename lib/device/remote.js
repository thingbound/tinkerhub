'use strict';

const values = require('../values');

const metadata = require('./metadata');
const Q = require('q');
let seq = 0;

class RemoteDevice {
    constructor(net, def) {
        this._net = net;

        this._debug = require('debug')('th.device.' +  def.id + '.' + def.instance);

        this._promises = {};

        this.metadata = metadata(this, def);

        // Create our type converters
        this._actions = {};
        Object.keys(def.actions).forEach(key => {
            const action = def.actions[key];
            const argumentConverter = values.createToJSON(action.arguments);
            const resultTypeConverter = values.createConversion(action.returnType);

            this._actions[key] = {
                arguments: argumentConverter,
                resultFromJSON: resultTypeConverter
            };
        });
    }

    mergeWith(other) {
		if(other._promises) {
			this._promises = other._promises;
		}
    }

    canCall(action) {
        return !! this._actions[action];
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

        this._debug('Calling ' + action + ' via peer ' + this.metadata.def.peer + ' (owner is ' + this.metadata.def.owner + ')');
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
