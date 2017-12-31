'use strict';

const isDeepEqual = require('deep-equal');
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
	},

	undoableStateChange(collection, func) {
		const captureState = module.exports.captureState;
		let originalState;
		return captureState(collection)
			.then(state => {
				originalState = state;
				return func();
			})
			.then(() => captureState(collection))
			.then(changedState => {
				return new Undoable(collection, originalState, changedState);
			});
	}
};


class Undoable {
	constructor(collection, originalState, changedState) {
		this.collection = collection;

		const result = {};
		for(const thing of Object.keys(changedState)) {
			const original = originalState[thing];
			if(! original) continue;

			const changed = changedState[thing];
			const thingState = {};
			for(const key of Object.keys(original)) {
				const oldValue = original[key];
				const newValue = changed[key];
				if(! isDeepEqual(oldValue, newValue)) {
					thingState[key] = oldValue;
				}
			}
			result[thing] = thingState;
		}

		this.state = result;
	}

	undo() {
		return module.exports.restoreState(this.collection, this.state);
	}
}
