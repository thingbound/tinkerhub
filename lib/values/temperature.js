'use strict';

module.exports = require('./quantity')('temperature')
    .base('C', {
        names: [ 'C', 'c', 'celsius' ]
    })
    .add('K', {
        names: [ 'K', 'kelvin' ],
        prefix: true,
        toBase: function(value) {
            return value - 273.15;
        },
        fromBase: function(value) {
            return value + 273.15;
        }
    })
    .add('F', {
        names: [ 'F', 'f', 'fahrenheit' ],
        toBase: function(value) {
            return (value - 32) * (5/9);
        },
        fromBase: function(value) {
            return value * (9/5) + 32;
        }
    })
    .build();
