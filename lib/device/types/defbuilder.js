'use strict';

class ActionBuilder {
    constructor(name, callback) {
        this.name = name;
        this.callback = callback;
        this.description = '';
        this.arguments = [];
        this.returnType = {
            type: 'mixed',
            description: ''
        };
        this.emitsEvent = null;
    }

    /**
     * Add a short description what the action does.
     *
     * @param {string} description The description of the action
     * @return {ActionBuilder} Self for chained calls
     */
    description(description) {
        this.description = description || '';
        return this;
    }

    /**
     * Define what this action returns.
     *
     * @param {string} type The type of data returned
     * @return {ActionBuilder} Self for chained calls
     */
    returns(type, description) {
        this.returnType = {
            type: type,
            description: description
        };
        return this;
    }

    /**
     * Add an argument for the action.
     *
     * @param {string} type The type of the argument
     * @param  {string) name The optional name of the argument
     * @return {ActionBuilder} Self for chained calls
     */
    argument(type, optional, description) {
        if(typeof optional !== 'boolean') {
            description = optional;
            optional = false;
        }

        this.arguments.push({
            type: type,
            optional: optional,
            description: description || '',
        });

        return this;
    }

    /**
     * Indicate that this method emits an event when its backing value
     * changes.
     */
    emitsEvent(eventName) {
        this.emitsEvent = eventName || this.name;
        return this;
    }

    /**
     * Add this action and return to building the rest of the definition.
     *
     * @return {mixed} The calling parent
     */
    done() {
        const def = {
            name: this.name,
            arguments: this.arguments,
            returnType: this.returnType
        };

        if(this.emitsEvent) {
            def.event = this.emitsEvent
        }

        if(this.description) {
            def.description = this.description;
        }

        return this.callback(def);
    }
}

class DefBuilder {
    constructor(name, callback) {
        this.name = name;
        this.callback = callback;

        this.capabilities = {
            required: []
        };

        this.actions = {};
        this._events = {};
        this._state = {};
    }

    requireCapability() {
        Array.prototype.push.apply(this.capabilities.required, arguments);
        return this;
    }

    action(name) {
        return new ActionBuilder(name, def => {
            this.actions[name] = def;
            return this;
        });
    }

    event(name, type, description) {
        this._events[name] = {
            type: type,
            description: description || ''
        };

        return this;
    }

    state(name, type, description) {
        this._state[name] = {
            type: type,
            description: description || ''
        };

        return this;
    }

    done() {
        return this.callback({
            name: this.name,
            actions: this.actions,
            capabilities: this.capabilities,

            state: this._state,
            events: this._events
        });
    }
}

class DeviceTypeDefBuilder extends DefBuilder {
    constructor(name, callback) {
        super(name, callback);

        this.capabilities.local = {};
    }

    when(cap) {
        return new DefBuilder(cap, def => {
            this.capabilities.local[cap] = def;
            return this;
        });
    }
}

module.exports.DeviceCapability = DefBuilder;
module.exports.DeviceType = DeviceTypeDefBuilder;
