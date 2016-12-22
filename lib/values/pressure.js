'use strict';

module.exports = require('./quantity')('pressure')
    .base('pa', {
        names: [ 'pa', 'Pa', 'pascal' ],
        prefix: true,
        exposePrefixes: [ 'hecto', 'kilo' ]
    })
    .add('atm', {
        names: [ 'atm', 'atmosphere' ],
        scale: 101235
    })
    .add('bar', {
        names: [ 'bar' ],
        scale: 100000
    })
    .add('psi', {
        names: [ 'psi', 'poundsPerSquareInch' ],
        scale: 6894.76
    })
    .add('torr', {
        names: [ 'torr' ],
        scale: 133.322
    })
    .build();
