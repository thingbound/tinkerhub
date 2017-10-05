'use strict';

const { Class, Mixin, toExtendable, mix } = require('foibles');
const HANDLE = Symbol('deviceHandle');

const Metadata = require('./lib/metadata');
const merge = require('./lib/utils/merge');

const th = require('./');

function traversePrototype(root, name, func) {
	let prototype = root.constructor;
	while(prototype != Device) {
		if(prototype.hasOwnProperty(name)) {
			// If this property belongs to this prototype get the value
			const value = prototype[name];
			if(typeof value !== 'undefined') {
				func(value);
			}
		}

		prototype = Object.getPrototypeOf(prototype);
	}
}

const eventQueue = Symbol('eventQueue');

const Device = module.exports = toExtendable(class Device {
	constructor() {
		this.metadata = new Metadata();

		this[eventQueue] = [];

		traversePrototype(this, 'availableAPI', items => this.metadata.expose(...items));
		traversePrototype(this, 'types', types => this.metadata.type(...types));
		traversePrototype(this, 'type', type => this.metadata.type(type));
		traversePrototype(this, 'capabilities', caps => this.metadata.capability(...caps));
	}

	/**
	 * Register this device and expose it over the network.
	 */
	register() {
		if(! this.id) {
			throw new Error('`id` must be set for device');
		}
		this[HANDLE] = th.devices.register(this.id, this);
	}

	/**
	 * Remove this device, will stop exposing it over the network.
	 */
	remove() {
		this[HANDLE].remove();
		delete this[HANDLE];
	}

	/**
	 * Emit an event with the given name and data.
	 *
	 * @param {string} event
	 * @param {*} data
	 */
	emitEvent(event, data) {
		const handle = this[HANDLE];
		if(! handle) return;

		const queue = this[eventQueue];
		const shouldQueueEmit = queue.length === 0;

		// Check if there is already an even scheduled
		const idx = queue.findIndex(e => e[0] === event);
		if(idx >= 0) {
			// Remove the event - only a single event can is emitted per tick
			queue.splice(idx, 1);
		}

		// Add the event to the queue
		queue.push([ event, data ]);

		if(shouldQueueEmit) {
			// Schedule emittal of the events
			setImmediate(() => {
				for(const e of queue) {
					handle.emit(e[0], e[1]);
				}

				this[eventQueue] = [];
			});
		}
	}

	debug() {
		if(! this[HANDLE]) return;
		this[HANDLE].debug.apply(this[HANDLE], arguments);
	}

	/**
	 * Create a new type that can be mixed in with a Device.
	 *
	 * @param {function} func
	 */
	static type(func) {
		return Class(Device, func);
	}

	/**
	 * Create a new capability that can be mixed in with a Device.
	 *
	 * @param {function} func
	 */
	static capability(func) {
		return Mixin(func);
	}

	static mixin(obj, ...mixins) {
		const direct = Object.getPrototypeOf(obj);
		const parent = Object.getPrototypeOf(direct);

		const proto = {};
		for(let name of Object.getOwnPropertyNames(direct)) {
			proto[name] = direct[name];
		}
		const base = mix(parent.constructor, ...mixins);
		Object.setPrototypeOf(proto, base.prototype);

		Object.setPrototypeOf(obj, proto);

		const data = new base();
		merge(obj, data);
	}

	mixin(...mixins) {
		Device.mixin(this, ...mixins);
	}
});
