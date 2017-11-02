'use strict';

const Service = require('./service');
const generateId = require('../utils/id');
const Q = require('q');

/**
 * Service that has been registered locally.
 */
module.exports = class LocalService extends Service {
	constructor(parent, id, instance) {
		super();

		this.debug = require('debug')('th:service:' +  id);

		this.parent = parent;
		this.instance = instance;

		this.id = id;
		this.instanceId = parent.id + ':' + generateId();

		this.subscriptions = [];
	}

	get definition() {
		return {
			id: this.id,
			instance: this.instanceId,
			metadata: this.instance.metadata
		};
	}

	emitEvent(event, payload) {
		this.debug('Emitting event', event, 'with payload', payload);

		const msg = {
			service: this.id,
			instance: this.instance,
			name: event,
			payload: payload
		};

		for(const node of this.subscriptions) {
			node.send('service:event', msg);
		}

		// Trigger local listeners
		super.emitEvent(event, payload);
	}

	subscribe(node) {
		this.subscriptions.push(node);
	}

	unsubscribe(node) {
		const idx = this.subscriptions.find(n => n.id == node.id);
		if(idx >= 0) {
			this.subscriptions.splice(idx, 1);
		}
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
