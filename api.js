'use strict';

const Services = require('ataraxia-services');
const Repository = require('./lib/things/repository');

const matchers = require('./lib/things/matchers');
const errorHandler = require('./lib/utils/error-handler');

const network = Symbol('network');
const services = Symbol('services');
const repository = Symbol('repository');

/**
 * Public API for Tinkerhub that provides access to the distributed thing
 * network without support for registering new things.
 */
module.exports = class API {
	constructor(net) {
		Object.defineProperty(this, network, { value: net });
		Object.defineProperty(this, services, { value: new Services(net) });

		const R = this.constructor.Repository || Repository;
		Object.defineProperty(this, repository, { value: new R(this[services], this) });
	}

	/**
	 * Get the ephemeral identifier of this instance. This is the id generated
	 * for this client to the distributed network.
	 *
	 * @returns {string}
	 */
	get id() {
		return this[network].id;
	}

	get match() {
		return matchers;
	}

	get errorHandler() {
		return errorHandler;
	}

	on(event, listener) {
		return this[repository].on(event, listener);
	}

	off(event, listener) {
		return this[repository].off(event, listener);
	}

	[Symbol.iterator]() {
		return this[repository][Symbol.iterator]();
	}

	get(...tags) {
		return this[repository].get(...tags);
	}

	all() {
		return this[repository].all();
	}
};

// Export the repository symbol
module.exports.repository = repository;
