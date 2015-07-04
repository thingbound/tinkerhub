/**
 * Discovery of peers running on the network.
 */
const polo = require('polo')();

module.exports.browse = function(listener) {
    polo.on('up', function(name, service) {
        const match = name.match(/([a-z0-9]+)\.tinkerhub$/);
        if(! match) return;

        listener({
            available: true,
            service: {
                name: match[1],
                address: service.address,
                host: service.host,
                port: service.port
            }
        });
    });
};

module.exports.expose = function(port, name) {
    polo.put({
        name: name + '.tinkerhub',
        port: port
    });
};
