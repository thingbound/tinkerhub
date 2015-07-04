var net = require('./net');
var storage = require('./storage');

var network = net();
network.join();

var registry = require('./device/registry')(network);

module.exports = {
	devices: registry,

	storage: storage,

};
