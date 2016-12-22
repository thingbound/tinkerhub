'use strict';

const IDENTITY = function(input) { return input; };
const NO_CONVERSION = {
    create: IDENTITY,
    toJSON: IDENTITY
};

class ValueRegistry {
    constructor() {
        this.defs = {};
    }

    register(type, def) {
        if(! def) {
            throw 'A definition with create (and optionally toJSON) needed for type ' + type;
        }

        if(typeof def === 'function') {
            def = {
                create: def
            };
        }

        if(! def.create) {
            throw 'create function required for type ' + type;
        }

        if(! def.toJSON) {
            def.toJSON = IDENTITY;
        }

        this.defs[type] = def;
        this[type] = def.create;
    }

    get(type) {
        return this.defs[type];
    }

    createToJSON(types) {
        if(Array.isArray(types)) {
            const converters = types.map(t => {
                if(t.type) t = t.type;
                return this.defs[t];
            });

            return function(data) {
                return Array.prototype.map.call(data, (value, idx) => {
                    const converter = converters[idx] || NO_CONVERSION;
                    return converter.toJSON(converter.create(value));
                });
            };
        } else {
            if(types.type) types = types.type;
            const converter = this.defs[types] || NO_CONVERSION;
            return function(data) {
                return converter.toJSON(converter.create(data));
            };
        }
    }

    createConversion(types) {
        if(Array.isArray(types)) {
            const converters = types.map(t => {
                if(t.type) t = t.type;
                return this.defs[t];
            });

            return function(data) {
                return Array.prototype.map.call(data, (value, idx) => {
                    const converter = converters[idx] || NO_CONVERSION;
                    return converter.create(value);
                });
            };
        } else {
            if(types.type) types = types.type;
            const converter = this.defs[types] || NO_CONVERSION;
            return function(data) {
                return converter.create(data);
            };
        }
    }
}

const values = module.exports = new ValueRegistry();

values.register('mixed', NO_CONVERSION);
values.register('object', NO_CONVERSION);

values.register('boolean', function(value) {
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
);

values.register('number', function(value) {
    if(typeof value === 'number') return value;

    return parseFloat(value);
});

values.register('string', function(value) {
    return String(value);
});

values.register('percentage', function(value) {
    if(typeof value === 'number') return value;

    value = parseFloat(value);

    return value < 0 ? 0 : (value > 100 ? 100 : value);
});

values.register('angle', require('./angle'));
values.register('energy', require('./energy'));
values.register('illuminance', require('./illuminance'));
values.register('length', require('./length'));
values.register('mass', require('./mass'));
values.register('power', require('./power'));
values.register('pressure', require('./pressure'));
values.register('speed', require('./speed'));
values.register('temperature', require('./temperature'));
values.register('volume', require('./volume'));
