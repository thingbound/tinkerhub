
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var debug = require('debug')('th.net');

var discovery = require('./discovery');
var emptyPort = require('empty-port');

var net = require('net');
var Message = require('amp-message');
var Parser = require('amp').Stream;

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

        self.server = net.createServer(function(socket) {
            var parser = new Parser();
            socket.pipe(parser);

            parser.on('data', function(buf) {
                var msg = new Message(buf);
                self._handleIncomingMessage(msg.args[0], msg.args[1], msg.args[2]);
            });
        });

        self.server.listen(port);

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
        self._peers[peerId].send(type, payload);
    });
};

Network.prototype.send = function(peer, type, payload) {
    this._peer(peer).send(type, payload);
};

function Peer(parent, id) {
    this.parent = parent;
    this.id = id;
    this.debug = require('debug')('th.net.peer:' + id);
}

Peer.prototype.setAddress = function(host, port) {
    if(this.client) return;

    this.client = net.connect({
        host: host,
        port: port
    });

    this.client.on('error', function(err) {
        this.debug('Error occurred during connection', err);
        this.remove();
    }.bind(this));

    clearInterval(this._ping);
    this._ping = setInterval(this.ping.bind(this), 1500);

    this.ping();

    // Emit a join event if this is the first time we see this peer
    this.parent.emit('peerConnected', this.id);
};

Peer.prototype.remove = function() {
    delete this.parent._peers[this.id];
    this.parent.emit('peerDisconnected', this.id);

    this.client.destroy();
    this.client = null;
};

Peer.prototype.ping = function() {
    this.send('ping');
};

Peer.prototype.pinged = function() {
    var self = this;
    clearTimeout(this._pingTimeout);
    this._pingTimeout = setTimeout(function() {
        self.debug('Expired due to missed ping, removing from peers');
        delete self.parent._peers[self.id];
        self.parent.emit('peerDisconnected', self.id);
    }, 5000);
};

Peer.prototype.send = function(type, payload) {
    if(! this.client) {
        // TODO: What do we when our peer is not yet reachable?
        return;
    }

    var msg = new Message([ this.parent.id, type, payload ]);
    this.client.write(msg.toBuffer());
};

module.exports = function() {
    return new Network();
};
