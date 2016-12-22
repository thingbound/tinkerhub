'use strict';

module.exports = require('./quantity')('volume')
    .base('deg', {
        names: [ 'deg', 'degree', 'degrees' ],
    })
    .add('rad', {
        names: [ 'rad', 'radian', 'radians' ],
        scale: 360 / (2 * Math.PI)
    })
    .build();
