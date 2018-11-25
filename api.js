'use strict';


const Services = require('ataraxia-services');
const Things = require('./lib/things');

const matchers = require('./lib/things/matchers');

const errorHandler = require('./lib/utils/error-handler');

//const limits = require('./lib/events/limits');
//const time = require('./lib/utils/time');

module.exports = function(network) {
	const services = new Services(network);
	const things = new Things(services);

	const result = things.publicApi;
	Object.defineProperty(result, 'id', { value: network.id });
	Object.defineProperty(result, 'network', { value: network });

	Object.defineProperty(result, 'match', { value: matchers });

	Object.defineProperty(result, 'errorHandler', { value: errorHandler });

	//Object.defineProperty(result, 'time', { value: time });
	//Object.defineProperty(result, 'limits', { value: limits });
	return result;
};
