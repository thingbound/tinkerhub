/**
 * A set of timeout related utilities.
 */

'use strict';

const duration = require('amounts').duration;
const Q = require('q');

module.exports.in = function(delay) {
    delay = duration(delay);
    const deferred = Q.defer();
    setTimeout(function() {
        deferred.resolve();
    }, delay.ms);
    return deferred.promise;
};
