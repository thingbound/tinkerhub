'use strict';

const { EventEmitter, listenersChanged } = require('appliances/events');
const ExtendedIterable = require('../utils/extended-iterable');
const CallResolver = require('./call-resolver');

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
		this._listenerBridge = function(event, data) {
			self.events.emit(event, data, this);
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
		instance.onAny(this._listenerBridge);
		this.events.emit('available', instance.publicApi);
	}

	_delete(instance) {
		instance.offAny(this._listenerBridge);
		this.events.emit('unavailable', instance.publicApi);
	}

	get length() {
		return this.content.length;
	}

	get content() {
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
		return this.content[Symbol.iterator]();
	}

	call(action, args) {
		const instances = this.toArray();
		const promises = instances.map(i => i[action](...args));
		return new CallResolver(instances, promises);
	}

	on(event, listener) {
		return this.events.on(event, listener);
	}

	off(event, listener) {
		return this.events.off(event, listener);
	}

	inspect() {
		return 'Collection[]';
	}
};
