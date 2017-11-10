'use strict';

const merge = require('appliances/utils/merge');

const update = Symbol('update');
const reset = Symbol('reset');
const parent = Symbol('parent');
module.exports = class Metadata {
	constructor(p) {
		this[parent] = p;
		this.id = p.id;

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
	 * Check if the given tag is present.
	 *
	 * @param {string} tag
	 */
	hasTag(tag) {
		return this.tags.has(tag);
	}

	/**
	 * Alias for `hasTags`.
	 *
	 * @param {string} tags
	 */
	is(...tags) {
		return this.hasTags(...tags);
	}

	/**
	 * Mark this instance with a set of tags.
	 *
	 * @param {string[]} tags
	 */
	addTags(...tags) {
		return this[parent].callAll('metadata:addTags', tags);
	}

	/**
	 * Remove some tags from this instance.
	 *
	 * @param {string[]} tags
	 */
	removeTags(...tags) {
		return this[parent].callAll('metadata:removeTags', tags);
	}

	[reset]() {
		this.tags = new Set();
		this.types = new Set();
		this.capabilities = new Set();

		this.name = null;

		this.actions = {};
		this.state = {};
	}

	[update](services) {
		this[reset]();

		for(const service of services) {
			if(! this.name) {
				this.name = service.metadata.name || null;
			}
			this.tags = merge(this.tags, service.metadata.tags);
			this.types = merge(this.types, service.metadata.types);
			this.capabilities = merge(this.capabilities, service.metadata.capabilities);
			this.actions = merge(this.actions, service.metadata.actions);
		}
	}
};

module.exports.update = update;
