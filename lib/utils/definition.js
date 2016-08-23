'use strict';

module.exports = function(object) {
    const result = [];
    const mapped = {};

    const collector = key => {
        if(! mapped[key]) {
            mapped[key] = true;
            result.push(key);
        }
    };

    while(object) {
        Object.getOwnPropertyNames(object).forEach(collector);

        object = Object.getPrototypeOf(object);
    }

    return result;
};
