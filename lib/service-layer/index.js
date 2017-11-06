const { EventEmitter2 } = require('eventemitter2');

const definition = require('../utils/definition');
const idGenerator = require('../utils/id');

const Instance = require('./instance');
const Collection = require('./collection');

const ALWAYS_TRUE = () => true;

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
		this.collections = new Set();

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

	updateCollectionReference(collection, keepReference) {
		if(keepReference) {
			this.collections.add(collection);
		} else {
			this.collections.delete(collection);
		}
	}

	matchingCollections(instance, callback) {
		for(const c of this.collections) {
			if(c.filter(instance.publicApi)) {
				callback(c);
			}
		}
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

			this.instances.set(metadata.id, instance);
			this.events.emit('available', instance.publicApi);

			this.matchingCollections(instance, collection => collection.events.emit('available', instance.publicApi));
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
			this.instances.delete(metadata.id);

			this.events.emit('unavailable', instance.publicApi);

			this.matchingCollections(instance, collection => collection.events.emit('unavailable', instance.publicApi));
		}
	}

	register(instance) {
		// TODO: Maybe use a proxy to write metadata instead of setting it on the object

		const metadata = instance.metadata || (instance.metadata = {});

		// First make sure the id of the instance is available in the metadata
		metadata.id = instance.id;

		// Create the tags of the instance
		metadata.tags = [ 'id:' + metadata.id ];

		if(metadata.types) {
			for(const type of metadata.types) {
				metadata.tags.push('type:' + type);
			}
		}

		if(metadata.capabilities) {
			for(const cap of metadata.capabilities) {
				metadata.tags.push('cap:' + cap);
			}
		}

		if(! metadata.actions) {
			// Resolve all of the actions of the service being registered
			metadata.actions = {};
			for(const action of definition(instance)) {
				metadata.actions[action] = {};
			}
		}

		const id = this.type + ':' + idGenerator();
		return this.services.register(id, instance);
	}

	/**
	 * Iterate over all of the instances.
	 */
	[Symbol.iterator]() {
		return this.instances.values();
	}

	/**
	* Get objects with certain tags.
	*/
	get(...tags) {
		return new Collection(this, a => a.metadata.hasTags(...tags)).publicApi;
	}

	/**
	* Get all objects this layer makes available.
	*/
	all() {
		return new Collection(this, ALWAYS_TRUE).publicApi;
	}
};
