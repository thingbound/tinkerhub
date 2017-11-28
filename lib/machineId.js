'use strict';

const api = require('abstract-things/storage/api');
const generateId = require('./utils/id');

let machineId;
/**
 * Get or generate a unique id for this machine (and user).
 */
module.exports = function() {
	if(machineId) return Promise.resolve(machineId);

	const storage = api.global();
	return storage.get('tinkerhub:id')
		.then(id => {
			if(id) return id;

			id = generateId();
			return storage.set('tinkerhub:id', id)
				.then(() => id);
		})
		.then(id => machineId = id);
};
