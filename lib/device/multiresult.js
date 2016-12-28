'use strict';

const comparators = require('../utils/comparator');

class MultiResult {
	constructor() {
		let items = [];
		Object.defineProperty(this, '_items', {
			get: function() { return items; }
		});

		let errors;
		Object.defineProperty(this, 'hasErrors', {
			get: function() { return errors; },
			set: function(v) { errors = v; }
		});
	}

	addValue(device, value) {
		const data = {
			device: device,
			value: value
		};

		this._items.push(data);
		this[device.metadata.id] = data;
		return this;
	}

	addError(device, error) {
		const data = {
			device: device,
			error: error
		};

		this._items.push(data);
		this[device.metadata.id] = data;
		this.hasErrors = true;
		return this;
	}

	get length() {
		return this._items.length;
	}

	get empty() {
		return this.length > 0;
	}

	get(idx) {
		return this._items[idx];
	}

	get firstValue() {
		for(let i=0; i<this._items.length; i++) {
			const item = this._items[i];
			if(! item.error) return item.value;
		}

		return null;
	}

	get firstError() {
		for(let i=0; i<this._items.length; i++) {
			const item = this._items[i];
			if(item.error) return item.error;
		}

		return null;
	}

    _pickWithComparator(c) {
        let best = null;
        for(let i=0; i<this._items.length; i++) {
            const item = this._items[i];
            if(! item.error) {
                if(best == null || c(item.value, best) > 0) {
                    best = item.value;
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
		let result = {};
		for(let i=0; i<this._items.length; i++) {
			const item = this._items[i];
			if(! item.error) {
				if(typeof result[item.value] === 'undefined') {
					result[item.value] = 1;
				} else {
					result[item.value]++;
				}
			}
		}
		return result;
	}

	mostlyTrue() {
		let distinct = this.distinct();
		return (distinct[true] || 0) > (distinct[false] || 0);
	}

	mostlyFalse() {
		return ! mostlyTrue();
	}
}

module.exports = MultiResult;
