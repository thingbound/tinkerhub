'use strict';

const merge = require('appliances/utils/merge');

const update = Symbol('update');
const reset = Symbol('reset');
module.exports = class Metadata {
	constructor(id) {
		this.id = id;

		this[reset]();
	}

	/**
	 * Get if the appliance is of the given type.
	 *
	 * @param {string} type
	 */
	hasType(type) {
		return this.types.has(type);
	}

	/**
	 * Get if the appliance has the given capability.
	 *
	 * @param {string} cap
	 */
	hasCapability(cap) {
		return this.capabilities.has(cap);
	}

	/**
	 * Check if this metadata contains all of the given tags.
	 *
	 * @param {string} tags
	 */
	hasTags(...tags) {
		for(const t of tags) {
			if(! this.tags.has(t)) return false;
		}
		return true;
	}

	/**
	 * Alias for `hasTags`.
	 *
	 * @param {string} tags
	 */
	is(...tags) {
		return this.hasTags(...tags);
	}

	[reset]() {
		this.tags = new Set();
		this.types = new Set();
		this.capabilities = new Set();

		this.actions = {};
		this.state = {};
	}

	[update](services) {
		this[reset]();

		for(const service of services) {
			this.tags = merge(this.tags, service.metadata.tags);
			this.types = merge(this.types, service.metadata.types);
			this.capabilities = merge(this.capabilities, service.metadata.capabilities);
			this.actions = merge(this.actions, service.metadata.actions);
		}
	}
};

module.exports.update = update;
