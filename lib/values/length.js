'use strict';

module.exports = require('./quantity')('length')
    .base('m', {
        names: [ 'm', 'meter', 'meters', 'metre', 'metres' ],
        prefix: true,
        exposePrefixes: [ 'deci', 'milli', 'centi' ]
    })
    .add('in', {
        names: [ 'in', 'inch', 'inches' ],
        scale: 0.0254
    })
    .add('ft', {
        names: [ 'ft', 'foot', 'feet' ],
        scale: 0.3048
    })
    .add('yd', {
        names: [ 'yd', 'yard', 'yards' ],
        scale: 0.9144
    })
    .add('mi', {
        names: [ 'mi', 'mile', 'miles' ],
        scale: 1609.34
    })
    .build();
