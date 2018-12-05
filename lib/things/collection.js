'use strict';

const customInspect = require('util').inspect.custom;

const { EventEmitter, listenersChanged } = require('abstract-things/events');
const ExtendedIterable = require('../utils/extended-iterable');
const CallResolver = require('./call-resolver');

const matchers = require('./matchers');
const Metadata = require('./collection-metadata');

const proxyHandler = {
	get: function(obj, name) {
		if(name === customInspect || name === 'toString') {
			return obj[customInspect].bind(obj);
		} else if(typeof obj[name] === 'function' && name !== 'matcher') {
			return obj[name].bind(obj);
		} else if(name === 'length' || name === 'metadata' || name === 'then') {
			return obj[name];
		} else {
			if(typeof name !== 'string') return undefined;

			return function(...args) {
				return obj.call(name, args);
			};
		}
	}
};

const metadata = Symbol('metadata');
const rebuildMetadata = Symbol('rebuildMetadata');

module.exports = class Collection extends ExtendedIterable {
	constructor(parent, filter) {
		super();

		this.active = true;

		this.parent = parent;
		this.matcher = filter;

		this.cache = [];
		this.cacheVersion = 0;

		this.publicApi = new Proxy(this, proxyHandler);

		this.events = new EventEmitter({ context: this.publicApi });
		this.events[listenersChanged] = hasListeners => {
			if(this.hasListeners === hasListeners) return;

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

		this[metadata] = new Metadata(this);
	}

	_add(instance) {
		// Check if we already have this instance
		const content = this.cache;
		for(const thing of content) {
			if(thing.id === instance.id) {
				// Force an update of the cache to make sure we are up to date
				this.content;

				this.events.emit('thing:updated', instance.publicApi);

				return;
			}
		}

		instance.onAny(this._listenerBridge);
		this.events.emit('available', instance.publicApi);
		this.events.emit('thing:available', instance.publicApi);

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
				this.events.emit('thing:unavailable', instance.publicApi);

				break;
			}
		}

		// Force an update of the cache
		this.content;
	}

	get metadata() {
		// Request the content to be rebuilt
		this.content;

		if(this[rebuildMetadata]) {
			this[rebuildMetadata] = false;

			// Pass all things to the update action
			this[metadata][Metadata.update](this.content);
		}

		return this[metadata];
	}

	get length() {
		if(! this.active) throw new Error('Collection has been destroyed');

		return this.content.length;
	}

	get content() {
		if(! this.active) throw new Error('Collection has been destroyed');

		if(this.cacheVersion !== this.parent.version) {
			this.cache = [];
			const matcher = this.matcher;
			for(const instance of this.parent) {
				if(matcher(instance.publicApi)) {
					this.cache.push(instance.publicApi);
				}
			}
			this[rebuildMetadata] = true;
			this.cacheVersion = this.parent.version;
		}

		return this.cache;
	}

	[Symbol.iterator]() {
		if(! this.active) throw new Error('Collection has been destroyed');

		return this.content[Symbol.iterator]();
	}

	filter(...tags) {
		if(! this.active) throw new Error('Collection has been destroyed');

		const newMatcher = matchers.and(...tags);
		const originalMatcher = this.matcher;
		return new Collection(this.parent, function(thing) {
			if(! originalMatcher(thing)) return false;

			return newMatcher(thing);
		}).publicApi;
	}

	awaitThings() {
		return new Promise(resolve => {
			let count = 0;
			const check = () => {
				if(this.length > 0) {
					// There is something in the collection, resolve directly
					resolve(this.publicApi);
				} else {
					if(count++ < 5) {
						// Check again in a bit
						setTimeout(check, 500);
					} else {
						// Checked lots of times, still nothing so let the promise resolve
						resolve(this.publicApi);
					}
				}
			};

			check();
		});
	}

	call(action, args=[]) {
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

	[customInspect]() {
		return 'Collection{}';
	}
};
