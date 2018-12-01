'use strict';

const { EventEmitter } = require('abstract-things/events');

const Instance = require('./instance');
const Collection = require('./collection');
const matchers = require('./matchers');

const ALWAYS_TRUE = () => true;

/**
 * Layer on top of services that provides sugar on top of services for easier
 * discovery and use.
 */
module.exports = class Repository {
	constructor(services, publicApi) {
		this.services = services;
		this.type = 'things';

		this.events = new EventEmitter(publicApi || this);
		this.instances = new Map();
		this.collections = new Set();

		this.version = 0;

		services.on('available', this._handleServiceAvailable.bind(this));
		services.on('unavailable', this._handleServiceUnavailable.bind(this));
		services.on('updated', this._handleServiceAvailable.bind(this));
	}

	on(event, listener) {
		return this.events.on(event, listener);
	}

	off(event, listener) {
		return this.events.off(event, listener);
	}

	updateCollectionReference(collection, keepReference) {
		if(keepReference) {
			this.collections.add(collection);
		} else {
			this.collections.delete(collection);
		}
	}

	/**
	 * Go through all hard referenced collections and make sure that they
	 * reflect thing availability.
	 *
	 * @param {*} instance
	 */
	updateCollectionAvailability(instance) {
		this.version++;

		for(const c of this.collections) {
			if(c.matcher(instance.publicApi)) {
				// Request that a thing should be added if not in collection
				c._add(instance);
			} else {
				// Delete a thing from the collection if it does not match
				c._delete(instance);
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
			this.events.emit('thing:available', instance.publicApi);
		} else {
			instance.addService(service);

			this.events.emit('thing:updated', instance.publicApi);
		}

		this.updateCollectionAvailability(instance);
	}

	_handleServiceUnavailable(service) {
		if(service.id.indexOf(this.type + ':') !== 0) {
			// This service is not part of this layer
			return;
		}

		const metadata = service.metadata;
		let instance = this.instances.get(metadata.id);
		if(! instance) return;

		this.version++;

		instance.removeService(service);
		if(instance.services.size === 0) {
			this.instances.delete(metadata.id);

			this.events.emit('unavailable', instance.publicApi);
			this.events.emit('thing:unavailable', instance.publicApi);
		} else {
			this.events.emit('thing:updated', instance.publicApi);
		}

		this.updateCollectionAvailability(instance);
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
		return new Collection(this, matchers.and(...tags)).publicApi;
	}

	/**
	* Get all objects this layer makes available.
	*/
	all() {
		return new Collection(this, ALWAYS_TRUE).publicApi;
	}
};
