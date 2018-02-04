'use strict';

const debug = require('debug')('th:error');

const Network = require('ataraxia');
const LocalTransport = require('ataraxia-local');
const TCPTransport = require('ataraxia-tcp');

module.exports = function(options={}) {
	const net = new Network(Object.assign({
		name: 'tinkerhub'
	}, options));


	if(! options.endpoint) {
		const local = new LocalTransport();
		local.on('leader', () => {
			net.addTransport(new TCPTransport());
		});
		net.addTransport(local);
	} else {
		net.addTransport(new TCPTransport());
	}

	// Start the network and catch any errors during startup
	net.start()
		.catch(err => debug('Could not join network:', err));

	return net;
};
