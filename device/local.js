
var EventEmitter = require('events').EventEmitter;

var Q = require('q');

function LocalDevice(parent, id, instance) {
    this._debug = require('debug')('th.device.' +  id);
    this._emitter = new EventEmitter();

    this._net = parent._net;
    this.instance = instance;

    var def = {};
    def.id = id;
    def.peer = def.owner = this._net.id;

    this.def = def;

    this.local = true;
    this.remote = false;
}

LocalDevice.prototype.emit = function(event, payload) {
    this._debug('Emitting event', event, 'with payload', payload);

    this._net.broadcast('device:event', {
        id: this.def.id,
        event: event,
        payload: payload
    });

    this._emitter.emit(event, payload);
};

LocalDevice.prototype.on = function(event, listener) {
    this._emitter.on(event, listener);
};

LocalDevice.prototype.call = function(action, args) {
    var func = this.instance[action];
    if(! func) {
        var err = Q.defer();
        err.reject(new Error('No action named ' + action));
        return err.promise;
    }

    var promise;
    var fr = func.apply(this.instance, args);
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

module.exports = LocalDevice;
