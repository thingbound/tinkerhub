'use strict';

const builders = require('./defbuilder');
const definition = require('../../utils/definition');

const IDENTITY = function(input) { return input; };
const NO_CONVERSION = {
    convert: IDENTITY,
    toJSON: IDENTITY
};

class TypeRegistry {
    constructor() {
        this.deviceTypes = {};
        this.deviceCapabilities = {};

        this.types = {};
    }

    registerType(type, def) {
        if(! def) {
            throw 'A definition with convert (and optionally toJSON) needed for type ' + type;
        }

        if(! def.convert) {
            throw 'convert function required for type ' + type;
        }

        if(! def.toJSON) {
            def.toJSON = IDENTITY;
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
            if(! type) continue;

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

    _toObject(value) {
        if(! value) return {};

        const result = {};
        if(Array.isArray(value)) {
            value.forEach(v => result[v] = {
                type: 'mixed',
                description: ''
            });
        } else if(typeof value === 'object') {
            Object.keys(value).forEach(key => {
                result[key] = value[key];
            });
        } else {
            result[value] = {
                type: 'mixed',
                description: ''
            }
        }

        return result;
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
        const capabilities = [];
        const events = this._toObject(metadata.events);
        const state = this._toObject(metadata.state);

        const addCapabilities = (types, caps) => {
            caps.forEach(t => {
                if(capabilities.indexOf(t) === -1) {
                    capabilities.push(t);

                    const cap = this._findCapability(types, t);
                    if(cap) {
                        addCapabilities(types, cap.capabilities.required);

                        mergeObject(events, cap.events);
                        mergeObject(state, cap.state);
                    }
                }
            });
        };

        const mergeObject = (obj, def) => {
            Object.keys(def).forEach(key => {
                if(obj[key]) return;

                obj[key] = def[key];
            });
        };

        types.forEach(key => {
            const type = this.deviceTypes[key];
            if(type) {
                mergeObject(events, type.events);
                mergeObject(state, type.state);

                addCapabilities(types, type.capabilities.required);
            }
        });

        addCapabilities(types, this._toArray(metadata.capabilities));

        const def = {
            id: id,

            name: metadata.name,

            types: types,
            capabilities: capabilities,

            actions: {},
            state: state,
            events: events
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

    createToJSON(types) {
        if(Array.isArray(types)) {
            const converters = types.map(t => {
                if(t.type) t = t.type;
                return this.types[t];
            });

            return function(data) {
                return Array.prototype.map.call(data, (value, idx) => {
                    const converter = converters[idx] || NO_CONVERSION;
                    return converter.toJSON(value);
                });
            };
        } else {
            if(types.type) types = types.type;
            const converter = this.types[types] || NO_CONVERSION;
            return function(data) {
                return converter.toJSON(data);
            };
        }
    }

    createConversion(types) {
        if(Array.isArray(types)) {
            const converters = types.map(t => {
                if(t.type) t = t.type;
                return this.types[t];
            });

            return function(data) {
                return Array.prototype.map.call(data, (value, idx) => {
                    const converter = converters[idx] || NO_CONVERSION;
                    return converter.convert(value);
                });
            };
        } else {
            if(types.type) types = types.type;
            const converter = this.types[types] || NO_CONVERSION;
            return function(data) {
                return converter.convert(data);
            };
        }
    }
}

const types = module.exports = new TypeRegistry();

// Register the default type conversions
types.registerType('mixed', NO_CONVERSION);
types.registerType('object', NO_CONVERSION);

types.registerType('boolean', {
    convert: function(value) {
        if(typeof value === 'boolean') return value;

        value = String(value).toLowerCase();
        switch(value) {
            case 'true':
            case 'yes':
            case '1':
                return true;
            default:
                return false;
        }
    }
});

types.registerType('number', {
    convert: function(value) {
        if(typeof value === 'number') return value;

        return parseFloat(value);
    }
});

types.registerType('string', {
    convert: function(value) {
        return String(value);
    }
});

types.registerType('percentage',  {
    convert: function(value) {
        if(typeof value === 'number') return value;

        value = parseFloat(value);

        return value < 0 ? 0 : (value > 100 ? 100 : value);
    }
});

// Register any builtin device types and capabilities
require('./builtin')(types);
