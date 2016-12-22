'use strict';

module.exports = require('./quantity')('volume')
    .base('liter', {
        names: [ 'l', 'L', 'liter', 'liters', 'litre', 'litres' ],
        prefix: true,
        exposePrefixes: [ 'deci', 'milli', 'centi' ]
    })
    .add('gallon', {
        names: [ 'gal', 'gallon', 'gallons' ],
        scale: 3.78541
    })
    .add('quart', {
        names: [ 'qt', 'quart', 'quarts' ],
        scale: 0.946353
    })
    .add('pint', {
        names: [ 'pt', 'pint', 'pints' ],
        scale: 0.373176
    })
    .add('cup', {
        names: [ 'cu', 'cup', 'cups' ],
        scale: 0.236588
    })
    .add('fluidOunce', {
        names: [ 'floz', 'oz', 'fluid-ounce', 'ounze', 'fluid-ounces', 'ounzes' ],
        scale: 0.0295735
    })
    .add('tablespoon', {
        names: [ 'tb', 'tbsp', 'tbs', 'tablesppon', 'tablespoons' ],
        scale: 0.0147868
    })
    .add('teaspoon', {
        names: [ 'tsp', 'teaspoon', 'teaspoons' ],
        scale: 0.00492892
    })
    .build();
