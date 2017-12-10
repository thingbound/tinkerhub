'use strict';

const hasTag = module.exports.hasTag = function hasTag(tag) {
	return function(thing) {
		return thing.metadata.id === tag || thing.metadata.hasTag(tag);
	};
}

const factory = module.exports.factory = Symbol('factory');

function map(tags) {
	return tags.map(tag => {
		if(typeof tag === 'string') {
			return hasTag(tag);
		} else if(typeof tag === 'function') {
			return tag;
		} else {
			throw new Error('Expected string or function, but got something of type ' + typeof tag);
		}
	});
}

const and = module.exports.and = function(...tags) {
	tags = map(tags);

	return function(thing) {
		for(const tag of tags) {
			if(! tag(thing)) return false;
		}

		return true;
	};
};

module.exports.or = function(...tags) {
	tags = map(tags);

	return function(thing) {
		for(const tag of tags) {
			if(tag(thing)) return true;
		}

		return false;
	};
};

module.exports.not = function(...tags) {
	const matcher = and(...tags);
	return function(thing) {
		return ! matcher(thing);
	};
};
