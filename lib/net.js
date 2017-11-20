'use strict';

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

	net.start();
	return net;
};
