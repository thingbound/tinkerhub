'use strict';

const os = require('os');
const machineId = require('./lib/machineId');
const { Thing } = require('abstract-things');

/**
 * Mixin that updates the identifier and hostname so that they reflect the
 * machine the service is running on.
 */
module.exports = Thing.type(Parent => class extends Parent {
	initCallback() {
		return super.initCallback()
			.then(machineId)
			.then(id => {
				if(! this.id) {
					throw new Error('id must be set to use machine details mixin');
				}

				this.id = this.id + ':' + id;
				if(this.metadata.name) {
					this.metadata.name = this.metadata.name + ' (at ' + os.hostname() + ')';
				}

				return this;
			});
	}
});
