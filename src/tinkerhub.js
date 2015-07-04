/**
 * This is the main entry point into the Tinkerhub ecosystem. Requiring this
 * file will join the local network and make any devices available to the
 * caller.
 */

require('source-map-support').install();

const net = require('./net');
const storage = require('./storage');

const network = net();
network.join();

const registry = require('./device/registry')(network);

module.exports = {
	devices: registry,

	storage: storage
};
