'use strict';

const Services = require('./lib/services');
const ServiceLayer = require('./lib/service-layer');

const limits = require('./lib/events/limits');
const time = require('./lib/utils/time');


const networkSymbol = Symbol('network');
const layerSymbol = Symbol('service-layer');
class Tinkerhub {
	constructor(network) {
		this[networkSymbol] = network;
		const services = new Services(network);
		this[layerSymbol] = new ServiceLayer(services, 'core');
	}

	get id() {
		return this[networkSymbol].id;
	}

	on(event, listener) {
		return this[layerSymbol].on(event, listener);
	}

	off(event, listener) {
		return this[layerSymbol].off(event, listener);
	}

	register(instance) {
		return this[layerSymbol].register(instance);
	}

	get() {
		return this[layerSymbol].get.apply(this[layerSymbol], arguments);
	}

	all() {
		return this[layerSymbol].all();
	}

	get time() {
		return time;
	}

	get limits() {
		return limits;
	}
}

module.exports = function(network) {
	return new Tinkerhub(network);
}
