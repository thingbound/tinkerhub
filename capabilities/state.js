'use strict';

const Device = require('../device');
const deepEqual = require('deep-equal');

/**
 * State capability for devices. Exposes a property named `state` to clients.
 *
 * Use `updateState(key, value)` to change the state of the given key and emit
 * an event to clients that the state has changed.
 */
module.exports = Device.capability(Device => class DeviceWithState extends Device {
	/**
	 * Get the API that devices with state make available.
	 */
	static get availableAPI() {
		return [ 'state' ];
	}

	/**
	 * Get that this provides the state capability.
	 */
	static get capabilities() {
		return [ 'state' ];
	}

	constructor() {
		super();

		this.state = {};
	}

	/**
	 * Update the state of this device by setting the value for a certain property.
	 *
	 * @param {string} key
	 * @param {*} value
	 */
	updateState(key, value) {
		if(deepEqual(this.state[key], value)) {
			// If the value has not changed, skip updating and emitting event
			return false;
		} else {
			// Value has changed, update and queue event emittal
			this.state[key] = value;
			this.emitEvent('state', this.state);

			return true;
		}
	}

	/**
	 * Update the state of this device by removing a certain property.
	 *
	 * @param {string} key
	 */
	removeState(key) {
		delete this.state[key];
	}

	/**
	 * Get the value of the given state property.
	 *
	 * @param {string} key
	 * @param {*} defaultValue
	 */
	getState(key, defaultValue=null) {
		const value = this.state[key];
		return typeof value === 'undefined' ? defaultValue : value;
	}
});
