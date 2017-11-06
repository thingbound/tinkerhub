'use strict';

/**
 * A set of timeout related utilities.
 */
const duration = require('amounts').duration;

module.exports.in = function(delay) {
	delay = duration(delay);
	return new Promise(resolve => {
		setTimeout(resolve, delay.ms);
	});
};
