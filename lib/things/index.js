'use strict';

const customInspect = require('util').inspect.custom;

const values = require('abstract-things/values');
const { EventEmitter } = require('abstract-things/events');

const createAdapter = require('./adapter');
const idGenerator = require('../utils/id');

const Instance = require('./instance');
const Collection = require('./collection');
const matchers = require('./matchers');

const NameableAdapter = require('./nameable-adapter');
const { metadataChanged } = require('ataraxia-services');

const ALWAYS_TRUE = () => true;

/**
 * The public API for working with a layer.
 */
class Things {
	constructor(layer) {
		this.on = layer.on.bind(layer);
		this.off = layer.off.bind(layer);

		this.register = layer.register.bind(layer);
		this.registerDiscovery = layer.registerDiscovery.bind(layer);

		this.get = layer.get.bind(layer);
		this.all = layer.all.bind(layer);

		this.toString = this[customInspect] = () => 'Things{type=' + layer.type + '}';

		this.version = 0;
	}
}

/**
 * Layer on top of services that provides sugar on top of services for easier
 * discovery and use.
 */
module.exports = class {
	constructor(services) {
		this.services = services;
		this.type = 'things';

		this.publicApi = new Things(this);
		this.events = new EventEmitter(this.publicApi);
		this.instances = new Map();
		this.collections = new Set();

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

	register(instance) {
		if(! instance.id) {
			throw new Error('The property `id` is required');
		}

		if(instance.id.indexOf(':') < 0) {
			throw new Error('The `id` must contain a namespace separated with a `:`');
		}

		/*
		 * If there is an init function it is automatically invoked when
		 * registering.
		 */
		let promise;
		if(typeof instance.init === 'function') {
			promise = Promise.resolve(instance.init());
		} else {
			promise = Promise.resolve();
		}

		return promise
			.then(() => createAdapter(instance))
			.then(adapter => {
				const id = this.type + ':' + idGenerator();
				const handle = this.services.register(id, adapter);

				/*
				 * A custom handle is created to track all of the child
				 * things and the extra nameable adapter.
				 */
				const extraThings = [];
				adapter[createAdapter.handle] = {
					[metadataChanged]: (...args) => handle[metadataChanged](...args),

					remove() {
						handle.remove();

						for(const thing of extraThings) {
							thing.remove();
						}
					}
				};

				// If there is an onAny start listening to and handle events
				if(instance.onAny) {
					instance.onAny((event, data) => {
						switch(event) {
							case 'thing:available':
								this.register(data)
									.then(h => data[createAdapter.handle] = h);
								break;
							case 'thing:unavailable':
								if(data[createAdapter.handle]) {
									data[createAdapter.handle].remove();
								}
								break;
							case 'thing:metadata':
								adapter[createAdapter.change]();
								break;
							default:
								handle.emitEvent(event, values.toJSON('mixed', data));
								break;
						}
					});
				}

				const promises = [];

				// Register children if they are available
				let children = instance.children;
				if(typeof children === 'function') {
					/*
					 * To support both older abstract-things and newer ones
					 * we check if children is a function and invoke it if
					 * needed.
					 */
					children = instance.children();
				}

				if(children && typeof children[Symbol.iterator] === 'function') {
					for(const child of children) {
						promises.push(this.register(child)
							.then(subHandle => extraThings.push(subHandle))
						);
					}
				}

				/*
				 * Check if the instance being registered is a thing and if
				 * it's nameable, if it's not nameable register an extra
				 * thing to make it nameable.
				 */
				if(instance.matches && ! instance.matches('cap:nameable')) {
					promises.push(this.register(new NameableAdapter(instance))
						.then(subHandle => extraThings.push(subHandle))
					);
				}

				return Promise.all(promises)
					.then(() => adapter[createAdapter.handle]);
			});
	}

	registerDiscovery(discovery) {
		// Automatically start the discovery
		discovery.start();

		const registered = new Map();

		const available = service => {
			this.register(service)
				.then(handle => registered.set(service.id, handle));
		};

		function unavailable(service) {
			const handle = registered.get(service.id);
			if(handle) {
				registered.delete(service.id);
				handle.remove();
			}
		}

		// Start listening for changes in instances
		discovery.on('available', available);
		discovery.on('unavailable', unavailable);

		return {
			remove: function() {
				discovery.off('available', available);
				discovery.off('unavailable', unavailable);

				// Remove all of the instances that come from this discovery
				for(const handle of registered) {
					handle.remove();
				}
			}
		};
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
