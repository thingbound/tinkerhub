'use strict';

const comparator = function(a, b) {
	if(a.compareTo && b.compareTo) {
		return a.compareTo(b);
	} else {
		return a > b ? 1 : (a == b) ? 0 : -1;
	}
};

const reverse = function(a, b) {
	return comparator(b, a);
}

module.exports = function(opts) {
	if(opts && opts.reverse) {
		return reverse;
	} else {
		return comparator;
	}
};
