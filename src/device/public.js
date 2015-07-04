var NProxy = require('node-proxy');

/**
 * Create the public API for the given device.
 */
module.exports = function(device) {
    return NProxy.create({
        get: function(proxy, name) {
            if(name[0] === '_' || name === 'inspect') {
                return undefined;
            } else if(typeof device[name] !== 'undefined') {
                var v = device[name];
                if(typeof v === 'function') {
                    return v.bind(device);
                }
                return v;
            }

            return () => device.call(name, Array.prototype.slice.call(arguments));
        }
    });
};
