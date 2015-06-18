var net = require('./net');
var emptyPort = require('empty-port');

var network = net();
network.join();

network.on('peerJoined', function(id) {
	console.log(id, 'joined');
});

module.exports = {

};
