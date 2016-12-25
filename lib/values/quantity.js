'use strict';

function noop(value) {
    return value;
}

const prefixDefinitions = [
    {
        names: [ 'y', 'yocto' ],
        scale: 1e-24
    },
    {
        names: [ 'z', 'zepto' ],
        scale: 1e-21
    },
    {
        names: [ 'a', 'atto' ],
        scale: 1e-18
    },
    {
        names: [ 'f', 'femto' ],
        scale: 1e-15
    },
    {
        names: [ 'p', 'pico' ],
        scale: 1e-12
    },
    {
        names: [ 'n', 'nano' ],
        scale: 1e-9
    },
    {
        names: [ 'u', 'micro', 'mc', '\u03BC', '\u00B5' ],
        scale: 1e-6
    },
    {
        names: [ 'm', 'milli' ],
        scale: 1e-3
    },
    {
        names: [ 'c', 'centi' ],
        scale: 1e-2
    },
    {
        names: [ 'd', 'deci' ],
        scale: 1e-1
    },
    {
        names: [ 'da', 'deca', 'deka' ],
        scale: 1e1
    },
    {
        names: [ 'h', 'hecto' ],
        scale: 1e2
    },
    {
        names: [ 'k', 'kilo' ],
        scale: 1e3
    },
    {
        names: [ 'M', 'mega' ],
        scale: 1e6
    },
    {
        names: [ 'G', 'giga' ],
        scale: 1e9
    },
    {
        names: [ 'T', 'tera' ],
        scale: 1e12
    },
    {
        names: [ 'P', 'peta' ],
        scale: 1e15
    },
    {
        names: [ 'E', 'exa' ],
        scale: 1e18
    }
];

const prefixes = createUnits(prefixDefinitions);

const SIGN = '[+-]';
const INT = '\\d+';
const SIGNED_INT = SIGN + '?' + INT;
const FRACTION = '\\.' + INT;
const FLOAT = '(?:' + INT + '(?:' + FRACTION + ')?)' + '|(?:' + FRACTION + ')';
const EXP = '[Ee]' + SIGNED_INT;
const EXP_NUMBER = '(?:' + FLOAT + ')(?:' + EXP + ')?';
const NUMBER = SIGN + '?\\s*' + EXP_NUMBER;

/**
 * Map a list of conversions into an object where each name is represented
 * as a key.
 */
function createUnits(conversions) {
    const result = {};
    conversions.forEach(c => c.names.forEach(name => result[name] = c));
    return result;
}

/**
 * Create a case insensitive part of a regex by taking each letter in a
 * string and turning it into `[Aa]`.
 */
function caseInsensitivePart(value) {
    return value.split('')
        .map(v => {
            const l = v.toLowerCase();
            const u = v.toUpperCase();
            if(l !== u) {
                return '[' + l + u + ']';
            } else {
                return l;
            }
        })
        .join('');
}

/**
 * Create a regex for the given associative object.
 */
function createUnitRegex(units) {
    return Object.keys(units)
        .sort((a, b) => b.length - a.length)
        .map(unit => unit.length > 2 ? caseInsensitivePart(unit) : unit)
        .join('|');
}

/**
 * Create a method that calls as for the given unit.
 */
function createAs(unit) {
    return function() {
        return this.as(unit);
    };
}

class Factory {
    constructor(name, base, conversions, multiple) {
        this.name = name;
        this.base = base;
        this.conversions = conversions;
        this.units = createUnits(conversions);
        this.multiple = multiple;

        let parsing = this.parsing = {};
        parsing.unitPart = createUnitRegex(this.units);
        //parsing.unitEndRegExp = new RegExp('(' + parsing.unitPart + ')\s*$');
        parsing.prefixPart = createUnitRegex(prefixes);
        //parsing.prefixRegExp = new RegExp('(' + parsing.prefixPart + ')+');
        parsing.single = new RegExp('^\\s*(' + NUMBER + ')\\s*([^\\s]+)?\\s*$');
        parsing.multiple = new RegExp('\\s*' + NUMBER + '\\s*(?:[a-zA-Z0-9]+)?\\s*', 'g');
        parsing.unit = new RegExp('(' + parsing.prefixPart + ')?(' + parsing.unitPart + ')');

        // Create the instance factory
        this.Value = function(value, unit) {
            this.value = value;
            this.unit = unit;
        };

        const self = this;
        this.Value.prototype.as = function(unit) {
            if(this.unit === unit) {
                return this.value;
            }

            return self.convert(this.value, this.unit, unit);
        };

        for(let key of Object.keys(this.conversions)) {
            const conversion = this.conversions[key];
            for(let cName of conversion.names) {
                if(cName.length > 1) {
                    Object.defineProperty(this.Value.prototype, cName, {
                        get: createAs(cName)
                    });
                }
            }

            for(let pId of conversion.exposePrefixes) {
                const prefix = prefixes[pId];
                for(let pName of prefix.names) {
                    for(let cName of conversion.names) {
                        let unitName = pName + cName;
                        Object.defineProperty(this.Value.prototype, unitName, {
                            get: createAs(unitName)
                        });
                    }
                }
            }
        }
    }

