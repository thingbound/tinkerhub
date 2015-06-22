var Proxy = require('node-proxy');

module.exports = function(device) {
    return Proxy.create({
        get: function(proxy, name) {
            if(typeof device[name] !== 'undefined') {
                return device[name];
            } else if(name === 'inspect') {
                return undefined;
            }

            return function() {
                return device.call(name, Array.prototype.slice.call(arguments));
            };
        }
    });
};
