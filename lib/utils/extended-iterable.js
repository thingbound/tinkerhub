'use strict';

module.exports = class ExtendedIterable {
	forEach(func) {
		for(const obj of this) {
			func(obj);
		}
	}

	toArray() {
		const result = [];
		for(const obj of this) {
			result.push(obj);
		}
		return result;
	}
};
