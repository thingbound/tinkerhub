'use strict';

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

	get highest() {

	}

	get lowest() {

	}
}

module.exports = MultiResult;
