'use strict';

module.exports = require('./quantity')('mass')
    .base('g', {
        names: [ 'g', 'gram', 'grams', 'gramme', 'grammes' ],
        prefix: true
    })
    .add('kg', {
        names: [ 'kg', 'kilogram', 'kilograms' ],
        scale: 1000
    })
    .add('lbs', {
        names: [ 'lb', 'lbs', 'pound', 'pounds', '#' ],
        scale: 453.592
    })
    .add('oz', {
        names: [ 'oz', 'ounce', 'ounces' ],
        scale: 28.3495
    })
    .add('stone', {
        names: [ 'st', 'stone', 'stones' ],
        scale: 6350.29318
    })
    .build();
