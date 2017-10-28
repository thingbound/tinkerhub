'use strict';

const EventEmitter = require('../events').EventEmitter;
const debug = require('debug')('th:net');

const id = require('../utils/id');
const MachineLocal = require('./local');

class Network {
    constructor() {
        this.events = new EventEmitter(this);

        this.id = id();

        this.on = this.events.on.bind(this.events);
        this.off = this.events.off.bind(this.events);

		this.transports = [];

		const local = new MachineLocal(this.id);
		local.on('leader', () => {
			// TODO: Start the main network transport here
			debug('This instance is now the local leader');
		});
		this.addTransport(local);
    }

	addTransport(transport) {
		this.transports.push(transport);

		transport.on('peer:connected', peer => {
			debug('Connected to', peer);

			const wrapped = new WrappedPeer(peer);
			peer.on('message', msg => this._handleMessage(wrapped, msg));
			peer.on('disconnected', () => this.events.emit('peer:disconnected', wrapped));

			this.events.emit('peer:connected', wrapped);
		});
	}

    /**
     * Join the network by starting a server and then looking for peers.
     */
    join() {
        debug('About to join network as ' + this.id);

		this.transports.forEach(t => t.join());
    }

    /**
     * Leave the currently joined network.
     */
    leave() {
		this.transports.forEach(t => t.leave());
	}

	_handleMessage(peer, data) {
		debug(peer, 'sent message', data);
		this.events.emit('message', {
			peer: peer,
			type: data.type,
            payload: data.payload
        });
	}

    /**
     * Broadcast a message to all of the connected peers.
     */
    broadcast(type, payload) {
		const data = { type, payload };
		this.transports.forEach(t => t.broadcast(data));
    }
}

class WrappedPeer {
	constructor(peer) {
		this.peer = peer;
	}

	send(type, payload) {
		this.peer.send({ type, payload });
	}

	inspect() {
		return this.peer.inspect();
	}
}

module.exports = function() {
    return new Network();
};
