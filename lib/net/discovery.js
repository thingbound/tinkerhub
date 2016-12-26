'use strict';

/**
 * Discovery of peers running on the network.
 */
const bonjour = require('bonjour')();

module.exports.browse = function(query, listener) {
    const browser = bonjour.find(query);
    const update = setInterval(() => {
        browser.update();

        const timeout = Date.now() - 60000;
        Object.keys(services).forEach(key => {
            const service = services[key];
            if(service.lastSeen < timeout) {
                delete services[service.fqdn];
                listener('down', service);
            }
        });
    }, 20000);

    const services = {};

    browser._addService = function(service) {
        const added = ! services[service.fqdn];

        services[service.fqdn] = service;
        service.lastSeen = Date.now();

        if(added) {
            listener('up', service);
        }
    };

    browser._removeService = function(name) {
        const service = services[name];
        if(! service) return;

        delete services[name];
        listener('down', service);
    };

    return {
        stop() {
            browser.stop();
            clearTimeout(update);
        }
    };
};

module.exports.expose = function(port, name) {
    bonjour.publish({
        name: name,
        type: 'tinkerhub',
        port: port
    });
};
