var net = require('./net');
var storage = require('./storage');

var network = net();
network.join();

var registry = require('./device/registry')(network);

registry.register('log:' + network.id, {
	metadata: {
		type: 'log'
	},

	info: function() {
		console.log.apply(console.log, arguments);
	}
});

module.exports = {
	devices: registry
};
