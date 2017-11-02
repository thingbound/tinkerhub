const { EventEmitter2 } = require('eventemitter2');
const merge = require('../utils/merge');

const proxyHandler = {
	get: function(obj, name) {
		if(name === 'inspect' || name === 'toString') {
			return obj.inspect.bind(obj);
		} else if(obj.metadata.state && obj.metadata.state[name]) {
			return obj.state[name];
		} else if(name === 'on' || name === 'off') {
			return obj[name].bind(obj);
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

		this.metadata = { id };
		this.services = new Set();

		this.publicApi = new Proxy(this, proxyHandler);

		this.state = [];

		this.events = new EventEmitter2();
		this.subscribedToEvents = false;

		this.listenerBridge = this.listenerBridge.bind(this);
	}

	addService(service) {
		if(this.subscribedToEvents) {
			service.onAny(this.listenerBridge);
		}

		this.services.add(service);
		this._recreate();

	}

	removeService(service) {
		if(this.subscribedToEvents) {
			service.offAny(this.listenerBridge);
		}

		this.services.delete(service);
		this._recreate();
	}

	_recreate() {
		this.metadata = {
			id: this.id,

			tags: new Set(),
			types: new Set(),
			capabilities: new Set(),

			actions: {},
			state: {}
		};

		for(const service of this.services) {
			this.metadata.tags = merge(this.metadata.tags, service.metadata.tags);
			this.metadata.types = merge(this.metadata.types, service.metadata.types);
			this.metadata.capabilities = merge(this.metadata.capabilities, service.metadata.capabilities);
			this.metadata.actions = merge(this.metadata.actions, service.metadata.actions);
		}
	}

	listenerBridge(event, payload) {
		if(event !== 'available' && event !== 'unavailable') {
			this.events.emit(event, payload);
		}
	}

	on(event, listener) {
		if(! this.subscribedToEvents) {
			for(const service of this.services) {
				service.onAny(this.listenerBridge);
			}
			this.subscribedToEvents = true;
		}

		this.events.on(event, listener);
	}

	off(event, listener) {
		this.events.off(event, listener);

		if(this.events.listenersAny().length == 0 && this.events.eventNames().length == 0) {
			for(const service of this.services) {
				service.offAny(this.listenerBridge);
			}
			this.subscribedToEvents = false;
		}
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

	inspect() {
		return 'Instance{' + this.id + '}';
	}
};
