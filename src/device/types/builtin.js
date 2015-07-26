module.exports = function(types) {
    /* Shared capabilities */

    // State capability - the ability to get the state of the device as an object
    types.registerDeviceCapability('state')
        .action('state').returns('object', 'The current state').done()
        .done();

    // Power capability - the ability to turn on and off the device
    types.registerDeviceCapability('power')
        .requireCapability('state')
        .action('turnOn').returns('object', 'The new state').done()
        .action('turnOff').returns('object', 'Thew new state').done()
        .done();
};
