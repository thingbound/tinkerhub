'use strict';

/*
 * Register shared capabilities that can applied to any device.
 */

module.exports = function(types) {
    // State capability - the ability to get the state of the device as an object
    types.registerDeviceCapability('state')
        .event('state', 'object', 'Emitted when the state changes')
        .action('state').returns('object', 'The current state').done()
        .done();

    // Power capability - the ability to turn on and off the device
    types.registerDeviceCapability('power')
        .requireCapability('state')
        .event('power', 'boolean', 'Device has either been turned on or off')
        .action('power')
            .argument('boolean', true, 'If the device should switch to on or off')
            .returns('boolean', 'If the device has power')
            .done()
        .action('setPower')
            .argument('boolean', 'On/off')
            .returns('boolean', 'The new power of the device')
            .done()
        .action('turnOn').returns('boolean', 'If the device has power').done()
        .action('turnOff').returns('boolean', 'If the device has power').done()
        .state('power', 'boolean', 'If power is on or off')
        .done();

    // Battery capability - the device can read its battery level
    types.registerDeviceCapability('battery-level')
        .event('batteryLevel', 'percentage', 'Battery level has changed')
        .action('batteryLevel')
            .returns('percentage', 'The current battery level as percentage')
            .done()
        .done();

}
