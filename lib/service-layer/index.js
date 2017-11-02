const { EventEmitter2 } = require('eventemitter2');

const definition = require('../utils/definition');
const idGenerator = require('../utils/id');

const Instance = require('./instance');

/**
 * Layer on top of services that provides sugar on top of services for easier
 * discovery and use.
 */
module.exports = class ServiceLayer {
	constructor(services, type) {
		this.services = services;
		this.type = type;

		this.events = new EventEmitter2();
		this.instances = new Map();

		services.on('available', this._handleServiceAvailable.bind(this));
		services.on('unavailable', this._handleServiceUnavailable.bind(this));
	}

	on(event, listener) {
		this.events.on(event, listener);
		return this;
	}

	off(event, listener) {
		this.events.off(event, listener);
		return this;
	}

	/**
	* A new service is available, wrap it into this layer
	*/
	_handleServiceAvailable(service) {
		if(service.id.indexOf(this.type + ':') !== 0) {
			// This service is not part of this layer
			return;
		}

		const metadata = service.metadata;
		let instance = this.instances.get(metadata.id);
		if(! instance) {
			instance = new Instance(this, metadata.id);
			instance.addService(service);

			this.events.emit('available', instance.publicApi);
		} else {
			instance.addService(service);
		}
	}

	_handleServiceUnavailable(service) {
		if(service.id.indexOf(this.type + ':') !== 0) {
			// This service is not part of this layer
			return;
		}

		const metadata = service.metadata;
		let instance = this.instances.get(metadata.id);
		if(! instance) return;

		instance.removeService(service);
		if(instance.services.size == 0) {
			this.instances.remove(metadata.id);

			this.events.emit('unavailable', instance.publicApi);
		}
	}

	register(instance) {
		// TODO: Maybe use a proxy to write metadata instead of setting it on the object

		const metadata = instance.metadata || (instance.metadata = {});

		// First make sure the id of the instance is available in the metadata
		metadata.id = instance.id;

		// Resolve all of the actions of the service being registered
		metadata.actions = {};
		for(const action of definition(instance)) {
			let allowAction = true;
			if(metadata.availableAPI) {
				if(! metadata.availableAPI.has(action)) {
					allowAction = false;
				}
			}

			if(allowAction) {
				metadata.actions[action] = {};

				// TODO: Expose more information about actions, such as the available arguments
			}
		}

		const id = this.type + ':' + idGenerator();
		return this.services.register(id, instance);
	}

	/**
	* Get objects with certain tags.
	*/
	get() {

	}

	/**
	* Get all objects this layer makes available.
	*/
	all() {

	}
};
