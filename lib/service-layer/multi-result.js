'use strict';

const comparators = require('../utils/comparator');
const ExtendedIterable = require('../utils/extended-iterable');

const results = Symbol('results');
module.exports = class MultiResult extends ExtendedIterable {
	constructor(instances, data) {
		super();

		this[results] = data.map((d, i) => {
			d.source = instances[i];
			return d;
		});
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
				if(best == null || c(v.value, best) > 0) {
					best = v.value;
				}
			}
		}

		return best;
	}

	highest() {
		return this._pickWithComparator(comparators());
	}

	lowest() {
		return this._pickWithComparator(comparators({
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
}
