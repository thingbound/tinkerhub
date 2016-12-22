'use strict';

module.exports = require('./quantity')('speed')
    .base('mps', {
        names: [ 'm/s', 'mps', 'metersPerSecond', 'metresPerSecond' ],
        prefix: true
    })
    .add('kmh', {
        names: [ 'km/h', 'kph', 'kilometersPerHour', 'kilometresPerHour' ],
        scale: 1000 / 3600
    })
    .add('mph', {
        names: [ 'mph', 'milesPerHour' ],
        scale: 0.44704
    })
    .add('fps', {
        names: [ 'ft/s', 'fps', 'footPerSecond' ],
        scale: 0.3048
    })
    .add('knot', {
        names: [ 'kt', 'knot' ],
        scale: 0.514444
    })
    .build();
