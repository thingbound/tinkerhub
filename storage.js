'use strict';

const { Appliance } = require('appliances');
const storage = require('./lib/storage');

const storageSymbol = Symbol('storage');

module.exports = Appliance.capability(BaseDevice => class ApplianceWithStorage extends BaseDevice {
	get storage() {
		if(this[storageSymbol]) return this[storageSymbol];

		return this[storageSymbol] = storage.sub('appliance.' + this.id);
	}
});
