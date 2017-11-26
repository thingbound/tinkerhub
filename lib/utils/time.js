'use strict';

/**
 * A set of timeout related utilities.
 */
const { duration } = require('abstract-things/values');

module.exports.in = function(delay) {
	delay = duration(delay);
	return new Promise(resolve => {
		setTimeout(resolve, delay.ms);
	});
};
