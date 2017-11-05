'use strict';

const MultiResult = require('./multi-result');

const pAny = require('p-any');
const pSettle = require('p-settle');

const resolvePromise = Symbol('resolvePromise');
const picker = Symbol('picker');
const any = Symbol('any');

module.exports = class CallResolver {
    constructor(instances, promises) {
		this.instances = instances;
		this.promises = promises;
    }

    any() {
        this[any] = true;
        return this;
    }

    firstValue() {
        this[picker] = r => r.firstValue();
        return this;
    }

    highest() {
		this[picker] = r => r.highest();
        return this;
    }

    lowest() {
		this[picker] = r => r.lowest();
        return this;
    }

    distinct() {
		this[picker] = r => r.distinct();
        return this;
    }

    mostlyTrue() {
		this[picker] = r => r.mostlyTrue();
        return this;
    }

    mostlyFalse() {
        this[picker] = r => r.mostlyFalse();
        return this;
    }

    [resolvePromise]() {
        let promises = this.promises;

        if(this[any]) {
            return pAny(promises);
        } else {
            return pSettle(promises)
                .then(results => {
                    // Map the results to something a bit nicer
                    const result = new MultiResult(this.instances, results);

                    if(this[picker]) {
                        return this[picker](result);
                    } else {
                        return result;
                    }
                });
        }
    }

    then(handler, errorHandler) {
        return this[resolvePromise]()
            .then(handler, errorHandler);
    }

    catch(handler) {
        return this[resolvePromise]()
            .catch(handler);
    }
};
