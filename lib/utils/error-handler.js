'use strict';

const debug = require('debug')('th:error');

const logError = module.exports = function(err) {
	if(err instanceof Error) {
		debug('', err.stack);
	} else {
		debug(err);
	}
};

/**
 * Activate development mode.
 */
module.exports.development = function() {
	debug.enabled = true;

	process.on('unhandledRejection', err => {
		debug('Unhandled Promise rejection, errors from promises should be caught');
		logError(err);
	});
};
