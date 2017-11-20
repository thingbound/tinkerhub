'use strict';

const api = require('./api');
const net = require('./lib/net');

module.exports = api(net({
	endpoint: true
}));
