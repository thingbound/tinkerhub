'use strict';

module.exports = require('./quantity')('illuminance')
    .base('lux', {
        names: [ 'lux' ]
    })
    .build();
