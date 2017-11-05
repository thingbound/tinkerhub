'use strict';

const ExtendedIterable = require('../utils/extended-iterable');
const CallResolver = require('./call-resolver');

const proxyHandler = {
	get: function(obj, name) {
		if(name === 'inspect' || name === 'toString') {
			return obj.inspect.bind(obj);
		} else if(obj[name]) {
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

	inspect() {
		return 'Collection[]';
	}
};
