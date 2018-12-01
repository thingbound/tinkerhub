'use strict';

const API = require('./modifiable-api');
const net = require('./lib/net');

module.exports = new API(net({
	endpoint: true
}));
