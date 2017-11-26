'use strict';

const Services = require('ataraxia-services');
const ServiceLayer = require('./lib/service-layer');

const limits = require('./lib/events/limits');
const time = require('./lib/utils/time');

module.exports = function(network) {
	const services = new Services(network);
	const layer = new ServiceLayer(services, 'core');

	const result = layer.publicApi;
	Object.defineProperty(result, 'id', { value: network.id });
	Object.defineProperty(result, 'time', { value: time });
	Object.defineProperty(result, 'limits', { value: limits });
	return result;
}
