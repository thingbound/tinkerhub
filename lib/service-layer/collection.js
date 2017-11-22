'use strict';

const { EventEmitter, listenersChanged } = require('appliances/events');
const ExtendedIterable = require('../utils/extended-iterable');
const CallResolver = require('./call-resolver');
const { ManualDiscovery } = require('tinkerhub-discovery');

const proxyHandler = {
	get: function(obj, name) {
		if(name === 'inspect' || name === 'toString') {
			return obj.inspect.bind(obj);
		} else if(typeof obj[name] === 'function') {
			return obj[name].bind(obj);
		} else if(name === 'length' || name === 'metadata') {
			return obj[name];
		} else {
			if(typeof name !== 'string') return undefined;

			return function(...args) {
				return obj.call(name, args);
			};
		}
	}
};

module.exports = class Collection extends ExtendedIterable {
	constructor(parent, filter) {
		super();

		this.active = true;

		this.parent = parent;
		this.filter = filter;

		this.cache = [];
		this.cacheVersion = 0;

		this.publicApi = new Proxy(this, proxyHandler);

		this.events = new EventEmitter({ context: this.publicApi });
		this.events[listenersChanged] = hasListeners => {
			if(this.hasListeners == hasListeners) return;

			// Make sure we are correctly reference in layer parent
			this.parent.updateCollectionReference(this, hasListeners);
			this.hasListeners = hasListeners;

			if(hasListeners) {
				for(const instance of this) {
					instance.onAny(this._listenerBridge);
				}
			} else {
				for(const instance of this) {
					instance.offAny(this._listenerBridge);
				}
			}
		};

		const self = this;
		this._listenerBridge = function(event, data, source) {
			self.events.emit(event, data, source);
		};

		this.metadata = {
			addTags(...tags) {
				const instances = self.toArray();
				return Promise.all(instances.map(i =>
					i.metadata.addTags(...tags)
				));
			},

			removeTags(...tags) {
				const instances = self.toArray();
				return Promise.all(instances.map(i =>
					i.metadata.removeTags(...tags)
				));
			}
		}
	}

	_add(instance) {
		// Check if we already have this instance
		const content = this.cache;
		for(const thing of content) {
			if(thing.id === instance.id) {
				// Force an update of the cache to make sure we are up to date
				this.content;

				return;
			}
		}

		instance.onAny(this._listenerBridge);
		this.events.emit('available', instance.publicApi);

		// Force an update of the cache
		this.content;
	}

	_delete(instance) {
		const content = this.cache;
		for(const thing of content) {
			if(thing.id === instance.id) {
				// This collection contains this instance
				instance.offAny(this._listenerBridge);
				this.events.emit('unavailable', instance.publicApi);

				break;
			}
		}

		// Force an update of the cache
		this.content;
	}

	get length() {
		if(! this.active) throw new Error('Collection has been destroyed');

		return this.content.length;
	}

	get content() {
		if(! this.active) throw new Error('Collection has been destroyed');

		if(this.cacheVersion != this.parent.version) {
			this.cache = [];
			const filter = this.filter;
			for(const instance of this.parent) {
				if(filter(instance.publicApi)) {
					this.cache.push(instance.publicApi);
				}
			}
			this.cacheVersion = this.parent.version;
		}

		return this.cache;
	}

	[Symbol.iterator]() {
		if(! this.active) throw new Error('Collection has been destroyed');

		return this.content[Symbol.iterator]();
	}

	call(action, args) {
		if(! this.active) throw new Error('Collection has been destroyed');

		const instances = this.toArray();
		const promises = instances.map(i => i[action](...args));
		return new CallResolver(instances, promises);
	}

	on(event, listener) {
		if(! this.active) throw new Error('Collection has been destroyed');

		this.events.on(event, listener);
		return this;
	}

	off(event, listener) {
		if(! this.active) throw new Error('Collection has been destroyed');

		this.events.off(event, listener);
		return this;
	}

	destroy() {
		this.active = false;

		this.events = null;
		this.parent.updateCollectionReference(this, false);
	}

	extendWith(factory) {
		if(! this.active) throw new Error('Collection has been destroyed');

		const discovery = new ManualDiscovery();
		this.on('available', thing => discovery.add(thing));
		this.on('unavailable', thing => discovery.remove(thing));
		this.on('unavailable', thing => console.log('removing thing', thing.id));

		const mapped = discovery.map(thing => {
			return Promise.resolve(factory(thing))
				.then(instance => {
					if(! instance) return;

					instance.id = thing.id;
					return instance;
				});
		});

		for(const thing of this) {
			discovery.add(thing);
		}

		this.parent.registerDiscovery(mapped);
		return this;
	}

	inspect() {
		return 'Collection[]';
	}
};
