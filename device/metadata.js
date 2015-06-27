
function Metadata(owner, def) {
    this._owner = owner;

    this.id = def.id;

    this.updateDef(def);
}

Metadata.prototype.setName = function(name) {
    return this._owner.call('_setName', [ name ]);
};

Metadata.prototype.updateDef = function(def) {
    this.def = def;

    var tags = def.tags.slice();

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
};

Metadata.prototype.tag = function() {
    return this._owner.call('_addTags', [ Array.prototype.slice.call(arguments) ]);
};

Metadata.prototype.removeTag = function() {
    return this._owner.call('_removeTags', [ Array.prototype.slice.call(arguments) ]);
};

module.exports = function(id, def) {
    return new Metadata(id, def);
};
