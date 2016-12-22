'use strict';

const defs = [ 'light', 'sensor' ];

module.exports = function(types) {
    defs.forEach(def => require('./' + def)(types));
};
