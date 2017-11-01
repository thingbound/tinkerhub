'use strict';

const generateId = require('../utils/id');
const Q = require('q');

/**
 * Service that has been registered locally.
 */
module.exports = class LocalService {
    constructor(parent, id, instance) {
        this.debug = require('debug')('th:service:' +  id);

        this.parent = parent;
        this.instance = instance;

		this.id = id;
		this.instanceId = parent.id + ':' + generateId();
	}

	get definition() {
		return {
			id: this.id,
			instance: this.instanceId,
			metadata: this.instance.metadata
		};
	}

    emit(event, payload) {
        this.debug('Emitting event', event, 'with payload', payload);

        this.parent.emitEvent(this, event, payload);
    }

    /**
     * Invoke a certain action on this device. This method will delegate to
     * the actual implementation.
     */
    call(action, args, opts) {
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

        let promise;
        let fr;

        try {
            fr = func.apply(instance, args);
        } catch(ex) {
            if(ex instanceof Error) {
                fr = ex;
            } else {
                fr = new Error(ex);
            }
        }

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

    remove() {
		// Remove this service from the registry
        this.parent.remove(this.id);
	}

	inspect() {
		return 'LocalService[' + this.id + ']';
	}
}
