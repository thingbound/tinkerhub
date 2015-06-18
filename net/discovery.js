var mdns = require('mdns');

function toService(obj) {
    return {
        name: obj.name,
        host: obj.addresses[0],
        port: obj.port
    };
}

module.exports.browse = function(listener) {
    var browser = mdns.createBrowser(mdns.udp('_tinkerhub'));
    browser.on('serviceUp', function(service) {
        if(! service.addresses) return;

        listener({
            available: true,
            service: toService(service)
        });
    });
    browser.on('serviceDown', function(service) {
        if(! service.addresses) return;

        listener({
            available: false,
            service: toService(service)
        });
    });
    browser.start();

    return {
        stop: function() {
            browser.stop();
        }
    };
};

module.exports.expose = function(port, name) {
	var ad = mdns.createAdvertisement(mdns.udp('tinkerhub'), port, {
        name: name
    });
	ad.start();

	return {
        stop: function() {
            ad.stop();
        }
    };
};
