'use strict';

const definition = require('../utils/definition');
const storage = require('appliances/storage/api');

const globalStorage = storage.global();

const instanceSymbol = Symbol('instance');
const rebuild = Symbol('rebuild');
const tagsSymbol = Symbol('tags');

class Adapter {
	constructor(instance) {
		this[instanceSymbol] = instance;
		this.id = instance.id;
	}

	[rebuild]() {
		const instance = this[instanceSymbol];
		return globalStorage.get('tinkerhub/' + instance.id + '/tags')
			.then(tags => {
				this[tagsSymbol] = tags || [];

				const metadata = Object.assign({}, instance.metadata);

				// First make sure the id of the instance is available in the metadata
				metadata.id = instance.id;

				console.log('tags', tags);
				// Create the tags of the instance
				metadata.tags = [ ...this[tagsSymbol] ];

				if(metadata.types) {
					for(const type of metadata.types) {
						metadata.tags.push('type:' + type);
					}
				}

				if(metadata.capabilities) {
					for(const cap of metadata.capabilities) {
						metadata.tags.push('cap:' + cap);
					}
				}

				if(! metadata.actions) {
					// Resolve all of the actions of the service being registered
					metadata.actions = {};
					for(const action of definition(instance)) {
						metadata.actions[action] = {};
					}
				}

				this.metadata = metadata;
			});
	}

	call(action, args) {
		switch(action) {
			case 'metadata:addTags':
			{
				const tags = this[tagsSymbol];
				for(const tag of args) {
					if(tags.indexOf(tag) === -1) {
						tags.push(tag);
					}
				}
				return globalStorage.set('tinkerhub/' + this[instanceSymbol].id + '/tags', tags)
					.then(() => this[rebuild]())
					.then(() => this[module.exports.handleSymbol].rebroadcast());
			}
			case 'metadata:removeTags':
			{
				const tags = this[tagsSymbol];
				for(const tag of args) {
					const idx = tags.indexOf(tag);
					if(idx >= 0) {
						tags.splice(idx, 1);
					}
				}
				return globalStorage.set('tinkerhub/' + this[instanceSymbol].id + '/tags', tags)
					.then(() => this[rebuild]())
					.then(() => this[module.exports.handleSymbol].rebroadcast());
			}
			default:
			{
				const instance = this[instanceSymbol];
				const func = instance[action];

				if(typeof func === 'function') {
					return func.apply(instance, args);
				} else {
					return func;
				}
			}
		}
	}
}

module.exports = function(instance) {
	const adapter = new Adapter(instance);
	return adapter[rebuild]()
		.then(() => adapter);
};

module.exports.handle = Symbol('handleSymbol');
