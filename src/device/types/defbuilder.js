class ActionBuilder {
    constructor(name, callback) {
        this.name = name;
        this.callback = callback;
        this.arguments = [];
        this.returnType = {
            type: 'mixed',
            description: ''
        };
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
    argument(type, description='') {
        this.arguments.push({
            type: type,
            description: description
        });

        return this;
    }

    /**
     * Add this action and return to building the rest of the definition.
     *
     * @return {mixed} The calling parent
     */
    done() {
        return this.callback({
            name: this.name,
            arguments: this.arguments,
            returnType: this.returnType
        });
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
    }

    requireCapability(cap) {
        Array.prototype.push.apply(this.capabilities.required, arguments);
        return this;
    }

    action(name) {
        return new ActionBuilder(name, def => {
            this.actions[name] = def;
            return this;
        });
    }

    done() {
        return this.callback({
            name: this.name,
            actions: this.actions,
            capabilities: this.capabilities
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
