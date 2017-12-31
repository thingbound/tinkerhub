'use strict';

const update = Symbol('update');
const reset = Symbol('reset');
const parent = Symbol('parent');
module.exports = class Metadata {
	constructor(p, isCollection) {
		this[parent] = p;

		this.collection = true;

		this[reset]();
	}

	/**
	 * Mark this instance with a set of tags.
	 *
	 * @param {string[]} tags
	 */
	addTags(...tags) {
		const instances = this[parent].toArray();
		return Promise.all(instances.map(i =>
			i.metadata.addTags(...tags)
		));
	}

	/**
	 * Remove some tags from this instance.
	 *
	 * @param {string[]} tags
	 */
	removeTags(...tags) {
		const instances = this[parent].toArray();
		return Promise.all(instances.map(i =>
			i.metadata.removeTags(...tags)
		));
	}

	[reset]() {
		this.actions = {};
		this.events = {};
		this.state = {};
	}

	[update](services) {
		this[reset]();

		// First pass is to collect everything
		for(const service of services) {
			this.actions = shallowMerge(this.actions, service.metadata.actions);
			this.events = shallowMerge(this.events, service.metadata.events);
			this.state = shallowMerge(this.state, service.metadata.state);
		}

		// Second pass removes everything that is not present for all things
		for(const service of services) {
			this.actions = keepOnlyPresent(this.actions, service.metadata.actions);
			this.events = keepOnlyPresent(this.events, service.metadata.events);
			this.state = keepOnlyPresent(this.state, service.metadata.state);
		}
	}
};

module.exports.update = update;

function keepOnlyPresent(a, b) {
	for(const item of Object.keys(a)) {
		if(typeof b[item] === 'undefined') {
			delete a[item];
		}
	}

	return a;
}

function shallowMerge(a, b) {
	for(const item of Object.keys(b)) {
		if(typeof a[item] === 'undefined') {
			a[item] = b[item];
		}
	}
	return a;
}
