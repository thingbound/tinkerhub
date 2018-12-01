'use strict';

const API = require('./api');
const ModifiableRepository = require('./lib/things/modifiable-repository');

const machineId = require('./lib/machineId');

module.exports = class Tinkerhub extends API {

	static get Repository() {
		return ModifiableRepository;
	}

	register(instance) {
		return this[API.repository].register(instance);
	}

	registerDiscovery(discovery) {
		return this[API.repository].registerDiscovery(discovery);
	}

	get machineId() {
		return machineId;
	}
};
