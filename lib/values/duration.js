'use strict';

module.exports = require('./quantity')('duration')
    .multiple()
    .base('ms', {
        names: [ 'ms', 'millisecond', 'milliseconds' ],
    })
    .add('s', {
        names: [ 's', 'second', 'seconds' ],
        scale: 1000
    })
    .add('m', {
        names: [ 'm', 'minute', 'minutes' ],
        scale: 60000
    })
    .add('h', {
        names: [ 'h', 'hour', 'hours' ],
        scale: 60000 * 60
    })
    .add('d', {
        names: [ 'd', 'day', 'days' ],
        scale: 60000 * 60 * 24
    })
    .build();
