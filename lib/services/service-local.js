'use strict';

const Service = require('./service');
const generateId = require('../utils/id');

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

	get metadata()  {
		return this.instance.metadata;
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
			return Promise.reject(new Error('No action named ' + action));
		}

		if(typeof func !== 'function') {
			return Promise.resolve(func);
		}

		let fr;
		try {
			fr = func.apply(instance, args);
		} catch(ex) {
			if(ex instanceof Error) {
				return Promise.reject(ex);
			} else {
				return Promise.reject(new Error(ex));
			}
		}

		return Promise.resolve(fr);
	}

	remove() {
		// Remove this service from the registry
		this.parent.remove(this.id);
	}

	inspect() {
		return 'LocalService[' + this.id + ']';
	}
}
