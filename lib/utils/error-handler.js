'use strict';

const debug = require('debug')('th:error');

const logError = module.exports = function(err, ...args) {
	if(err instanceof Error) {
		debug('', err.stack);
	} else {
		debug(err, ...args);
	}
};

/**
 * Activate development mode.
 */
module.exports.development = function() {
	debug.enabled = true;

	process.on('unhandledRejection', (reason, e) => {
		debug('Unhandled Promise rejection, errors from promises should be caught');
		logError(reason);
	});

	const echo = require('debug')('th');
	echo.enabled = true;
	echo('Enabled development mode');
};
