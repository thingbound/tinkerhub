'use strict';

var EventEmitter = require('../events').EventEmitter;
var debug = require('debug')('th.net');

var discovery = require('./discovery');

var id = require('../utils/id');
var net = require('net');
var amp = require('amp');
var Parser = amp.Stream;

class Network {
    constructor() {
        this._events = new EventEmitter(this);

        this.id = id();
        this._stoppables = [];

        this._peers = {};

        this.on = this._events.on.bind(this._events);
        this.off = this._events.off.bind(this._events);
    }

    /**
     * Join the network by starting a server and then looking for peers.
     */
    join() {
        debug('About to join network as ' + this.id);

        // Figure out a free port and start our server
        debug('Starting local server');

        this.server = net.createServer(this._setupSocket.bind(this));

        this.server.listen(() => {
            this.port = this.server.address().port;
            this._stoppables.push(discovery.expose(this.port, this.id));
        });

        // Start discovering which peers we have
        this._stoppables.push(
            discovery.browse({ type: 'tinkerhub' }, this._handlePeerChange.bind(this))
        );
    }

    /**
     * Leave the currently joined network.
     */
    leave() {
        this._stoppables.forEach(item => item.stop());
    }

    _setupSocket(socket) {
        const parser = new Parser();
        socket.pipe(parser);

        parser.on('data', buf => {
            const args = amp.decode(buf);
            this._handleIncomingMessage(
                socket,
                args[0].toString(),
                args[1].toString(),
                args[2] ? JSON.parse(args[2]) : null
            );
        });
    }

    _peer(id) {
        if(this._peers[id]) return this._peers[id];

        debug('Defining peer ' + id);
        const peer = new Peer(this, id);
        this._peers[id] = peer;
        peer.pinged();
        return peer;
    }

    /**
     * Handle changes to peers, either with a peer that has become available or
     * when one is no longer available.
     */
    _handlePeerChange(type, service) {
        // Ignore changes to ourselves
        if(service.name === this.id && service.port === this.port) return;

        if(type === 'up') {
            // Connect with the new/updated peer
            debug('Connecting with peer ' + service.name + ' at ' + service.host + ':' + service.port);
            this._peer(service.name).setAddresses(service.addresses, service.port);
        } else {
            debug('Peer ' + service.name + ' at ' + service.host + ' is no longer available');
            this._peer(service.name).remove();
            delete this._peers[service.name];
        }
    }

    _handleIncomingMessage(socket, peerId, type, payload) {
        // Fetch the peer this message was from
        const peer = this._peer(peerId);
        if(! peer.client) {
            // Connect with the peer
            peer.setClient(socket);
        }

        // Reset the ping
        peer.pinged();

        // Return if this was a simple ping
        if(type === 'ping') return;

        debug('Incoming message for ' + peerId + ' of type ' + type, payload);
        this._events.emit('message', {
            peer: peer.id,
            type: type,
            payload: payload
        });
    }

    /**
     * Broadcast a message to all of the connected peers.
     */
    broadcast(type, payload) {
        var self = this;
        Object.keys(this._peers).forEach(function(peerId) {
            self._peers[peerId].send(type, payload);
        });
    }

    /**
     * Send a message to a specific peer.
     */
    send(peer, type, payload) {
        this._peer(peer).send(type, payload);
    }
}

class Peer {
    constructor(parent, id) {
        this.parent = parent;
        this.id = id;
        this.debug = require('debug')('th.net.peer:' + id);
    }

    setClient(client) {
        if(this.client) return;

        this.debug('Peer is now reachable');

        this.client = client;

        client.on('error', err => {
            this.debug('Error occurred during connection', err);
            this.remove();
            this.connect();
        });

        clearInterval(this._ping);
        this._ping = setInterval(this.ping.bind(this), 1500);

        this.pinged();
        this.ping();

        // Emit a join event if this is the first time we see this peer
        this.parent._events.emit('peerConnected', this.id);
    }

    setAddresses(addresses, port) {
        this.addresses = addresses;
        this.port = port;
        this.addressAttempt = 0;

        this.connect();
    }

    connect() {
        if(this.client || ! this.addresses) return;

        const address = this.addresses[this.addressAttempt];
        this.debug('Connecting to ' + address + ':' + this.port);

        const client = net.connect({
            host: address,
            port: this.port
        });
        client.on('connect', () => {
            this.setClient(client);

            this.parent._setupSocket(client);

            this.debug('Connected via ' + address + ':' + this.port);

            this.pinged();
            this.ping();
        });
        client.on('error', () => {
            this.debug('Failed to connect via ' + address + ':' + this.port);

            this.addressAttempt++;
            if(this.addressAttempt < this.addresses.length) {
                this.connect();
            } else {
                this.debug('No more addresses to try, trying in 60 seconds');
                this.addressAttempt = 0;
                this._connectTimeout = setTimeout(() => this.connect(), 60000);
            }
        });
    }

    remove() {
        this.parent._events.emit('peerDisconnected', this.id);

        if(this.client) {
            this.client.destroy();
            this.client = null;
        }

        clearInterval(this._ping);
        clearTimeout(this._pingTimeout);
        clearTimeout(this._connectTimeout);
    }

    ping() {
        this.send('ping');
    }

    pinged() {
        clearTimeout(this._pingTimeout);
        this._pingTimeout = setTimeout(() => {
            this.debug('Expired due to missed ping, removing from peers');
            this.remove();
            this.connect();
        }, 5000);
    }

    send(type, payload) {
        if(! this.client) {
            // TODO: What do we when our peer is not yet reachable?
            this.debug('This peer can\'t be reached');
            return;
        }

        const args = [
            Buffer.from(this.parent.id),
            Buffer.from(type)
        ];

        if(payload) {
            args.push(Buffer.from(JSON.stringify(payload)));
        }

        const encoded = amp.encode(args);
        this.client.write(encoded);
    }
}

module.exports = function() {
    return new Network();
};
