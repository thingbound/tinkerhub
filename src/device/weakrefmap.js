const debug = require('debug')('th.devices.weakrefmap');
const weak = require('weak');

function createRemover(map, key) {
    return function() {
        debug('Removing ' + key + ' as it is no longer referenced');
        delete map._entries[key];
    };
}

function createHardRefUpdater(map, key) {
    let hasRef = false;
    return function(hasAny) {
        const value = weak.get(map._entries[key]);
        if(! value) return;

        if(hasAny) {
            if(! hasRef) {
                map.increaseRef(key);
                hasRef = true;
            }
        } else {
            if(hasRef) {
                map.decreaseRef(key);
            }
        }
    };
}

/**
 * Special version of a WeakMap that allows iteration of items and keeps track
 * of listeners on devices and collections added to it.
 */
class WeakRefMap {
    constructor() {
        this._entries = {};
        this._hardRefs = {};
    }

    increaseRef(key) {
        const value = weak.get(this._entries[key]);
        if(! value) return;

        const c = this._hardRefs[key];
        if(c) {
            c.refs++;
        } else {
            this._hardRefs[key] = {
                obj: value,
                refs: 1
            };
        }

        debug('Increased hard reference to ' + key + ', now ' + this._hardRefs[key].refs);
    }

    decreaseRef(key) {
        const value = weak.get(this._entries[key]);
        if(! value) return;

        const c = this._hardRefs[key];
        if(c && c.refs > 1) {
            c.refs--;
            debug('Decreased hard reference to ' + key + ', now ' + c.refs);
        } else {
            delete this._hardRefs[key];
            debug('Decreased hard reference to ' + key + ', no longer hard referenced');
        }
    }

    put(key, data) {
        this._entries[key] = weak(data, createRemover(this, key));
        if(data._events) {
            data._events._listenerChangeListener = createHardRefUpdater(this, key);
        }
    }

    get(key) {
        const value = this._entries[key];
        if(! value) return null;

        return weak.get(value) || null;
    }

    forEach(cb) {
        Object.keys(this._entries).forEach(key => {
            const value = weak.get(this._entries[key]);
            if(value) cb(key, value);
        });
    }
}

module.exports = WeakRefMap;
