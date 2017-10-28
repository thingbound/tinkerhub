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

		this.nodes = new Map();
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
			const node = new Node(this, peer.id);
			node.addReachability(peer, []);

			peer.on('message', msg => this._handleMessage(peer, msg));
			peer.on('disconnected', () => this._peerDisconnected(peer, node));

			this._peerConnected(peer, node);
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

	_peerConnected(peer, node) {
		debug('Connected to', peer);

		// Store reference to this peer
		this.nodes.set(node.id, node);

		// Broadcast all of our peers
		this._broadcastRouting();

		// Emit an event to indicate that we are now connected
		this.events.emit('node:connected', node);
	}

	_peerDisconnected(peer, wrapped) {
		debug('Disconnected from', peer);

		// Remove the peer
		this._handlePeerRemoval(peer);

		// Queue a broadcast of our updated peer info
		this._broadcastRouting();
	}

	_handlePeerRemoval(peer, node) {
		// Update all of the peers and remove this one
		for(const other of this.nodes.values()) {
			other.removeReachability(peer);
			if(! other.reachable) {
				debug('Can no longer reach', other);

				this.nodes.delete(other.id);
				this.events.emit('node:disconnected', other);
			}
		}
	}

	_handleMessage(peer, data) {
		const source = data[0];
		const target = data[1];
		const message = data[2];
		debug(peer, 'sent message', source, '->', target, 'with data', message);

		const targetNode = this.nodes.get(target);
		const sourceNode = this.nodes.get(source);

		if(target !== this.id) {
			// This message should be routed to another node, resolve and forward
			if(targetNode && targetNode.reachable) {
				targetNode.forward(source, message);
			}
		} else {
			// TODO: We need to have information about the peer that initiated a message
			switch(message.type) {
				case 'routing':
					this._handleRouting(peer, message.payload);
					break;
				default:
					// Emit event for all other messages
					this.events.emit('message', {
						returnPath: sourceNode,
						type: message.type,
						payload: message.payload
					});
					break;
			}
		}
	}

	_routingMessage() {
		const peers = [];
		for(const p of this.nodes.values()) {
			peers.push({
				id: p.id,
				path: p.path
			});
		}
		return peers;
	}

	/**
	 * Queue up a broadcast to directly connected peers about all of the
	 * peers we can see.
	 */
	_broadcastRouting() {
		if(this._peerTimeout) {
			return;
		}

		this._peerTimeout = setTimeout(() => {
			this._peerTimeout = null;

			this.limitedBroadcast('routing', this._routingMessage());
		}, 500);
	}

	_handleNodeAvailable(peer, data) {
		if(data.id === this.id) return false;

		// Get or create the node
		let node = this.nodes.get(data.id);
		if(! node) {
			node = new Node(this, data.id);
			this.nodes.set(data.id, node);
		}

		// Update the reachability of the node
		let emitEvent = ! node.reachable;
		if(node.addReachability(peer, [ peer.id, ...data.path ])) {
			if(emitEvent && node.reachable) {
				debug('Can now reach', node.id, 'via', peer);
				this.events.emit('node:connected', node);
			}

			return true;
		}

		return false;
	}

	/**
	 * Handle routing information from a given peer.
	 */
	_handleRouting(peer, data) {
		const available = new Set();
		// Add the current peer to available items so that is not removed later
		available.add(peer.id);

		let changed = false;

		// Expose all of the peers that can be seen by the other node
		for(const p of data) {
			changed |= this._handleNodeAvailable(peer, p);
			available.add(p.id);
		}

		// Go through the peers and remove the peer from others
		for(const other of this.nodes.values()) {
			if(! available.has(other.id)) {
				if(other.removeReachability(peer)) {
					changed = true;

					if(! other.reachable) {
						debug('Can no longer reach', other);

						this.nodes.delete(other.id);
						this.events.emit('node:disconnected', other);
					}
				}
			}
		}

		if(changed) {
			this._broadcastRouting();
		}
	}

	/**
	 * Broadcast a message to only direcly connected peers.
	 */
	limitedBroadcast(type, payload) {
		for(const node of this.nodes.values()) {
			if(node.direct) {
				node.send(type, payload);
			}
		}
	}

    /**
     * Broadcast a message to all of peers we know about.
     */
    broadcast(type, payload) {
		for(const node of this.nodes.values()) {
			node.send(type, payload);
		}
    }
}

function reachabilityComparator(a, b) {
	return a.path.length - b.path.length;
}

class Node {
	constructor(network, id) {
		this.network = network;
		this.id = id;

		this.reachability = [];
	}

	forward(source, message) {
		this.peer.send([ source, this.id, message ]);
	}

	send(type, payload) {
		this.peer.send([ this.network.id, this.id, { type, payload } ]);
	}

	/**
	 * Get the number of nodes
	 */
	get distance() {
		if(this.reachability.length === 0) return 20000;

		return this.reachability[0].path.length;
	}

	get path() {
		return this.reachability.length > 0 ? this.reachability[0].path : [];
	}

	get reachable() {
		return this.reachability.length > 0;
	}

	addReachability(peer, path) {
		const idx = this.reachability.findIndex(d => d.peer == peer);
		if(idx >= 0) return false;

		if(path.indexOf(this.id) >= 0 || path.indexOf(this.network.id) >= 0) {
			// This peer is either reached via itself or via this node, skip this routing
			return false;
		}

		this.reachability.push({
			peer,
			path
		});

		this.reachability.sort(reachabilityComparator);

		this.updateReachability();
		return true;
	}

	removeReachability(peer) {
		const idx = this.reachability.findIndex(d => d.peer == peer);
		console.log(this, 'checked for', peer, 'found', idx);
		if(idx < 0) return false;

		this.reachability.splice(idx, 1);
		this.reachability.sort(reachabilityComparator);

		console.log(this.reachability);
		this.updateReachability();

		return true;
	}

	updateReachability() {
		if(this.reachable) {
			this.peer = this.reachability[0].peer;
			this.direct = this.reachability[0].path.length === 0;
		} else {
			this.peer = null;
			this.direct = false;
		}
	}

	inspect() {
		if(this.direct) {
			return this.peer.inspect();
		}

		return 'Peer[' + this.id + ' via ' + (this.peer ? this.peer.inspect() : '???') + ' (' + this.reachability.length + ' available)]';
	}
}

module.exports = function() {
    return new Network();
};
