
module.exports = function(object) {
    var result = [];
    var mapped = {};

    while(object) {
        Object.getOwnPropertyNames(object).forEach(key => {
            if(! mapped[key]) {
                mapped[key] = true;
                result.push(key);
            }
        });

        object = object.__proto__;
    }

    return result;
};
