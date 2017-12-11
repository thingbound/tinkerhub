'use strict';

const CallResolver = require('./lib/things/call-resolver');
const values = require('abstract-things/values');

module.exports = {
	/**
	 * Capture the state of things in this collection returning an object
	 * that can serialized to JSON.
	 */
	captureState(collection) {
		return collection.captureState()
			.then(result => {
				const data = {};
				for(const item of result) {
					if(item.isFulfilled) {
						const json = values.toJSON('mixed', item.value);
						data[item.thing.id] = json;
					}
				}
				return data;
			});
	},

	/**
	 * Restore a state previously captured with captureState.
	 */
	restoreState(collection, data) {
		const instances = [];
		const promises = [];
		for(const thing of collection) {
			const state = data[thing.id];
			if(state) {
				instances.push(thing);
				promises.push(thing.setState(state));
			}
		}

		return new CallResolver(instances, promises);
	}
};
