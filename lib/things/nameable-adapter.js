'use strict';

const { Thing, EasyNameable } = require('abstract-things');

module.exports = class extends Thing.with(EasyNameable) {

	constructor(instance) {
		super();

		this.id = instance.id;
	}

};
