var polo = require('polo')();

function toService(obj) {
    return {
        name: obj.name,
        host: obj.addresses[0],
        port: obj.port
    };
}

module.exports.browse = function(listener) {
    polo.on('up', function(name, service) {
        var match = name.match(/([a-z0-9]+)\.tinkerhub$/);
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
