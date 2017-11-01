'use strict';

const Q = require('q');
let seq = 0;

module.exports = class RemoteService {
	constructor(parent, node, def) {
		this.parent = parent;

		this.debug = require('debug')('th:service:' + def.id);

		this.node = node;

		this.id = def.id;
		this.instanceId = def.instance;
		this.metadata = def.metadata;

		this.promises = new Map();
	}

	updateDefinition(def) {
		this.metadata = def;
	}

    call(action, args) {
        const deferred = Q.defer();

        const id = seq++;
        if(seq > 100000) seq = 0;

		const promise = { deferred };
		this.promises.set(id, promise);

        this.debug('Calling', action, 'via node', this.node);
        this.node.send('service:invoke', {
            service: this.id,
            seq: id,
            action: action,
            arguments: args
		});

		promise.timeout = setTimeout(() => {
			promise.deferred.reject(new Error('Call timed out'));
			this.promises.delete(id);
		}, 30000);

        return deferred.promise;
    }

    receiveReply(message) {
        const promise = this.promises.get(message.seq);
        if(! promise) return;

        if(message.error) {
            promise.deferred.reject(new Error(message.error));
        } else {
            promise.deferred.resolve(message.result);
		}

		clearTimeout(promise.timeout);
		this.promises.delete(message.seq);
    }

    receiveProgress(message) {
        const promise = this.promises.get(message.seq);
        if(! promise) return;

        promise.deferred.notify(message.data);
    }

    remove() {
		for(const promise of this.promises.values()) {
			promise.deferred.reject(new Error('Service is no longer available'));
		}
	}

	inspect() {
		return 'RemoteService[' + this.id + ' on ' + this.node.inspect() + ']';
	}
}

