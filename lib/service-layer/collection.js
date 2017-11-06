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
	}

	_add(instance) {
		instance.onAny(this._listenerBridge);
		this.events.emit('available', instance.publicApi);
	}

	_delete(instance) {
		instance.offAny(this._listenerBridge);
		this.events.emit('unavailable', instance.publicApi);
	}

	[Symbol.iterator]() {
		const it = this.parent[Symbol.iterator]();
		const filter = this.filter;
		return {

			next() {
				let n = it.next();
				while(! n.done && ! filter(n.value.publicApi)) {
					n = it.next();
				}

				return {
					done: n.done,
					value: n.value && n.value.publicApi
				}
			}

		};
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
