
var EventEmitter = require('../events').EventEmitter;
var debug = require('debug')('th.net');

var discovery = require('./discovery');
var emptyPort = require('empty-port');

var net = require('net');
var Message = require('amp-message');
var Parser = require('amp').Stream;

class Network {
    constructor() {
        this._events = new EventEmitter(this);

        this.id = Math.floor((1 + Math.random()) * 0x10000).toString(16) +
            Math.floor((1 + Math.random()) * 0x10000).toString(16);
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
        emptyPort({ startPort: 2000 }, (_, port) => {
        	if(! port) return;

            this.port = port;
            debug('Starting local server at ' + port);

            this.server = net.createServer(this._setupSocket.bind(this));

            this.server.listen(port);

        	this._stoppables.push(discovery.expose(port, this.id));
        });

        // Start discovering which peers we have
        this._stoppables.push(
            discovery.browse(this._handlePeerChange.bind(this))
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
            const msg = new Message(buf);
            this._handleIncomingMessage(socket, msg.args[0], msg.args[1], msg.args[2]);
        });
    }

    _peer(id) {
        if(this._peers[id]) return this._peers[id];

        const peer = new Peer(this, id);
        this._peers[id] = peer;
        peer.pinged();
        return peer;
    }

    /**
     * Handle changes to peers, either with a peer that has become available or
     * when one is no longer available.
     */
    _handlePeerChange(change) {
        const service = change.service;

        // Ignore changes to ourselves
        if(service.name === this.id && service.port === this.port) return;

        if(change.available) {
            // Connect with the new/updated peer
            debug('Connecting with peer ' + service.name + ' at ' + service.host + ':' + service.port);
            this._peer(service.name).setAddress(service.host, service.port);
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
        });

        clearInterval(this._ping);
        this._ping = setInterval(this.ping.bind(this), 1500);

        this.ping();

        // Emit a join event if this is the first time we see this peer
        this.parent._events.emit('peerConnected', this.id);
    }

    setAddress(host, port) {
        if(this.client) return;

        var client = net.connect({
            host: host,
            port: port
        });
        client.on('connect', () => {
            this.parent._setupSocket(client);
            this.ping();
        });

        this.setClient(client);
    }

    remove() {
        delete this.parent._peers[this.id];
        this.parent._events.emit('peerDisconnected', this.id);

        if(this.client) {
            this.client.destroy();
            this.client = null;
        }

        clearInterval(this._ping);
        clearTimeout(this._pingTimeout);
    }

    ping() {
        this.send('ping');
    }

    pinged() {
        clearTimeout(this._pingTimeout);
        this._pingTimeout = setTimeout(() => {
            this.debug('Expired due to missed ping, removing from peers');
            this.remove();
        }, 5000);
    }

    send(type, payload) {
        if(! this.client) {
            // TODO: What do we when our peer is not yet reachable?
            this.debug('This peer can\'t be reached');
            return;
        }

        var msg = new Message([ this.parent.id, type, payload ]);
        this.client.write(msg.toBuffer());
    }
}

module.exports = function() {
    return new Network();
};
