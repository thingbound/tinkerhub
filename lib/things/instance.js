'use strict';

const customInspect = require('util').inspect.custom;
const { EventEmitter, listenersChanged } = require('abstract-things/events');

const Metadata = require('./metadata');
const CallResolver = require('./call-resolver');

const values = require('abstract-things/values');

const proxyHandler = {
	get: function(obj, name) {
		if(name === customInspect || name === 'toString') {
			return obj[customInspect].bind(obj);
		} else if(name === 'on' || name === 'off' || name === 'matches') {
			return obj[name].bind(obj);
		} else if(name === 'id' || name === 'metadata' || name === 'then') {
			return obj[name];
		} else {
			if(typeof name === 'symbol') {
				return obj[name];
			}

			if(typeof name !== 'string') return undefined;

			return function(...args) {
				return obj.call(name, args);
			};
		}
	},

	set: function(obj, name, v) {
		if(typeof name === 'symbol') {
			obj[name] = v;
			return true;
		} else {
			throw new Error('Can not set property: ' + name.toString());
		}
	}
};

/**
 * Representation of a instance
 */
module.exports = class Instance {
	constructor(layer, id) {
		this.layer = layer;
		this.id = id;

		this.metadata = new Metadata(this);
		this.services = new Set();

		this.publicApi = new Proxy(this, proxyHandler);

		this.state = [];

		this.events = new EventEmitter({ context: this.publicApi });
		this.events[listenersChanged] = hasListeners => {
			if(hasListeners === this.subscribedToEvents) return;

			this.subscribedToEvents = hasListeners;
			if(hasListeners) {
				for(const service of this.services) {
					service.onAny(this.listenerBridge);
				}
			} else {
				for(const service of this.services) {
					service.offAny(this.listenerBridge);
				}
			}
		};
		this.subscribedToEvents = false;

		this.listenerBridge = this.listenerBridge.bind(this);
	}

	addService(service) {
		if(this.subscribedToEvents) {
			service.onAny(this.listenerBridge);
		}

		this.services.add(service);
		this.metadata[Metadata.update](this.services);

	}

	removeService(service) {
		if(this.subscribedToEvents) {
			service.offAny(this.listenerBridge);
		}

		this.services.delete(service);
		this.metadata[Metadata.update](this.services);
	}

	listenerBridge(event, payload) {
		if(event !== 'available' && event !== 'unavailable') {
			payload = values.fromJSON('mixed', payload);
			this.events.emit(event, payload, this);
		}
	}

	matches(...tags) {
		return this.metadata.matches(...tags);
	}

	on(event, listener) {
		return this.events.on(event, listener);
	}

	onAny(listener) {
		return this.events.onAny(listener);
	}

	off(event, listener) {
		return this.events.off(event, listener);
	}

	offAny(listener) {
		return this.events.offAny(listener);
	}

	call(action, args) {
		// TODO: Support for marking certain actions for merging?
		if(action === 'state') {
			return this.callAll(action, args)
				.merge();
		}

		for(const service of this.services) {
			if(service.metadata.actions[action]) {
				// This service has the given action, forward call
				return service.call(action, values.toJSON('array', args))
					.then(result => values.fromJSON('mixed', result));
			}
		}

		return Promise.reject(new Error('No action named `' + action + '` could be found'));
	}

	callAll(action, args) {
		let promises = [];
		for(const service of this.services) {
			promises.push(service.call(action, args)
				.then(result => values.fromJSON('mixed', result))
			);
		}
		return new CallResolver(Array.from(this.services), promises);
	}

	[customInspect]() {
		return 'Thing{id=' + this.id + '}';
	}
};