    _instance(value, unit) {
        return new this.Value(value, unit);
    }

    create(value, unit) {
        if(value instanceof this.Value) {
            return value;
        }

        const type = typeof value;
        if(type === 'string') {
            // TODO: Properly parse
            return this._parse(value);
        } else if(type === 'number') {
            return this._instance(value, unit || this.base);
        } else if(type === 'object') {
            return this.create(value.value, value.unit);
        } else {
            throw new Error('Unable to create value');
        }
    }

    _findConversion(unit) {
        const c = this.units[unit];
        if(c) return c;

        const parsed = this.parsing.unit.exec(unit);
        if(! parsed) {
            throw new Error('Unsupported unit: ' + unit);
        }

        const baseUnit = this.units[parsed[parsed.length - 1]];
        let scale = 1;
        if(baseUnit.prefix) {
            if(parsed.length > 2) {
                const prefix = prefixes[parsed[1]];
                scale = prefix.scale;
            }
        } else {
            if(parsed.length > 2) {
                throw new Error('Unit ' + parsed[parsed.length - 1] + ' does not support prefixes');
            }
        }

        if(scale == 1) {
            return baseUnit;
        } else {
            this.units[unit] = {
                toBase: function(value) {
                    return baseUnit.toBase(value * scale);
                },

                fromBase: function(value) {
                    return baseUnit.fromBase(value) / scale;
                }
            };

            return this.units[unit];
        }
    }

    convert(value, unit, newUnit) {
        if(unit === newUnit) return value;

        let from = this._findConversion(unit);
        let to = this._findConversion(newUnit);

        const base = from.toBase(value);
        return to.fromBase(base);
    }

    _parseSingle(value) {
        const parts = this.parsing.single.exec(value);
        if(! parts) {
            throw new Error('Unable to parse ' + this.name + ': ' + value);
        }
        const number = parts[1]
        let unit = parts[2];
        if(! unit) {
            unit = this.base;
        }

        // Verify that we can parse the unit
        this._findConversion(unit);

        return [ parseFloat(number), unit ];
    }

    _parse(value) {
        if(this.multiple) {
            this.parsing.multiple.lastIndex = 0;
            let baseValue = 0;
            let parsed;
            while((parsed = this.parsing.multiple.exec(value))) {
                let v = this._parseSingle(parsed[0]);
                baseValue += this.convert(v[0], v[1], this.base);
            }

            return this._instance(baseValue, this.base);
        } else {
            const v = this._parseSingle(value);

            return this._instance(v[0], v[1]);
        }
    }
}

class QuantityBuilder {
    constructor(name) {
        this.name = name;
        this.conversions = [];
    }

    multiple() {
        this._multiple = true;
        return this;
    }

    base(name, opts) {
        this.base = name;
        this.conversions.push({
            names: opts.names,
            prefix: opts.prefix || false,
            exposePrefixes: opts.exposePrefixes || [],
            toBase: noop,
            fromBase: noop
        });

        return this;
    }

    add(name, opts) {
        let toBase;
        let fromBase;
        if(opts.scale) {
            toBase = function(value) {
                return value * opts.scale;
            };

            fromBase = function(value) {
                return value / opts.scale;
            }
        } else {
            toBase = opts.toBase;
            fromBase = opts.fromBase;
        }

        this.conversions.push({
            names: opts.names,
            prefix: opts.prefix || false,
            exposePrefixes: opts.exposePrefixes || [],
            toBase: toBase,
            fromBase: fromBase,
        });

        return this;
    }

    build() {
        const factory = new Factory(this.name, this.base, this.conversions, this._multiple);
        const result = function() {
            return factory.create.apply(factory, arguments);
        };
        result.toJSON = function(value) {
            return {
                value: value.value,
                unit: value.unit
            }
        };
        return result;
    }
}

module.exports = function(name) {
    return new QuantityBuilder(name);
};
