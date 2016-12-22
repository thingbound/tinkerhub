'use strict';

/*
 * Register types and capabilities related to sensors.
 */
module.exports = function(types) {
    types.registerDeviceType('sensor')
        .action('values').returns('object', 'Object with values of the sensor').done()
        .when('temperature')
            .event('sensor:temperature', 'temperature')
            .action('temperature').returns('temperature', 'Temperature in Celsius').done()
            .done()
        .when('illumninance')
            .event('sensor:illuminance', 'illuminance')
            .action('illuminance').returns('illuminance', 'Luminance in lux').done()
            .done()
        .when('relativeHumidity')
            .event('sensor:relativeHumidity', 'relativeHumidity')
            .action('relativeHumidity').returns('percentage', 'Relative humidity as percentage').done()
            .done()
        .when('ultraviolet')
            .event('sensor:ultraviolet', 'ultraviolet')
            .action('ultraviolet').returns('number', 'UV-index as number').done()
            .done()
        .when('weight')
            .event('sensor:weight', 'mass')
            .action('weight').returns('mass', 'Measured weight').done()
            .done()
        .done();
};
