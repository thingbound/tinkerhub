const isMergeableObject = require('is-mergeable-object')

function merge(a, b) {
	if(Array.isArray(a)) {
		return mergeArray(a, b);
	} else if(isMergeableObject(a)) {
		return mergeObject(a, b);
	} else {
		return b;
	}
}

function mergeObject(a, b) {
	for(const key of Object.keys(b)) {
		const value = b[key];
		if(typeof a[key] === 'undefined') {
			a[key] = value;
		} else {
			a[key] = merge(a[key], value);
		}
	}
	return a;
}

function mergeArray(a, b) {
	for(const value of b) {
		if(a.indexOf(value) < 0) {
			a.push(value);
		}
	}
	return a;
}

module.exports = merge;
module.exports.customMerge = Symbol('merge');
