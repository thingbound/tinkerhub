var net = require('./net');

var network = net();
network.join();

var registry = require('./device/registry')(network);

registry.register('log:' + network.id, {
	info: function() {
		console.log.apply(console.log, arguments);
	}
});

module.exports = {

};
