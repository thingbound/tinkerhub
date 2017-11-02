'use strict';

const api = require('./api');
const Network = require('./lib/net');

const network = new Network();
network.join();

module.exports = api(network);
