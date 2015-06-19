var Proxy = require('node-proxy');

module.exports = function(device) {
    return Proxy.create({
        get: function(proxy, name) {
            if(typeof device[name] !== 'undefined') {
                return device[name];
            }

            return function() {
                return device.call(name, arguments);
            };
        }
    });
};
