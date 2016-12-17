'use strict';

/**
 * Metadata as found in the public device API.
 */
class Metadata {
    constructor(owner, def) {
        this._owner = owner;

        this.id = def.id;
        this.available = true;

        this.updateDef(def);
    }

    /**
     * Set the name of the device.
     */
    setName(name) {
        return this._owner.call('metadata:setName', [ name ]);
    }

    /**
     * Update the definition of the device.
     */
    updateDef(def) {
        this.def = def;

        let tags = def.tags.slice();

        if(def.types) {
            def.types.forEach(function(t) {
                tags.push('type:' + t);
            });
        }

        if(def.capabilities) {
            def.capabilities.forEach(function(c) {
                tags.push('cap:' + c);
            });
        }

        tags.push(def.id);

        this.tags = tags;

        this.name = def.name || null;

        this.actions = def.actions || [];
        this.state = def.state || {};
        this.events = def.events || {};
    }

    /**
     * Tag the device with the given arguments.
     */
    tag() {
        return this._owner.call('metadata:addTags', [ Array.prototype.slice.call(arguments) ]);
    }

    /**
     * Remove the tags given as arguments.
     */
    removeTag() {
        return this._owner.call('metadata:removeTags', [ Array.prototype.slice.call(arguments) ]);
    }
}

module.exports = function(owner, def) {
    return new Metadata(owner, def);
};
