'use strict';

const comparators = require('../utils/comparator');
const ExtendedIterable = require('../utils/extended-iterable');
const merge = require('abstract-things/utils/merge');

const results = Symbol('results');
module.exports = class MultiResult extends ExtendedIterable {
	constructor(instances, data) {
		super();

		if(data) {
			this[results] = data.map((d, i) => {
				d.source = d.thing = instances[i];
				return d;
			});
		} else {
			this[results] = instances;
		}
	}

	[Symbol.iterator]() {
		return this[results][Symbol.iterator]();
	}

	get length() {
		return this[results].length;
	}

	get empty() {
		return this.length > 0;
	}

	filter(func) {
		const items = [];
		for(const item of this) {
			if(func(item)) {
				items.push(item);
			}
		}

		return new this.constructor(items);
	}

	filterValues(func) {
		const items = [];
		for(const item of this) {
			if(item.isFulfilled && func(item.value)) {
				items.push(item);
			}
		}

		return new this.constructor(items);
	}

	mapValues(func) {
		const items = [];
		for(const item of this) {
			if(! item.isFulfilled) {
				// Non-fulfilled results are kept as is
				items.push(item);
			} else {
				// Map the value
				const mapped = func(item.value);

				// Create a copy of the result and set the mapped value
				const copy = Object.assign({}, item);
				copy.value = mapped;
				items.push(copy);
			}
		}

		return new this.constructor(items);
	}

	get(idx) {
		if(typeof idx === 'number') {
			return this[results][idx] || null;
		} else if(typeof idx === 'string') {
			for(const r of this[results]) {
				if(r.source && r.source.id === idx) {
					return r;
				}
				return null;
			}
		} else if(typeof idx === 'object') {
			return this.get(idx.id);
		} else {
			return null;
		}
	}

	firstValue() {
		for(const v of this[results]) {
			if(v.isFulfilled) return v.value;
		}

		return null;
	}

	firstError() {
		for(const v of this[results]) {
			if(v.isRejected) return v.reason;
		}

		return null;
	}

	pickWithComparator(c) {
		let best = null;
		for(const v of this[results]) {
			if(v.isFulfilled) {
				if(best === null || c(v.value, best) > 0) {
					best = v.value;
				}
			}
		}

		return best;
	}

	highest() {
		return this.pickWithComparator(comparators());
	}

	lowest() {
		return this.pickWithComparator(comparators({
			reverse: true
		}));
	}

	distinct() {
		let result = new Map();
		for(const v of this[results]) {
			if(v.isFulfilled) {
				const value = result.get(v.value) || null;
				if(value === null) {
					result.set(v.value, 1);
				} else {
					result.set(v.value, value + 1);
				}
			}
		}
		return result;
	}

	anyTrue() {
		let distinct = this.distinct();
		return distinct.get(true) > 0;
	}

	mostlyTrue() {
		let distinct = this.distinct();
		return (distinct.get(true) || 0) > (distinct.get(false) || 0);
	}

	anyFalse() {
		let distinct = this.distinct();
		return distinct.get(false) > 0;
	}

	mostlyFalse() {
		return ! this.mostlyTrue();
	}

	merge() {
		let result;
		for(const r of this[results]) {
			if(r.isRejected) {
				throw new Error('Could not merge due to error; ' + r.reason.message);
			}

			if(result) {
				result = merge(result, r.value);
			} else {
				result = r.value;
			}
		}
		return result;
	}
};
