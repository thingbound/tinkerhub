'use strict';

const Repository = require('./repository');
const values = require('abstract-things/values');

const errorHandler = require('../utils/error-handler');

const createAdapter = require('./adapter');
const idGenerator = require('../utils/id');

const NameableAdapter = require('./nameable-adapter');
const { metadataChanged } = require('ataraxia-services');

const ModifiableCollection = require('./modifiable-collection');

/**
 * Extension to the things repository that can also register new things.
 */
module.exports = class ModifiableRepository extends Repository {

	register(instance) {
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
			.then(() => {
				if(! instance.id) {
					throw new Error('The property `id` is required');
				}

				if(instance.id.indexOf(':') < 0) {
					throw new Error('The `id` must contain a namespace separated with a `:`');
				}
			})
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
									.then(h => data[createAdapter.handle] = h)
									.catch(errorHandler);
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
				.then(handle => registered.set(service.id, handle))
				.catch(err => errorHandler('Error while registering', err));
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
};

module.exports.Collection = ModifiableCollection;
