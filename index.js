'use strict';

const api = require('./api');
const net = require('./lib/net');

const machineId = require('./lib/machineId');

module.exports = api(net());

Object.defineProperty(module.exports, 'machineId', { value: machineId });
