'use strict';

/**
 * Metadata for a device that provides a builder-like API for
 * easily updating the metadata.
 */
module.exports = class Metadata {
	constructor() {
		this.types = [];
		this.capabilities = [];
		this.whitelist = [];
	}

	type(...types) {
		for(let type of types) {
			if(this.types.indexOf(type) == -1) {
				this.types.push(type);
			}
		}
		return this;
	}

	capability(...caps) {
		for(let cap of caps) {
			if(this.capabilities.indexOf(cap) == -1) {
				this.capabilities.push(cap);
			}
		}
		return this;
	}

	expose(...properties) {
		for(let p of properties) {
			if(this.whitelist.indexOf(p) == -1) {
				this.whitelist.push(p);
			}
		}
		return this;
	}
};
