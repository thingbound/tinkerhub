'use strict';

const Device = require('./device');
const storage = require('./lib/storage');

const storageSymbol = Symbol('storage');

module.exports = Device.capability(BaseDevice => class DeviceWithStorage extends BaseDevice {
	get storage() {
		if(this[storageSymbol]) return this[storageSymbol];

		return this[storageSymbol] = storage.sub('device.' + this.id);
	}
});
