const { EventEmitter, listenersChanged, Event } = require('appliances/events');

const Metadata = require('./metadata');
const CallResolver = require('./call-resolver');

const proxyHandler = {
	get: function(obj, name) {
		if(name === 'inspect' || name === 'toString') {
			return obj.inspect.bind(obj);
		} else if(obj.metadata.state && obj.metadata.state[name]) {
			return obj.state[name];
		} else if(name === 'on' || name === 'off' || name === 'matches') {
			return obj[name].bind(obj);
		} else if(name === 'id' || name === 'metadata') {
			return obj[name];
		} else {
			if(typeof name !== 'string') return undefined;

			return function(...args) {
				return obj.call(name, args);
			};
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
			this.events.emit(event, new Event(this, payload));
		}
	}

	matches(...tags) {
		return this.metadata.matches(...tags);
	}

	on(event, listener) {
		this.events.on(event, listener);
	}

	onAny(listener) {
		this.events.onAny(listener);
	}

	off(event, listener) {
		this.events.off(event, listener);
	}

	offAny(listener) {
		this.events.offAny(listener);
	}

	call(action, args) {
		for(const service of this.services) {
			if(service.metadata.actions[action]) {
				// This service has the given action, forward call
				return service.call(action, args);
			}
		}

		return Promise.reject(new Error('No action named `' + action + '` could be found'));
	}

	callAll(action, args) {
		let promises = [];
		for(const service of this.services) {
			promises.push(service.call(action, args));
		}
		return new CallResolver(Array.from(this.services), promises);
	}

	inspect() {
		return 'Instance{' + Array.from(this.metadata.tags).join(',') + '}';
	}
};
