'use strict';

/**
 * This is the main entry point into the Tinkerhub ecosystem. Requiring this
 * file will join the local network and make any devices available to the
 * caller.
 */

const net = require('./net');
const storage = require('./storage');
const autoload = require('./autoload');

const network = net();
network.join();

const registry = require('./device/registry')(network);
const types = require('./device/types/registry');

const limits = require('./events/limits');

module.exports = {
	devices: registry,

	types: types,

	storage: storage,

	limits: limits,

	autoload: autoload
};
