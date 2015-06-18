
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var debug = require('debug')('th:net');

var discovery = require('./discovery');
var punt = require('punt');
var emptyPort = require('empty-port');

function Network() {
    EventEmitter.call(this);

    this.id = Math.floor((1 + Math.random()) * 0x10000).toString(16) +
        Math.floor((1 + Math.random()) * 0x10000).toString(16);
    this._stoppables = [];

    this._peers = {};
}

util.inherits(Network, EventEmitter);

/**
 * Join the network by starting a server and then looking for peers.
 */
Network.prototype.join = function() {
    debug('About to join network as ' + this.id);

    // Figure out a free port and start our server
    var self = this;
    emptyPort({ startPort: 2000 }, function(_, port) {
    	if(! port) return;

        self.port = port;
        debug('Starting local server at ' + port);

    	self.server = punt.bind('0.0.0.0:' + port);
        self.server.on('message', function(peer, type, message) {
            // TODO: Do we need something from this.info?
            self._handleIncomingMessage(peer, type, message);
        });

    	self._stoppables.push(discovery.expose(port, self.id));
    });

    // Start discovering which peers we have
    this._stoppables.push(
        discovery.browse(this._handlePeerChange.bind(this))
    );
};

/**
 * Leave the currently joined network.
 */
Network.prototype.leave = function() {
    this._stoppables.forEach(function(item) {
        item.stop();
    });
};

Network.prototype._peer = function(id) {
    if(this._peers[id]) return this._peers[id];

    var peer = new Peer(this, id);
    this._peers[id] = peer;
    peer.pinged();
    return peer;
};

/**
 * Handle changes to peers, either with a peer that has become available or
 * when one is no longer available.
 */
Network.prototype._handlePeerChange = function(change) {
    var service = change.service;

    // Ignore changes to ourselves
    if(service.name === this.id && service.port == this.port) return;

    if(change.available) {
        // Connect with the new/updated peer
        debug('Connecting with peer ' + service.name + ' at ' + service.host + ':' + service.port);
        this._peer(service.name).setAddress(service.host, service.port);
    }
};

Network.prototype._handleIncomingMessage = function(peerId, type, payload) {
    // Fetch the peer this message was from
    var peer = this._peer(peerId);

    // Reset the ping
    peer.pinged();

    // Return if this was a simple ping
    if(type === 'ping') return;

    this.emit('message', {
        peer: peerId,
        type: type,
        payload: payload
    });
};

/**
 * Broadcast a message to all of the connected peers.
 */
Network.prototype.broadcast = function(type, payload) {
    var self = this;
    Object.keys(this._peers).forEach(function(peerId) {
        this._peers[peerId].send(type, payload);
    });
};

Network.prototype.send = function(peer, type, payload) {
    this._peer(id).send(type, payload);
};

function Peer(parent, id) {
    this.parent = parent;
    this.id = id;
    this.debug = require('debug')('th:net:peer:' + id);
}

Peer.prototype.setAddress = function(host, port) {
    var hadClient = !!this.client;
    this.client = punt.connect(host + ':' + port);

    clearInterval(this._ping);
    this._ping = setInterval(this.ping.bind(this), 2500);

    this.ping();

    if(! hadClient) {
        // Emit a join event if this is the first time we see this peer
        this.parent.emit('peerJoined', this.id);
    }
};

Peer.prototype.ping = function() {
    this.send('ping');
};

Peer.prototype.pinged = function() {
    this.debug('Resetting ping timeout');

    var self = this;
    clearTimeout(this._pingTimeout);
    this._pingTimeout = setTimeout(function() {
        self.debug('Expired due to missed ping, removing from peers');
        delete self.parent._peers[self.id];
        self.parent.emit('peerLeft', self.id);
    }, 10000);
};

Peer.prototype.send = function(type, payload) {
    this.client.send(this.parent.id, type, payload);
};

module.exports = function() {
    return new Network();
};
