'use strict';

const debug = require('debug')('th:net:tcp');
const { EventEmitter2 } = require('eventemitter2');

const eos = require('end-of-stream');

const mdns = require('tinkerhub-mdns');
const net = require('net');
const amp = require('amp');
const Parser = amp.Stream;

/**
 * TCP based transport.
 */
module.exports = class TCP {
	constructor(id) {
		this.id = id;

		this.events = new EventEmitter2(this);
		this.stoppables = [];

		this.peers = new Map();
	}

	on(event, handler) {
		this.events.on(event, handler);
	}

	join() {
		this.server = net.createServer();

		const handlePeer = peer => {
			// Keep track of this peer
			this.peers.set(peer.id, peer);

			peer.on('disconnected', () => {
				this.peers.delete(peer.id);
			});

			peer.on('connected', () => {
				// Emit that we found a peer
				this.events.emit('peer:connected', peer);
			});
		};

		this.server.on('error', err => {
			this._events.emit('error', err);
		});

		this.server.on('connection', socket => {
			const peer = new Peer(this);
			handlePeer(peer);
			peer.setSocket(socket);
		});

		this.server.listen(() => {
			this.port = this.server.address().port;
			this.stoppables.push(mdns.expose({
				name: this.id,
				type: 'tinkerhub-mesh',
				port: this.port
			}));
		});

		// Start discovering which peers we have
		const browser = mdns.browser({
			type: 'tinkerhub-mesh'
		}, 600);
		this.stoppables.push(browser);

		browser.on('available', service => {
			// Protect against connecting to ourselves
			if(service.name === this.id) return;

			let peer = this.peers.get(service.id);
			if(peer && ! (peer instanceof ClientPeer)) return;

			if(peer) {
				if(! (peer instanceof ClientPeer)) return;
			} else {
				peer = new ClientPeer(this, service.name);
				handlePeer(peer);
			}

			peer.setReachableVia(service.addresses, service.port);
			peer.tryConnect();
		});
	}

	leave() {
		this.stoppables.forEach(item => item.stop());
	}

	connect(address, port) {
		const client = net.connect({
			host: address,
			port: port
		});
		return new Peer(this, client);
	}
}

class Peer {
	constructor(transport) {
		this.transport = transport;
		this.events = new EventEmitter2();
	}

	setSocket(s) {
		this.socket = s;

		// Setup error and disconnected events
		eos(s, this.handleDisconnect.bind(this));

		// Setup the parser for incoming messages
		const parser = new Parser();
		s.pipe(parser);

		parser.on('data', buf => {
			const data = amp.decode(buf);
			const type = data[0].toString();
			const payload = JSON.parse(data[1].toString());

			debug('Incoming', type, 'with payload', payload);
			this.events.emit(type, payload);
		});

		// Reply to hello messages with our metadata
		this.events.on('hello', msg => {
			this.id = msg.id;
			this.version = msg.version;

			this.write('metadata', {
				id: this.transport.id,
				version: 1
			});
		});

		return this.negotiate();
	}

	handleDisconnect(err) {
		if(typeof err !== 'undefined') {
			this.events.emit('error', err);
		}

		this.events.emit('disconnected');
	}

	negotiate() {
		let handled = false;

		// Listen for metadata about the other peer
		this.events.once('metadata', md => {
			if(handled) return;

			this.id = md.id;
			this.version = md.version;

			clearTimeout(timeout);

			this.events.emit('connected');
		});

		// Write the hello message
		this.write('hello', {
			id: this.transport.id,
			version: 1
		});

		// Give the negotiation a second to complete
		const timeout = setTimeout(() => {
			handled = true;

			this.socket.destroy();
		}, 1000);
	}

	on(event, handler) {
		this.events.on(event, handler);
	}

	disconnect() {
		if(this.socket) {
			this.socket.destroy();
		} else {
			this.handleDisconnect();
		}
	}

	send(payload) {
		this.write('message', payload);
	}

	write(type, payload) {
		const data = amp.encode([
			Buffer.from(type),
			Buffer.from(JSON.stringify(payload))
		]);
		this.socket.write(data);
	}

	inspect() {
		return 'TCP[' +  this.id + '->self]';
	}
}

class ClientPeer extends Peer {
	constructor(transport, id) {
		super(transport);

		this.id = id;
	}

	setReachableVia(addresses, port) {
		this.addresses = addresses;
		this.addressAttempt = 0;
		this.port = port;

		this.maxAttempts = addresses.length * 10;
		this.attempt = 0;
	}

	handleDisconnect(err) {
		debug(this.id + ' failed to connect');

		this.addressAttempt++;
		if(this.addressAttempt < this.addresses.length) {
			this.tryConnect();
		} else {
			if(this.attempts >= this.maxAttempts) {
				debug(this.id + ' has reached the connection attempt limit');
				super.handleDisconnect();
			} else {
				debug(this.id + ' has no more addresses to try, trying in 60 seconds');
				this.addressAttempt = 0;
				this.connectTimeout = setTimeout(() => this.tryConnect(), 60000);
			}
		}
	}

	tryConnect() {
		const address = this.addresses[this.addressAttempt];
		debug(this.id + ' attempting connect to  ' + address + ':' + this.port);

		this.attempt++;

		const client = net.connect({
			host: address,
			port: this.port
		});
		client.on('connect', () => {
			debug(this.id + ' connected via ' + address + ':' + this.port);
		});
		this.setSocket(client);
	}

	disconnect() {
		super.disconnect();
		clearTimeout(this.connectTimeout);
	}

	inspect() {
		return 'TCP[self->' +  this.id + ']';
	}
}
