'use strict';

/**
 * This is the main entry point into the Tinkerhub ecosystem. Requiring this
 * file will join the local network and make any devices available to the
 * caller.
 */
const debug = require('debug');

const net = require('./net');
const storage = require('./storage');
const autoload = require('./autoload');

const network = net();
network.join();

const registry = require('./device/registry')(network);
const types = require('./device/types/registry');
const values = require('./values');

const limits = require('./events/limits');
const time = require('./utils/time');

module.exports = {
	devices: registry,

	types: types,

	values: values,

	storage: storage,

	limits: limits,

	autoload: autoload

	debug: function(name) {
		return debug('th.' + name);
	}
};
