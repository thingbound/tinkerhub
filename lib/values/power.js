'use strict';

module.exports = require('./quantity')('power')
    .base('watt', {
        names: [ 'w', 'W', 'watt' ],
        prefix: true,
        exposePrefixes: [ 'kilo', 'mega' ]
    })
    .add('hp', {
        names: [ 'hp', 'horsepower' ],
        scale: 745.69987158227022
    })
    .build();
