/**
 * A set of limits that can be used together with `when` events.
 */
'use strict';

const debug = require('debug')('th.limits');

module.exports.is = function(value) {
	return function(data) {
		return data === value;
	};
};

module.exports.becomes = function(value) {
	let current = null;
	if(typeof value === 'function') {
		return function(data) {
			const v = value(data);
			if(current === v) return false;

			current = v;
			return !! current;
		};
	} else {
		return function(data) {
			if(current === data) return false;

			debug('becomes new=', data, 'should be=', value);
			current = data;
			return value === data;
		};
	}
};

module.exports.pick = function(id, next) {
	return function(data) {
		const v = data[id];
		return next(v);
	};
};

module.exports.below = function(value) {
	return function(data) {
		return data < value;
	};
};

module.exports.above = function(value) {
	return function(data) {
		return data > value;
	};
};
