'use strict';

const { ManualDiscovery } = require('tinkerhub-discovery');
const Collection = require('./collection');

module.exports = class ModifiableCollection extends Collection {
	extendWith(factory) {
		if(! this.active) throw new Error('Collection has been destroyed');

		const discovery = new ManualDiscovery();
		this.on('available', thing => discovery.add(thing));
		this.on('unavailable', thing => discovery.remove(thing));

		const mapped = discovery.map(thing => {
			return Promise.resolve(factory(thing))
				.then(instance => {
					if(! instance) return;

					instance.id = thing.id;
					return instance;
				});
		});

		for(const thing of this) {
			discovery.add(thing);
		}

		this.parent.registerDiscovery(mapped);
		return this;
	}
};

