const builders = require('./defbuilder');
const definition = require('../../utils/definition');

const NO_CONVERSION = {
    toWire: function(input) { return input; },
    fromWire: function(input) { return input; }
};

class TypeRegistry {
    constructor() {
        this.deviceTypes = {};
        this.deviceCapabilities = {};

        this.types = {};
    }

    registerType(type, def) {
        if(! def) {
            throw 'A definition with toWire and fromWire needed for type ' + type;
        }

        if(! def.toWire) {
            throw 'toWire function required for type ' + type;
        }

        if(! def.fromWire) {
            throw 'fromWire function required for type ' + type;
        }

        this.types[type] = def;
    }

    /**
     * Register the contract of a new type of device.
     *
     * @param {string} type The name of the type
     * @return {DefBuilder} A builder for the type
     */
    registerDeviceType(type) {
        return new builders.DeviceType(type, def => {
            this.deviceTypes[type] = def;
            return this;
        });
    }

    /**
     * Register the contract of a global device capability..
     *
     * @param {string} cap The name of the capability
     * @return {DefBuilder} A builder for the capability
     */
    registerDeviceCapability(cap) {
        return new builders.DeviceCapability(cap, def => {
            this.deviceCapabilities[cap] = def;
            return this;
        });
    }

    _findCapability(types, name) {
        const cap = this.deviceCapabilities[name];
        if(cap) return cap;

        for(let i=0; i<types.length; i++) {
            const type = this.deviceTypes[types[i]];
            const localCap = type.capabilities.local[name];

            if(localCap) return localCap;
        }

        return null;
    }

    _findAction(action, types, capabilities) {
        for(let i=0; i<types.length; i++) {
            const type = this.deviceTypes[types[i]];
            if(type && type.actions[action]) {
                return type.actions[action];
            }
        }

        for(let i=0; i<capabilities.length; i++) {
            const cap = this._findCapability(types, capabilities[i]);
            if(cap && cap.actions[action]) {
                return cap.actions[action];
            }
        }

        return null;
    }


    _checkForAllActions(definedActions, types, capabilities) {
        for(let i=0; i<types.length; i++) {
            const type = this.deviceTypes[types[i]];
            if(! type) continue;

            for(let key in type.actions) {
                if(type.actions.hasOwnProperty(key) && ! definedActions[key]) {
                    throw 'Action ' + key + ' needs to be implemented by device (from type ' + types[i] + ')';
                }
            }
        }

        for(let i=0; i<capabilities.length; i++) {
            const cap = this._findCapability(types, capabilities[i]);
            if(! cap) continue;

            for(let key in cap.actions) {
                if(cap.actions.hasOwnProperty(key) && ! definedActions[key]) {
                    throw 'Action ' + key + ' needs to be implemented by device (from capability ' + capabilities[i] + ')';
                }
            }
        }
    }

    _toArray(value) {
        return Array.isArray(value) ? value : (value ? [ value ] : []);
    }

    _createUnknownActionDef(value) {
        if(typeof value === 'function') {
            const args = [];
            const unknownArg = {
                type: 'mixed',
                name: ''
            };

            for(let i=0; i<value.length; i++) {
                args.push(unknownArg);
            }

            return {
                returnType: 'mixed',
                arguments: args
            };
        } else {
            return {
                returnType: 'mixed',
                arguments: []
            };
        }
    }

    /**
     * Describe the given device instance by checking its metadata for types
     * and capabilities and mapping them against registered definitions. This
     * will also validate the device.
     *
     * @param {string} id The id of the device
     * @param {object} device The device to describe
     * @return {object} Description of this device
     */
    describeDevice(id, device) {
        const metadata = device.metadata || {};
        const types = this._toArray(metadata.type || metadata.types);
        const capabilities = this._toArray(metadata.capabilities);

        const addCapabilities = (caps) => {
            caps.forEach(t => {
                if(capabilities.indexOf(t) === -1) {
                    capabilities.push(t);

                    const cap = this.deviceCapabilities[t];
                    if(cap) {
                        addCapabilities(cap.capabilities.required);
                    }
                }
            });
        };

        types.forEach(key => {
            const type = this.deviceTypes[key];
            if(type) {
                addCapabilities(type.capabilities.required);
            }
        });

        const def = {
            id: id,

            name: metadata.name,

            types: types,
            capabilities: capabilities,

            actions: {}
        };

        // Go through and define up the device actions
        definition(device).forEach(key => {
            if(key[0] === '_' || key === 'metadata') return;

            const action = this._findAction(key, types, capabilities);
            if(action) {
                def.actions[key] = action;
            } else {
                def.actions[key] = this._createUnknownActionDef(device[key]);
            }
        });

        // Validate the actions
        this._checkForAllActions(def.actions, types, capabilities);

        return def;
    }

    createToWireForArray(types) {
        const converters = [];
        types.forEach(t => converters.push(this.types[t]));
        return function(data) {
            return data.map((value, idx) => {
                const converter = converters[idx] || NO_CONVERSION;
                return converter.toWire(value);
            });
        };
    }

    createFromWireForArray(types) {
        const converters = [];
        types.forEach(t => converters.push(this.types[t]));
        return function(data) {
            return data.map((value, idx) => {
                const converter = converters[idx] || NO_CONVERSION;
                return converter.fromWire(value);
            });
        };
    }
}

const types = module.exports = new TypeRegistry();

// Register the default type conversions
types.registerType('mixed', NO_CONVERSION);
types.registerType('boolean', NO_CONVERSION);
types.registerType('number', NO_CONVERSION);
types.registerType('string', NO_CONVERSION);
types.registerType('object', NO_CONVERSION);
types.registerType('percentage', NO_CONVERSION);

// Register any builtin device types and capabilities
require('./builtin')(types);
