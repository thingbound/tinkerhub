'use strict';

const Device = require('../device');
const State = require('./state');
const { boolean } = require('../lib/values');

/**
 * Power capability, for devices that support switching and monitoring the power
 * status of a device.
 */
module.exports = Device.capability(Device => class DeviceWithPower extends Device.with(State) {
	/**
	 * Get the API functions that this device makes available.
	 */
	static get availableAPI() {
		return [ 'power', 'turnOn', 'turnOff' ];
	}

	/**
	 * Get that this provides the power capability.
	 */
	static get capabilities() {
		return [ 'power' ];
	}

	constructor() {
		super();

        this.updateState('power', false);
	}

	/**
	 * Get or switch the power of the device.
	 *
	 * @param {boolean} power
	 *   optional power level to switch to
	 * @returns
	 *   boolean indicating the power level
	 */
    power(power=undefined) {
        if(typeof power !== 'undefined') {
            // Call changePower and then return the new power state
            return this.setPower(power);
		}

		return this.getState('power');
    }

	/**
	 * Turn this device on.
	 */
    turnOn() {
        return this.power(true);
    }

	/**
	 * Turn this device off.
	 */
    turnOff() {
        return this.power(false);
	}

	setPower(power) {
		if(typeof power === 'undefined') throw new Error('Power must be specified');
		power = boolean(power);

		return Promise.resolve(this.changePower(power))
			.then(() => this.getState('power'));
	}

	/**
	 * Update the state of power to the device. Implementations should call
	 * this whenever the power changes, either from an external event or when
	 * changePower is called.
	 *
	 * @param {boolean} power
	 */
    updatePower(power) {
        if(this.updateState('power', power)) {
			this.emitEvent('power', power);
		}
    }

	/**
	 * Change the current power state of the device. This method can return
	 * a Promise if the power switching is asynchronous.
	 *
	 * @param {boolean} power
	 */
    changePower(power) {
        throw new Error('changePower has not been implemented');
    }
});
